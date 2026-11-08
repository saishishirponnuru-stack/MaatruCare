from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..models import Account, AuditLog, Caregiver, CaregiverInvitation, Patient, Permission
from ..services.access_service import is_workspace_owner, require_patient_controller
from ..services.audit_service import record_audit
from ..services.invitation_email_service import delivery_capability, send_invitation_email, InvitationEmailError
from ..services.demo_caregiver_service import demo_caregivers_available, demo_mode_enabled
from ..services.auth_service import (
	hash_invitation,
	new_invitation_token,
	require_current_account,
	verified_account_email,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class BootstrapRequest(BaseModel):
	role: str = Field(pattern="^(patient|caregiver)$")
	name: str = Field(min_length=1, max_length=200)
	invitation_token: str | None = None
	demo_workspace: bool = False

	@field_validator("name")
	@classmethod
	def trimmed_name(cls, value: str) -> str:
		if not value.strip():
			raise ValueError("Name is required")
		return value.strip()


class InvitationRequest(BaseModel):
	delivery: Literal["link", "email"] = "link"
	email: str = Field(min_length=3, max_length=255)
	name: str | None = Field(default=None, max_length=200)
	relationship: str = Field(default="Family caregiver", min_length=1, max_length=100)

	@field_validator("email")
	@classmethod
	def normalized_email(cls, value):
		import re
		value = value.strip().lower()
		if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
			raise ValueError("Enter a valid caregiver email")
		return value

	@field_validator("relationship")
	@classmethod
	def safe_relationship(cls, value):
		if not value.strip() or value.strip().lower() in {"primary caregiver", "patient", "patient controller"}:
			raise ValueError("Choose a caregiver relationship")
		return value.strip()


class ProfileUpdate(BaseModel):
	phone: str | None = Field(default=None, max_length=32, pattern=r"^[+0-9 ()-]*$")
	current_phase: str | None = Field(default=None, pattern="^(Preconception|Pregnancy|Postnatal|Early motherhood)$")
	name: str = Field(min_length=1, max_length=200)


class InvitationEmailRetry(BaseModel):
	token: str = Field(min_length=10, max_length=255)


def _account_response(db: Session, account: Account) -> dict:
	patient = db.get(Patient, account.patient_id) if account.patient_id else None
	caregiver = db.get(Caregiver, account.caregiver_id) if account.caregiver_id else None
	if account.role == "caregiver" and (caregiver is None or caregiver.access_status != "Active"):
		raise HTTPException(403, "Your caregiver access has been revoked. Contact the Care Circle owner or sign out.")
	return {
		"id": account.id,
		"subject": account.subject,
		"role": account.role,
		"name": account.name,
		"email": account.email,
		"phone": account.phone,
		"patient_id": account.patient_id,
		"caregiver_id": account.caregiver_id,
		"patient": {"id": patient.id, "name": patient.name, "current_phase": patient.current_phase, "is_demo_workspace": patient.is_demo_workspace, "owner_caregiver_id": db.scalar(select(Account.caregiver_id).where(Account.patient_id == patient.id, Account.role == "patient").order_by(Account.id).limit(1))} if patient else None,
		"caregiver": {
			"id": caregiver.id,
			"name": caregiver.name,
			"relationship": caregiver.relationship,
			"role": caregiver.role,
			"is_demo": caregiver.is_demo,
			"is_patient": caregiver.is_patient,
			"access_status": caregiver.access_status,
		} if caregiver else None,
	}


def _claim_invitation(db, invitation):
	# A concurrent accept or withdrawal must win exactly once.
	now = datetime.utcnow()
	result = db.execute(update(CaregiverInvitation).where(
		CaregiverInvitation.id == invitation.id,
		CaregiverInvitation.accepted_at.is_(None),
		CaregiverInvitation.withdrawn_at.is_(None),
		CaregiverInvitation.created_at > now - timedelta(days=7),
	).values(accepted_at=now))
	if result.rowcount != 1:
		raise HTTPException(409, "This invitation is no longer pending")


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)) -> dict:
	account = require_current_account(request)
	if account.id == 0 or account.role == "unlinked":
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account onboarding is required")
	return _account_response(db, account)


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
def bootstrap(payload: BootstrapRequest, request: Request, db: Session = Depends(get_db)) -> dict:
	auth_account = require_current_account(request)
	if payload.demo_workspace and payload.role != "patient":
		raise HTTPException(400, "A fictional workspace must be created by its owner")
	if payload.demo_workspace and not demo_mode_enabled():
		raise HTTPException(404, "Fictional demonstration workspaces are not available")
	existing_account = auth_account if auth_account.id and auth_account.role != "unlinked" else db.scalar(select(Account).where(Account.subject == auth_account.subject))
	if existing_account is not None:
		patient = db.get(Patient, existing_account.patient_id) if existing_account.patient_id else None
		if payload.demo_workspace and (existing_account.role != "patient" or not patient or not patient.is_demo_workspace):
			raise HTTPException(409, "An existing care workspace cannot be converted. Use a separate account for a fictional demonstration.")
		return _account_response(db, existing_account)
	if payload.role == "caregiver":
		if not payload.invitation_token:
			raise HTTPException(status_code=400, detail="An invitation token is required for caregiver bootstrap")
		invitation = db.scalar(select(CaregiverInvitation).where(
			CaregiverInvitation.token_hash == hash_invitation(payload.invitation_token),
			CaregiverInvitation.accepted_at.is_(None),
			CaregiverInvitation.withdrawn_at.is_(None),
		))
		if invitation is None:
			raise HTTPException(status_code=400, detail="Invitation token is invalid or already used")
		if not verified_account_email(auth_account) or verified_account_email(auth_account).lower() != invitation.email.lower():
			raise HTTPException(status_code=403, detail="This invitation was issued for a different email address")
		if invitation.created_at + timedelta(days=7) <= datetime.utcnow():
			raise HTTPException(status_code=410, detail="This invitation has expired. Ask for a new invitation.")
		_claim_invitation(db, invitation)
		patient = db.get(Patient, invitation.patient_id)
		caregiver = Caregiver(patient_id=patient.id, name=payload.name, relationship=invitation.relationship, email=invitation.email)
		db.add(caregiver)
		db.flush()
		for permission_name in ("Appointments", "Coordination tasks", "Care handoffs", "Approved care updates", "Lifestyle records"):
			db.add(Permission(caregiver_id=caregiver.id, permission_name=permission_name, enabled=False))
		invitation.accepted_at = datetime.utcnow()
		account = Account(subject=auth_account.subject, role="caregiver", name=payload.name, email=invitation.email, caregiver_id=caregiver.id, patient_id=patient.id)
	else:
		# Reuse only an unclaimed legacy profile for this verified email.
		patient = db.scalar(select(Patient).where(
			Patient.email == auth_account.email,
			~Patient.id.in_(select(Account.patient_id).where(Account.role == "patient", Account.patient_id.is_not(None))),
		)) if auth_account.email and not payload.demo_workspace else None
		if patient is None:
			patient = Patient(name=payload.name, email=auth_account.email, current_phase="Onboarding", is_demo_workspace=payload.demo_workspace)
			db.add(patient)
			db.flush()
		else:
			patient.name = payload.name
		caregiver = db.scalar(select(Caregiver).where(
			Caregiver.patient_id == patient.id,
			Caregiver.is_patient.is_(True),
			Caregiver.access_status == "Active",
		))
		if caregiver is None:
			caregiver = Caregiver(patient_id=patient.id, name=payload.name, relationship="Primary caregiver", role="Patient", is_patient=True, email=auth_account.email)
			db.add(caregiver)
			db.flush()
		else:
			caregiver.name = caregiver.name or payload.name
			caregiver.email = caregiver.email or auth_account.email
		if not db.scalar(select(Permission).where(Permission.caregiver_id == caregiver.id)):
			for permission_name in ("Appointments", "Coordination tasks", "Care handoffs", "Approved care updates", "Lifestyle records"):
				db.add(Permission(caregiver_id=caregiver.id, permission_name=permission_name, enabled=True))
		account = Account(subject=auth_account.subject, role="patient", name=payload.name, email=auth_account.email, patient_id=patient.id, caregiver_id=caregiver.id)
	db.add(account)
	if payload.role == "caregiver":
		record_audit(db, patient_id=patient.id, actor_name=account.name, action="invitation_accepted", resource_type="Caregiver", resource_id=caregiver.id)
	elif payload.demo_workspace:
		record_audit(db, patient_id=patient.id, actor_name=account.name, action="demo_workspace_created", resource_type="Patient", resource_id=patient.id)
	try:
		db.commit()
	except IntegrityError:
		# A simultaneous bootstrap for the same subject must not leave orphan profiles.
		db.rollback()
		existing = db.scalar(select(Account).where(Account.subject == auth_account.subject))
		if existing is None:
			raise
		return _account_response(db, existing)
	db.refresh(account)
	return _account_response(db, account)


@router.put("/profile")
def update_profile(payload: ProfileUpdate, request: Request, db: Session = Depends(get_db)) -> dict:
	auth_account = require_current_account(request)
	if auth_account.id == 0 or auth_account.role == "unlinked":
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account onboarding is required")
	account = db.scalar(select(Account).where(Account.subject == auth_account.subject))
	if account is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account onboarding is required")
	name = payload.name.strip()
	if not name:
		raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required")
	if payload.current_phase and account.role != "patient":
		raise HTTPException(403, "Only the Care Circle owner can update their journey phase")
	account.name = name
	if "phone" in payload.model_fields_set:
		account.phone = payload.phone or None
	if account.patient_id and account.role == "patient":
		patient = db.get(Patient, account.patient_id)
		if patient:
			patient.name = name
			if "phone" in payload.model_fields_set: patient.phone = payload.phone or None
			if payload.current_phase:
				patient.current_phase = payload.current_phase
				record_audit(db, patient_id=patient.id, actor_name=name, action="journey_updated", resource_type="Patient", resource_id=patient.id)
	if account.caregiver_id:
		caregiver = db.get(Caregiver, account.caregiver_id)
		if caregiver:
			caregiver.name = name
	db.commit()
	db.refresh(account)
	return _account_response(db, account)


@router.post("/invitations", status_code=status.HTTP_201_CREATED)
def create_invitation(payload: InvitationRequest, request: Request, db: Session = Depends(get_db)) -> dict:
	account = require_current_account(request)
	if not account.patient_id or not account.caregiver_id:
		raise HTTPException(status_code=403, detail="Finish setting up your care workspace to continue")
	require_patient_controller(db, account.caregiver_id, account.patient_id)
	patient_id = account.patient_id
	if not payload.email.strip() or "@" not in payload.email or payload.email.strip().lower() == (account.email or "").lower():
		raise HTTPException(status_code=422, detail="Enter a caregiver email different from your own")
	email = payload.email.strip().lower()
	if db.scalar(select(CaregiverInvitation.id).where(CaregiverInvitation.patient_id == patient_id, func.lower(CaregiverInvitation.email) == email, CaregiverInvitation.accepted_at.is_(None), CaregiverInvitation.withdrawn_at.is_(None), CaregiverInvitation.created_at > datetime.utcnow() - timedelta(days=7))):
		raise HTTPException(409, "A pending invitation already exists for this email")
	if db.scalar(select(Caregiver.id).where(Caregiver.patient_id == patient_id, func.lower(Caregiver.email) == email, Caregiver.access_status == "Active")):
		raise HTTPException(409, "This caregiver is already in your Care Circle")
	if payload.delivery == "email":
		attempts = db.scalar(select(func.count(CaregiverInvitation.id)).where(CaregiverInvitation.created_by_account_id == account.id, CaregiverInvitation.created_at > datetime.utcnow() - timedelta(hours=1), CaregiverInvitation.email_status != "not_requested"))
		if attempts >= 10:
			raise HTTPException(429, "Invitation email limit reached. Try again later or create a link.")
	token = new_invitation_token()
	invitation = CaregiverInvitation(
		token_hash=hash_invitation(token),
		patient_id=patient_id,
		email=email,
		name=payload.name,
		relationship=payload.relationship,
		created_by_account_id=account.id,
	)
	db.add(invitation)
	db.flush()
	record_audit(db, patient_id=patient_id, actor_name=account.name, action="invitation_created", resource_type="CaregiverInvitation", resource_id=invitation.id)
	db.commit()
	if payload.delivery == "email":
		try:
			invitation.provider_message_id = send_invitation_email(invitation, token)
			invitation.email_status = "accepted"
			invitation.email_accepted_at = datetime.utcnow()
		except InvitationEmailError as error:
			invitation.email_status = "unavailable" if str(error) == "unavailable" else "failed"
		except Exception:
			invitation.email_status = "failed"
		db.commit()
	return {"id": invitation.id, "token": token, "email": email, "email_status": invitation.email_status, "email_accepted_at": invitation.email_accepted_at}


@router.get("/invitation-delivery")
def invitation_delivery(request: Request, db: Session = Depends(get_db)):
	account = require_current_account(request)
	if not account.patient_id or not account.caregiver_id:
		raise HTTPException(403, "Complete your care workspace setup first")
	require_patient_controller(db, account.caregiver_id, account.patient_id)
	return {**delivery_capability(), "simulated_available": demo_caregivers_available(account.patient_id, db)}


@router.get("/invitations")
def list_invitations(request: Request, db: Session = Depends(get_db)) -> list[dict]:
	account = require_current_account(request)
	if not account.patient_id:
	    raise HTTPException(status_code=403, detail="Finish setting up your care workspace to continue")
	caregiver = db.get(Caregiver, account.caregiver_id) if account.caregiver_id else None
	if caregiver is None or caregiver.patient_id != account.patient_id or not is_workspace_owner(db, caregiver) or caregiver.access_status != "Active":
	    raise HTTPException(status_code=403, detail="Only the Care Circle owner can view invitations")
	invitations = db.scalars(
	    select(CaregiverInvitation)
	    .where(CaregiverInvitation.patient_id == account.patient_id)
	    .order_by(CaregiverInvitation.created_at.desc())
	).all()
	return [
	    {
	        "id": invitation.id,
	        "email": invitation.email,
	        "name": invitation.name,
	        "relationship": invitation.relationship,
	        "created_at": invitation.created_at,
	        "accepted_at": invitation.accepted_at,
	        "withdrawn_at": invitation.withdrawn_at,
	        "email_status": invitation.email_status,
	        "email_accepted_at": invitation.email_accepted_at,
	        "expires_at": invitation.created_at + timedelta(days=7),
	        "status": "Accepted" if invitation.accepted_at else "Withdrawn" if invitation.withdrawn_at else "Expired" if invitation.created_at + timedelta(days=7) <= datetime.utcnow() else "Pending",
	    }
	    for invitation in invitations
	]


@router.post("/invitations/{token}/accept")
def accept_invitation(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
	account = require_current_account(request)
	invitation = db.scalar(select(CaregiverInvitation).where(
		CaregiverInvitation.token_hash == hash_invitation(token),
		CaregiverInvitation.accepted_at.is_(None),
			CaregiverInvitation.withdrawn_at.is_(None),
	))
	if invitation is None:
		raise HTTPException(status_code=404, detail="Invitation not found or already accepted")
	if not verified_account_email(account) or verified_account_email(account).lower() != invitation.email.lower():
		raise HTTPException(status_code=403, detail="This invitation was issued for a different email address")
	if invitation.created_at + timedelta(days=7) <= datetime.utcnow():
		raise HTTPException(status_code=410, detail="This invitation has expired. Ask for a new invitation.")
	if account.id and account.role != "unlinked":
		raise HTTPException(status_code=409, detail="Account is already linked")
	_claim_invitation(db, invitation)
	caregiver = Caregiver(patient_id=invitation.patient_id, name=invitation.name or account.name, relationship=invitation.relationship, email=invitation.email)
	db.add(caregiver)
	db.flush()
	for permission_name in ("Appointments", "Coordination tasks", "Care handoffs", "Approved care updates", "Lifestyle records"):
		db.add(Permission(caregiver_id=caregiver.id, permission_name=permission_name, enabled=False))
	invitation.accepted_at = datetime.utcnow()
	linked = Account(subject=account.subject, role="caregiver", name=caregiver.name, email=invitation.email, patient_id=invitation.patient_id, caregiver_id=caregiver.id)
	db.add(linked)
	record_audit(db, patient_id=invitation.patient_id, actor_name=linked.name, action="invitation_accepted", resource_type="Caregiver", resource_id=caregiver.id)
	db.commit()
	db.refresh(linked)
	return _account_response(db, linked)

@router.post("/invitations/{invitation_id}/withdraw")
def withdraw_invitation(invitation_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
	account = require_current_account(request)
	if not account.patient_id or not account.caregiver_id:
		raise HTTPException(status_code=403, detail="A Care Circle owner account is required")
	actor = require_patient_controller(db, account.caregiver_id, account.patient_id)
	invitation = db.get(CaregiverInvitation, invitation_id)
	if invitation is None or invitation.patient_id != account.patient_id:
		raise HTTPException(status_code=404, detail="Invitation not found")
	if invitation.accepted_at or invitation.withdrawn_at or invitation.created_at + timedelta(days=7) <= datetime.utcnow():
		raise HTTPException(status_code=409, detail="Only pending invitations can be withdrawn")
	result = db.execute(update(CaregiverInvitation).where(CaregiverInvitation.id == invitation.id, CaregiverInvitation.accepted_at.is_(None), CaregiverInvitation.withdrawn_at.is_(None), CaregiverInvitation.created_at > datetime.utcnow() - timedelta(days=7)).values(withdrawn_at=datetime.utcnow()))
	if result.rowcount != 1:
		raise HTTPException(409, "This invitation is no longer pending")
	record_audit(db, patient_id=account.patient_id, actor_name=actor.name, action="invitation_withdrawn", resource_type="CaregiverInvitation", resource_id=invitation.id)
	db.commit()
	return {"id": invitation.id, "status": "Withdrawn"}


@router.post("/invitations/{invitation_id}/retry-email")
def retry_invitation_email(invitation_id: int, payload: InvitationEmailRetry, request: Request, db: Session = Depends(get_db)):
    import secrets
    account = require_current_account(request)
    if not account.patient_id or not account.caregiver_id:
        raise HTTPException(403, "A Care Circle owner account is required")
    require_patient_controller(db, account.caregiver_id, account.patient_id)
    invitation = db.scalar(select(CaregiverInvitation).where(CaregiverInvitation.id == invitation_id, CaregiverInvitation.patient_id == account.patient_id).with_for_update())
    if invitation is None or not secrets.compare_digest(hash_invitation(payload.token), invitation.token_hash):
        raise HTTPException(404, "Invitation not found")
    if invitation.accepted_at or invitation.withdrawn_at or invitation.created_at + timedelta(days=7) <= datetime.utcnow():
        raise HTTPException(409, "Only a pending invitation can be emailed")
    if invitation.email_status == "accepted":
        return {"email_status": invitation.email_status, "email_accepted_at": invitation.email_accepted_at}
    if not delivery_capability()["email_available"]:
        raise HTTPException(409, "Invitation email is unavailable. Copy and securely share the existing link.")
    db.scalar(select(Account.id).where(Account.id == account.id).with_for_update())
    attempts = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.actor_account_id == account.id, AuditLog.action == "invitation_email_retry", AuditLog.created_at > datetime.utcnow() - timedelta(hours=1)))
    if attempts >= 10:
        raise HTTPException(429, "Invitation email retry limit reached. Share the secure link or try again later.")
    record_audit(db, patient_id=account.patient_id, actor_name=account.name, action="invitation_email_retry", resource_type="CaregiverInvitation", resource_id=invitation.id)
    try:
        # Same invitation ID => same provider idempotency key. Never rotates the
        # token, changes its recipient or invalidates an already-shared link.
        invitation.provider_message_id = send_invitation_email(invitation, payload.token)
        invitation.email_status = "accepted"
        invitation.email_accepted_at = datetime.utcnow()
    except InvitationEmailError as error:
        invitation.email_status = "unavailable" if str(error) == "unavailable" else "failed"
    except Exception:
        invitation.email_status = "failed"
    db.commit()
    return {"email_status": invitation.email_status, "email_accepted_at": invitation.email_accepted_at}

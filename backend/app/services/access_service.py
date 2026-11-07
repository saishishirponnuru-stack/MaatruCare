from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account, Caregiver, Patient, Permission
from .auth_service import effective_caregiver_id, require_actor_account, get_current_account, test_auth_compat_enabled

ALLOWED_PERMISSIONS = {
	"Appointments",
	"Coordination tasks",
	"Care handoffs",
	"Approved care updates",
	"Lifestyle records",
}


def get_active_caregiver(db: Session, caregiver_id: int) -> Caregiver:
	account = require_actor_account(db, caregiver_id)
	caregiver_id = effective_caregiver_id(account, caregiver_id)
	caregiver = db.get(Caregiver, caregiver_id)
	if caregiver is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found")
	if account is not None and caregiver.is_demo:
		raise HTTPException(403, "Simulated caregivers do not have sign-in access")
	if caregiver.access_status != "Active":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver access is not active")
	if account is not None and account.patient_id is not None and caregiver.patient_id != account.patient_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver does not belong to your care workspace")
	return caregiver


def require_patient_caregiver(db: Session, actor_caregiver_id: int, patient_id: int) -> Caregiver:
	account = require_actor_account(db, actor_caregiver_id)
	if account is not None and account.patient_id is not None and account.patient_id != patient_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This care workspace is not linked to your account")
	actor_caregiver_id = effective_caregiver_id(account, actor_caregiver_id)
	if db.get(Patient, patient_id) is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Care workspace not found")
	caregiver = get_active_caregiver(db, actor_caregiver_id)
	if caregiver.patient_id != patient_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver cannot access this care workspace")
	return caregiver


def get_patient_member(db: Session, caregiver_id: int, patient_id: int) -> Caregiver:
	"""Resolve a resource participant, never substitute the authenticated actor."""
	member = db.get(Caregiver, caregiver_id)
	if member is None:
		raise HTTPException(status_code=404, detail="Caregiver not found")
	if member.patient_id != patient_id or member.access_status != "Active":
		raise HTTPException(status_code=403, detail="Caregiver is not active in this Care Circle")
	return member


def is_workspace_owner(db: Session, member: Caregiver) -> bool:
    """Ownership comes from a persisted account binding, never a display relationship."""
    if member.access_status != "Active":
        return False
    current = get_current_account()
    if current is not None and current.caregiver_id == member.id and (current.role != "patient" or current.patient_id != member.patient_id):
        return False
    owner = db.scalar(select(Account.id).where(Account.role == "patient", Account.patient_id == member.patient_id, Account.caregiver_id == member.id))
    if owner is not None:
        return True
    # Isolated legacy test fixtures have no account, and cannot be used in production.
    return get_current_account() is None and test_auth_compat_enabled() and member.relationship == "Primary caregiver"


def effective_permissions(db: Session, member: Caregiver) -> set[str]:
    if is_workspace_owner(db, member):
        return set(ALLOWED_PERMISSIONS)
    return set(db.scalars(select(Permission.permission_name).where(Permission.caregiver_id == member.id, Permission.enabled.is_(True))).all())


def require_permission(db: Session, caregiver: Caregiver, permission_name: str) -> Permission:
    if permission_name not in ALLOWED_PERMISSIONS:
        raise HTTPException(400, "Unsupported sharing category")
    if caregiver.access_status != "Active":
        raise HTTPException(403, "Caregiver access is not active")
    if is_workspace_owner(db, caregiver):
        # Compatibility only: do not persist or require a self-caregiver permission row.
        return Permission(caregiver_id=caregiver.id, permission_name=permission_name, enabled=True)
    permission = db.scalar(select(Permission).where(Permission.caregiver_id == caregiver.id, Permission.permission_name == permission_name))
    if permission is None or not permission.enabled:
        raise HTTPException(403, f"{permission_name} sharing is off for this caregiver")
    return permission


def require_patient_controller(db: Session, actor_caregiver_id: int, patient_id: int) -> Caregiver:
    member = require_patient_caregiver(db, actor_caregiver_id, patient_id)
    if not is_workspace_owner(db, member):
        raise HTTPException(403, "Only the Care Circle owner can manage sharing and members")
    return member

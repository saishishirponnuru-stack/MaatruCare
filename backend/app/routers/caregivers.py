from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Caregiver, ConsentRecord, Permission
from ..schemas import CaregiverResponse
from ..services.access_service import get_active_caregiver, require_patient_controller, require_patient_caregiver, require_permission
from ..services.audit_service import record_audit
from ..services.demo_caregiver_service import demo_caregivers_available

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


class DemoCaregiverCreate(BaseModel):
	coordination_access: bool = False
	patient_id: int
	name: str = Field(min_length=1, max_length=200)
	relationship: str = Field(min_length=1, max_length=100)
	role: str = Field(pattern="^(Primary caregiver|Family caregiver|Support caregiver)$")
	email: str | None = Field(default=None, max_length=255)
	actor_caregiver_id: int


class CaregiverUpdate(BaseModel):
	name: str = Field(min_length=1, max_length=200)
	relationship: str = Field(min_length=1, max_length=100)
	actor_caregiver_id: int


@router.put("/{caregiver_id}", response_model=CaregiverResponse)
def update_caregiver(caregiver_id: int, payload: CaregiverUpdate, db: Session = Depends(get_db)):
	target = db.get(Caregiver, caregiver_id)
	if target is None: raise HTTPException(404, "Caregiver not found")
	actor = require_patient_controller(db, payload.actor_caregiver_id, target.patient_id)
	if target.is_patient or target.id == actor.id or target.access_status != "Active":
		raise HTTPException(403, "This relationship cannot be edited here")
	if not payload.name.strip() or not payload.relationship.strip() or payload.relationship.strip().lower() in {"primary caregiver", "patient", "patient controller"}:
		raise HTTPException(422, "Enter a name and a caregiver relationship")
	target.name = payload.name.strip()
	target.relationship = payload.relationship.strip()
	record_audit(db, patient_id=target.patient_id, actor_name=actor.name, action="caregiver_updated", resource_type="Caregiver", resource_id=target.id)
	db.commit()
	return target


@router.get("", response_model=list[CaregiverResponse])
def list_caregivers(
	actor_caregiver_id: int = Query(...),
	scope: Literal["Coordination tasks", "Care handoffs", "Appointments", "Approved care updates"] = "Coordination tasks",
	db: Session = Depends(get_db),
) -> list[Caregiver]:
	actor = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, actor, scope)
	return list(
		db.scalars(select(Caregiver).where(Caregiver.patient_id == actor.patient_id, Caregiver.access_status == "Active", Caregiver.is_patient.is_(False)).order_by(Caregiver.id)).all()
	)


@router.post("/demo", response_model=CaregiverResponse, status_code=status.HTTP_201_CREATED)
def create_demo_caregiver(payload: DemoCaregiverCreate, db: Session = Depends(get_db)) -> Caregiver:
	actor = require_patient_controller(db, payload.actor_caregiver_id, payload.patient_id)
	if not demo_caregivers_available(actor.patient_id, db):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulated caregivers are unavailable here")
	name = payload.name.strip()
	relationship = payload.relationship.strip()
	email = payload.email.strip().lower() if payload.email else None
	if not name or not relationship:
		raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name and relationship are required")
	duplicate = db.scalar(
		select(Caregiver).where(
			Caregiver.patient_id == payload.patient_id,
			Caregiver.is_demo.is_(True),
			func.lower(Caregiver.name) == name.lower(),
			func.lower(Caregiver.relationship) == relationship.lower(),
			Caregiver.role == payload.role,
			Caregiver.access_status == "Active",
		)
	)
	if duplicate is not None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This simulated caregiver already exists")
	from ..services.simulated_caregiver_service import add_simulated_caregiver
	try:
		caregiver = add_simulated_caregiver(db, patient_id=payload.patient_id, name=name, relationship=relationship, role=payload.role, email=email, coordination_access=payload.coordination_access, actor_name=actor.name)
		db.commit()
		db.refresh(caregiver)
		return caregiver
	except Exception:
		db.rollback()
		raise


@router.delete("/{caregiver_id}", response_model=CaregiverResponse)
def remove_caregiver(
	caregiver_id: int,
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> Caregiver:
	target = db.get(Caregiver, caregiver_id)
	if target is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found")
	actor = require_patient_controller(db, actor_caregiver_id, target.patient_id)
	if target.is_patient or target.id == actor.id:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The Care Circle owner cannot be removed")
	if target.access_status != "Active":
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Caregiver access is already revoked")
	try:
		permissions = db.scalars(select(Permission).where(Permission.caregiver_id == target.id)).all()
		for permission in permissions:
			if permission.enabled:
				permission.enabled = False
				db.add(ConsentRecord(
					patient_id=target.patient_id,
					caregiver_id=target.id,
					permission_name=permission.permission_name,
					action="revoked",
				))
		target.access_status = "Revoked"
		record_audit(
			db,
			patient_id=target.patient_id,
			actor_name=actor.name,
			action="caregiver_removed",
			resource_type="Caregiver",
			resource_id=target.id,
		)
		db.commit()
	except Exception:
		db.rollback()
		raise
	return target

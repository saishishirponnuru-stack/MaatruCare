from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Caregiver, ConsentRecord, Permission
from ..schemas import CaregiverResponse
from ..services.access_service import get_active_caregiver, require_patient_controller, require_patient_caregiver, require_permission
from ..services.audit_service import record_audit

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


@router.get("", response_model=list[CaregiverResponse])
def list_caregivers(
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> list[Caregiver]:
	actor = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, actor, "Coordination tasks")
	return list(
		db.scalars(select(Caregiver).where(Caregiver.patient_id == actor.patient_id, Caregiver.access_status == "Active").order_by(Caregiver.id)).all()
	)


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
	if target.relationship == "Primary caregiver":
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The primary caregiver relationship cannot be removed")
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

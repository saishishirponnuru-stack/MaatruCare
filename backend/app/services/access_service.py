from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Caregiver, Patient, Permission

ALLOWED_PERMISSIONS = {
	"Appointments",
	"Coordination tasks",
	"Care handoffs",
	"Approved care updates",
}


def get_active_caregiver(db: Session, caregiver_id: int) -> Caregiver:
	caregiver = db.get(Caregiver, caregiver_id)
	if caregiver is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found")
	if caregiver.access_status != "Active":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver access is not active")
	return caregiver


def require_patient_caregiver(db: Session, actor_caregiver_id: int, patient_id: int) -> Caregiver:
	if db.get(Patient, patient_id) is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
	caregiver = get_active_caregiver(db, actor_caregiver_id)
	if caregiver.patient_id != patient_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver cannot access this patient")
	return caregiver


def require_permission(db: Session, caregiver: Caregiver, permission_name: str) -> Permission:
	if permission_name not in ALLOWED_PERMISSIONS:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported permission")
	permission = db.scalar(
		select(Permission).where(
			Permission.caregiver_id == caregiver.id,
			Permission.permission_name == permission_name,
		)
	)
	if permission is None or not permission.enabled:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission is not enabled")
	return permission


def require_patient_controller(db: Session, actor_caregiver_id: int, patient_id: int) -> Caregiver:
	caregiver = require_patient_caregiver(db, actor_caregiver_id, patient_id)
	if caregiver.relationship != "Primary caregiver":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the designated patient controller can change permissions")
	return caregiver
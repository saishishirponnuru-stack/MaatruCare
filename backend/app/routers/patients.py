from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient
from ..schemas import PatientResponse
from ..services.access_service import get_active_caregiver, require_permission

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[PatientResponse])
def list_patients(
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> list[Patient]:
	caregiver = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, caregiver, "Approved care updates")
	return list(db.scalars(select(Patient).where(Patient.id == caregiver.patient_id).order_by(Patient.id)).all())

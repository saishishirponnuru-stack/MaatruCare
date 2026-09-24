from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient
from ..schemas import PatientResponse

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=list[PatientResponse])
def list_patients(db: Session = Depends(get_db)) -> list[Patient]:
	return list(db.scalars(select(Patient).order_by(Patient.id)).all())

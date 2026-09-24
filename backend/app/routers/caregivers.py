from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Caregiver
from ..schemas import CaregiverResponse

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


@router.get("", response_model=list[CaregiverResponse])
def list_caregivers(db: Session = Depends(get_db)) -> list[Caregiver]:
	return list(db.scalars(select(Caregiver).order_by(Caregiver.id)).all())

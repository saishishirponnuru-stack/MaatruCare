from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Caregiver
from ..schemas import CaregiverResponse
from ..services.access_service import get_active_caregiver, require_permission

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


@router.get("", response_model=list[CaregiverResponse])
def list_caregivers(
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> list[Caregiver]:
	actor = get_active_caregiver(db, actor_caregiver_id)
	require_permission(db, actor, "Coordination tasks")
	return list(
		db.scalars(select(Caregiver).where(Caregiver.patient_id == actor.patient_id).order_by(Caregiver.id)).all()
	)

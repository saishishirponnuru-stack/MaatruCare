from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CareHandoff
from ..schemas import CareHandoffActor, CareHandoffCreate, CareHandoffResponse
from ..services.handoff_service import (
	acknowledge_handoff,
	create_handoff,
        complete_handoff,
	get_handoff_for_actor,
	list_handoffs_for_actor,
	send_handoff,
)

router = APIRouter(prefix="/api/handoffs", tags=["handoffs"])


@router.get("", response_model=list[CareHandoffResponse])
def list_handoffs(
	actor_caregiver_id: int | None = Query(default=None),
	patient_id: int | None = Query(default=None),
	db: Session = Depends(get_db),
) -> list[CareHandoff]:
	if actor_caregiver_id is None:
		raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="actor_caregiver_id is required")
	return list_handoffs_for_actor(db, actor_caregiver_id, patient_id)


@router.post("", response_model=CareHandoffResponse, status_code=status.HTTP_201_CREATED)
def create_handoff_route(payload: CareHandoffCreate, db: Session = Depends(get_db)) -> CareHandoff:
	return create_handoff(db, **payload.model_dump())


@router.get("/{handoff_id}", response_model=CareHandoffResponse)
def get_handoff(
	handoff_id: int,
	actor_caregiver_id: int = Query(...),
	db: Session = Depends(get_db),
) -> CareHandoff:
	return get_handoff_for_actor(db, handoff_id, actor_caregiver_id)


@router.post("/{handoff_id}/send", response_model=CareHandoffResponse)
def send_handoff_route(handoff_id: int, payload: CareHandoffActor, db: Session = Depends(get_db)) -> CareHandoff:
	return send_handoff(db, handoff_id, payload.actor_caregiver_id)


@router.post("/{handoff_id}/acknowledge", response_model=CareHandoffResponse)
def acknowledge_handoff_route(handoff_id: int, payload: CareHandoffActor, db: Session = Depends(get_db)) -> CareHandoff:
	return acknowledge_handoff(db, handoff_id, payload.actor_caregiver_id)

@router.post("/{handoff_id}/complete", response_model=CareHandoffResponse)
def complete_handoff_route(
        handoff_id: int,
        payload: CareHandoffActor,
        db: Session = Depends(get_db),
) -> CareHandoff:
        return complete_handoff(db, handoff_id, payload.actor_caregiver_id)



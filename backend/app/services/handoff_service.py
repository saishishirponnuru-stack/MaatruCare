from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CareHandoff, Caregiver, Patient
from .access_service import require_patient_caregiver, require_permission
from .audit_service import record_audit, record_timeline_event

PREPARED = "Prepared"
SENT = "Awaiting acknowledgement"
ACKNOWLEDGED = "Acknowledged"
CANCELLED = "Cancelled"


def _get_patient(db: Session, patient_id: int) -> Patient:
	patient = db.get(Patient, patient_id)
	if patient is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
	return patient


def _get_caregiver(db: Session, caregiver_id: int, patient_id: int) -> Caregiver:
	try:
		return require_patient_caregiver(db, caregiver_id, patient_id)
	except HTTPException as error:
		if error.status_code == status.HTTP_404_NOT_FOUND:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caregiver not found for patient") from error
		raise


def _get_handoff(db: Session, handoff_id: int) -> CareHandoff:
	handoff = db.get(CareHandoff, handoff_id)
	if handoff is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handoff not found")
	return handoff


def _require_actor(db: Session, handoff: CareHandoff, actor_caregiver_id: int) -> Caregiver:
	return _get_caregiver(db, actor_caregiver_id, handoff.patient_id)


def create_handoff(
	db: Session,
	*,
	patient_id: int,
	title: str,
	from_caregiver_id: int,
	to_caregiver_id: int,
	reason: str,
	actor_caregiver_id: int,
) -> CareHandoff:
	if not title.strip() or not reason.strip():
		raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title and reason are required")
	if from_caregiver_id == to_caregiver_id:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sender and recipient must differ")
	_get_patient(db, patient_id)
	sender = _get_caregiver(db, from_caregiver_id, patient_id)
	recipient = _get_caregiver(db, to_caregiver_id, patient_id)
	if actor_caregiver_id != from_caregiver_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Actor must be the handoff sender")
	require_permission(db, sender, "Care handoffs")
	require_permission(db, recipient, "Care handoffs")

	handoff = CareHandoff(
		patient_id=patient_id,
		title=title.strip(),
		from_caregiver_id=from_caregiver_id,
		to_caregiver_id=to_caregiver_id,
		reason=reason.strip(),
		status=PREPARED,
	)
	try:
		db.add(handoff)
		db.flush()
		record_audit(db, patient_id=patient_id, actor_name=sender.name, action="handoff_created", resource_id=handoff.id)
		record_timeline_event(db, patient_id=patient_id, event_type="Coordination", title="Care handoff prepared", description="A coordination responsibility handoff was prepared.", source="Care handoff")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return handoff


def send_handoff(db: Session, handoff_id: int, actor_caregiver_id: int) -> CareHandoff:
	handoff = _get_handoff(db, handoff_id)
	actor = _require_actor(db, handoff, actor_caregiver_id)
	require_permission(db, actor, "Care handoffs")
	if actor.id != handoff.from_caregiver_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the sender can send this handoff")
	if handoff.status != PREPARED:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff cannot be sent from its current state")
	try:
		handoff.status = SENT
		record_audit(db, patient_id=handoff.patient_id, actor_name=actor.name, action="handoff_sent", resource_id=handoff.id)
		record_timeline_event(db, patient_id=handoff.patient_id, event_type="Coordination", title="Care handoff sent", description="A coordination responsibility handoff was sent to an approved caregiver.", source="Care handoff")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return handoff


def acknowledge_handoff(db: Session, handoff_id: int, actor_caregiver_id: int) -> CareHandoff:
	handoff = _get_handoff(db, handoff_id)
	actor = _require_actor(db, handoff, actor_caregiver_id)
	require_permission(db, actor, "Care handoffs")
	if actor.id != handoff.to_caregiver_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the intended recipient can acknowledge this handoff")
	if handoff.status == ACKNOWLEDGED or handoff.acknowledged_at is not None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff has already been acknowledged")
	if handoff.status != SENT:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handoff cannot be acknowledged from its current state")
	try:
		handoff.status = ACKNOWLEDGED
		handoff.acknowledged_at = datetime.utcnow()
		record_audit(db, patient_id=handoff.patient_id, actor_name=actor.name, action="handoff_acknowledged", resource_id=handoff.id)
		record_timeline_event(db, patient_id=handoff.patient_id, event_type="Coordination", title="Care handoff acknowledged", description="The intended caregiver acknowledged a coordination responsibility handoff.", source="Care handoff")
		db.commit()
	except Exception:
		db.rollback()
		raise
	return handoff


def get_handoff_for_actor(db: Session, handoff_id: int, actor_caregiver_id: int) -> CareHandoff:
	handoff = _get_handoff(db, handoff_id)
	actor = _require_actor(db, handoff, actor_caregiver_id)
	require_permission(db, actor, "Care handoffs")
	if actor.id not in {handoff.from_caregiver_id, handoff.to_caregiver_id}:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver is not a participant in this handoff")
	return handoff


def list_handoffs_for_actor(db: Session, actor_caregiver_id: int, patient_id: int | None = None) -> list[CareHandoff]:
	caregiver = db.get(Caregiver, actor_caregiver_id)
	if caregiver is None or caregiver.access_status != "Active":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver access is not active")
	require_permission(db, caregiver, "Care handoffs")
	query = select(CareHandoff).where(
		CareHandoff.patient_id == caregiver.patient_id,
		(CareHandoff.from_caregiver_id == actor_caregiver_id) | (CareHandoff.to_caregiver_id == actor_caregiver_id),
	)
	if patient_id is not None and patient_id != caregiver.patient_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caregiver cannot access this patient")
	return list(db.scalars(query.order_by(CareHandoff.id)).all())

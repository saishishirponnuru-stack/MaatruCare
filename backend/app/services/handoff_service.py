from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session, joinedload

from ..models import CareHandoff, Patient, Task
from .access_service import get_active_caregiver, get_patient_member, is_workspace_owner, require_patient_caregiver, require_patient_controller, require_permission
from .audit_service import record_audit, record_timeline_event

PREPARED = "Prepared"
SENT = "Awaiting acknowledgement"
ACKNOWLEDGED = "Acknowledged"
COMPLETED = "Completed"
CANCELLED = "Cancelled"


def _get_handoff(db, handoff_id):
    handoff = db.get(CareHandoff, handoff_id)
    if handoff is None:
        raise HTTPException(404, "Handoff not found")
    return handoff


def _require_actor(db, handoff, actor_id):
    return require_patient_caregiver(db, actor_id, handoff.patient_id)


def _usable(handoff):
    if handoff.archived_at is not None or handoff.status == CANCELLED:
        raise HTTPException(409, "This handoff has been removed from active responsibilities")


def _record_transition(db, handoff, actor, expected, values, action, title, description):
    # Compare-and-set protects against double clicks and concurrent transitions.
    changed = db.execute(update(CareHandoff).where(
        CareHandoff.id == handoff.id, CareHandoff.status == expected,
        CareHandoff.archived_at.is_(None),
    ).values(**values).execution_options(synchronize_session=False))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "The handoff changed. Refresh before trying again.")
    try:
        record_audit(db, patient_id=handoff.patient_id, actor_name=actor.name, action=action, resource_id=handoff.id)
        record_timeline_event(db, patient_id=handoff.patient_id, event_type="Coordination", title=title, description=description, source="Care handoff")
        db.commit()
        db.refresh(handoff)
    except Exception:
        db.rollback()
        raise
    return handoff


def create_handoff(db: Session, *, patient_id: int, title: str, from_caregiver_id: int, to_caregiver_id: int, reason: str, actor_caregiver_id: int, context: str | None = None, related_task_id: int | None = None, ai_draft_id: int | None = None, human_approved: bool = False):
    if not title.strip() or not reason.strip():
        raise HTTPException(422, "Title and responsibility are required")
    if from_caregiver_id == to_caregiver_id:
        raise HTTPException(400, "Sender and recipient must differ")
    if db.get(Patient, patient_id) is None:
        raise HTTPException(404, "Care workspace not found")
    actor = require_patient_caregiver(db, actor_caregiver_id, patient_id)
    sender = get_patient_member(db, from_caregiver_id, patient_id)
    recipient = get_patient_member(db, to_caregiver_id, patient_id)
    if actor.id != sender.id and not (sender.is_demo and is_workspace_owner(db, actor)):
        raise HTTPException(403, "Actor must be the handoff sender")
    for participant in (actor, sender, recipient):
        require_permission(db, participant, "Care handoffs")
    if related_task_id is not None:
        task = db.get(Task, related_task_id)
        if task is None or task.patient_id != patient_id:
            raise HTTPException(422, "Choose a task from this care workspace")
        require_permission(db, actor, "Coordination tasks")
        require_permission(db, recipient, "Coordination tasks")
    if ai_draft_id is not None:
        from .ai_draft_service import validate_handoff_approval
        existing = validate_handoff_approval(db, ai_draft_id, human_approved, patient_id)
        if existing is not None:
            same_request = (
                existing.patient_id == patient_id
                and existing.from_caregiver_id == sender.id
                and existing.to_caregiver_id == recipient.id
                and existing.title == title.strip()
                and existing.reason == reason.strip()
                and existing.context == context
                and existing.related_task_id == related_task_id
            )
            if not same_request:
                raise HTTPException(
                    409,
                    "This AI draft already has a handoff with different details. "
                    "No new handoff was created. Review the existing handoff "
                    "before making another assignment.",
                )
            return existing
    handoff = CareHandoff(patient_id=patient_id, title=title.strip(), from_caregiver_id=sender.id, to_caregiver_id=recipient.id, reason=reason.strip(), status=PREPARED, context=context, related_task_id=related_task_id, ai_draft_id=ai_draft_id)
    try:
        db.add(handoff)
        db.flush()
        if ai_draft_id is not None:
            from .ai_draft_service import record_handoff_approval
            record_handoff_approval(db, ai_draft_id, handoff, actor.name)
        record_audit(db, patient_id=patient_id, actor_name=actor.name, action="handoff_created", resource_id=handoff.id)
        record_timeline_event(db, patient_id=patient_id, event_type="Coordination", title="Care handoff prepared", description=f"{handoff.title}: {sender.name} to {recipient.name}.", source="Care handoff")
        db.commit()
    except Exception:
        db.rollback()
        raise
    return handoff


def send_handoff(db: Session, handoff_id: int, actor_caregiver_id: int):
    handoff = _get_handoff(db, handoff_id)
    actor = _require_actor(db, handoff, actor_caregiver_id)
    require_permission(db, actor, "Care handoffs")
    _usable(handoff)
    sender = get_patient_member(db, handoff.from_caregiver_id, handoff.patient_id)
    if actor.id != sender.id and not (sender.is_demo and is_workspace_owner(db, actor)):
        raise HTTPException(403, "Only the sender can send this handoff")
    require_permission(db, sender, "Care handoffs")
    require_permission(db, get_patient_member(db, handoff.to_caregiver_id, handoff.patient_id), "Care handoffs")
    if handoff.status != PREPARED:
        raise HTTPException(409, "Only a prepared handoff can be sent")
    return _record_transition(db, handoff, actor, PREPARED, {"status": SENT, "sent_at": datetime.utcnow()}, "handoff_sent", "Care handoff sent", f"{handoff.title} was sent to {handoff.to_name}.")


def _recipient_actor(db, handoff, actor_id):
    actor = _require_actor(db, handoff, actor_id)
    require_permission(db, actor, "Care handoffs")
    recipient = get_patient_member(db, handoff.to_caregiver_id, handoff.patient_id)
    simulated = bool(recipient.is_demo and is_workspace_owner(db, actor))
    if actor.id != recipient.id and not simulated:
        raise HTTPException(403, "Only the intended recipient can acknowledge this handoff")
    require_permission(db, recipient, "Care handoffs")
    _usable(handoff)
    return actor, simulated


def acknowledge_handoff(db: Session, handoff_id: int, actor_caregiver_id: int):
    handoff = _get_handoff(db, handoff_id)
    actor, simulated = _recipient_actor(db, handoff, actor_caregiver_id)
    if handoff.status != SENT or handoff.acknowledged_at is not None:
        raise HTTPException(409, "Only a sent handoff can be acknowledged once")
    return _record_transition(db, handoff, actor, SENT, {"status": ACKNOWLEDGED, "acknowledged_at": datetime.utcnow()}, "handoff_acknowledged_simulated" if simulated else "handoff_acknowledged", "Care handoff acknowledged (simulation)" if simulated else "Care handoff acknowledged", f"{handoff.title}: acknowledgement recorded" + (" by the Care Circle owner for a simulated caregiver." if simulated else f" by {handoff.to_name}."))


def complete_handoff(db: Session, handoff_id: int, actor_caregiver_id: int):
    handoff = _get_handoff(db, handoff_id)
    actor, simulated = _recipient_actor(db, handoff, actor_caregiver_id)
    if handoff.status != ACKNOWLEDGED:
        raise HTTPException(409, "Only an acknowledged handoff can be completed")
    return _record_transition(db, handoff, actor, ACKNOWLEDGED, {"status": COMPLETED, "completed_at": datetime.utcnow()}, "handoff_completed_simulated" if simulated else "handoff_completed", "Care handoff completed (simulation)" if simulated else "Care handoff completed", f"{handoff.title}: completion recorded" + (" by the Care Circle owner for a simulated caregiver." if simulated else f" by {handoff.to_name}."))


def remove_handoff(db: Session, handoff_id: int, actor_caregiver_id: int, expected_status: str):
    handoff = _get_handoff(db, handoff_id)
    actor = require_patient_controller(db, actor_caregiver_id, handoff.patient_id)
    _usable(handoff)
    if handoff.status != expected_status:
        raise HTTPException(409, "The handoff changed. Review its current status before removing it.")
    archive = handoff.status == COMPLETED
    values = {"archived_at": datetime.utcnow()} if archive else {"status": CANCELLED, "cancelled_at": datetime.utcnow()}
    return _record_transition(db, handoff, actor, expected_status, values, "handoff_archived" if archive else "handoff_cancelled", "Care handoff archived" if archive else "Care handoff cancelled", f"{handoff.title} was removed from active responsibilities. Its history is retained.")


def get_handoff_for_actor(db: Session, handoff_id: int, actor_caregiver_id: int):
    handoff = _get_handoff(db, handoff_id)
    actor = _require_actor(db, handoff, actor_caregiver_id)
    require_permission(db, actor, "Care handoffs")
    if not is_workspace_owner(db, actor) and actor.id not in {handoff.from_caregiver_id, handoff.to_caregiver_id}:
        raise HTTPException(403, "Caregiver is not a participant in this handoff")
    return handoff


def list_handoffs_for_actor(db: Session, actor_caregiver_id: int, patient_id: int | None = None, include_archived: bool = False):
    actor = get_active_caregiver(db, actor_caregiver_id)
    require_permission(db, actor, "Care handoffs")
    if patient_id is not None and patient_id != actor.patient_id:
        raise HTTPException(403, "This handoff belongs to a different care workspace")
    query = select(CareHandoff).options(joinedload(CareHandoff.from_caregiver), joinedload(CareHandoff.to_caregiver)).where(CareHandoff.patient_id == actor.patient_id)
    if not include_archived:
        query = query.where(CareHandoff.archived_at.is_(None))
    if not is_workspace_owner(db, actor):
        query = query.where((CareHandoff.from_caregiver_id == actor.id) | (CareHandoff.to_caregiver_id == actor.id))
    return list(db.scalars(query.order_by(CareHandoff.id)).all())

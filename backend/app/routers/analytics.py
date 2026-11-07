import os
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Account, Caregiver, Patient, Permission, Task, Appointment
from ..services.access_service import effective_permissions, require_patient_caregiver
from ..services.handoff_service import list_handoffs_for_actor

def local_date(value=None):
    zone = ZoneInfo(os.getenv("MAATRUCARE_TIMEZONE", "Asia/Kolkata"))
    return (value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value or datetime.now(timezone.utc)).astimezone(zone).date()


router = APIRouter(prefix="/api/analytics", tags=["coordination analytics"])


def permitted_categories(db, actor):
    return effective_permissions(db, actor)


@router.get("")
def analytics(patient_id: int, actor_caregiver_id: int, start: date, end: date, db: Session = Depends(get_db)):
    actor = require_patient_caregiver(db, actor_caregiver_id, patient_id)
    if end < start or (end - start).days > 366:
        raise HTTPException(422, "Choose a valid period of up to one year")
    permissions = permitted_categories(db, actor)
    task_stats = None
    handoff_stats = None
    if "Coordination tasks" in permissions:
        tasks = list(db.scalars(select(Task).where(Task.patient_id == patient_id)).all())
        period = [task for task in tasks if start <= local_date(task.created_at) <= end]
        task_stats = {"eligible": len(period), "simulated_tasks": sum(bool(task.owner and task.owner.is_demo) for task in period), "completed": sum(task.status == "Completed" for task in period), "pending": sum(task.status != "Completed" for task in tasks), "overdue": sum(task.status != "Completed" and task.due_date < local_date() for task in tasks)}
    if "Care handoffs" in permissions:
        handoffs = list_handoffs_for_actor(db, actor.id, patient_id)
        sent = [handoff for handoff in handoffs if handoff.status != "Cancelled" and handoff.sent_at and start <= local_date(handoff.sent_at) <= end]
        acknowledged = [handoff for handoff in sent if handoff.acknowledged_at and handoff.status in {"Acknowledged", "Completed"}]
        real = [handoff for handoff in acknowledged if not handoff.to_is_demo and handoff.acknowledged_at >= handoff.sent_at]
        handoff_stats = {"sent": len(sent), "acknowledged": len(acknowledged), "simulated_acknowledgements": sum(handoff.to_is_demo for handoff in acknowledged), "average_acknowledgement_minutes": round(sum((handoff.acknowledged_at - handoff.sent_at).total_seconds() / 60 for handoff in real) / len(real), 1) if real else None, "qualifying_real_acknowledgements": len(real)}
    members = db.scalars(select(Caregiver).where(Caregiver.patient_id == patient_id, Caregiver.access_status == "Active", Caregiver.is_patient.is_(False))).all() if permissions else []
    genuine = set(db.scalars(select(Account.caregiver_id).where(Account.patient_id == patient_id, Account.role == "caregiver")).all())
    return {"start": start, "end": end, "tasks": task_stats, "handoffs": handoff_stats, "caregivers": {"accepted": sum(member.id in genuine and not member.is_demo for member in members), "simulated": sum(member.is_demo for member in members)}}


@router.get("/facts")
def coordination_facts(patient_id: int, actor_caregiver_id: int, db: Session = Depends(get_db)):
    actor = require_patient_caregiver(db, actor_caregiver_id, patient_id)
    permissions = permitted_categories(db, actor)
    tasks = db.scalars(select(Task).where(Task.patient_id == patient_id, Task.status != "Completed").order_by(Task.due_date, Task.id)).all() if "Coordination tasks" in permissions else []
    handoffs = [item for item in list_handoffs_for_actor(db, actor.id, patient_id) if item.status not in {"Completed", "Cancelled"}] if "Care handoffs" in permissions else []
    appointments = db.scalars(select(Appointment).where(Appointment.patient_id == patient_id, Appointment.appointment_date >= local_date(), Appointment.status.not_in(["Cancelled", "Completed"])).order_by(Appointment.appointment_date, Appointment.appointment_time)).all() if "Appointments" in permissions else []
    patient = db.get(Patient, patient_id)
    return {"source": "Saved records only. No data sent to an external model.", "available_categories": sorted(permissions), "tasks": [{"id": item.id, "title": item.title, "owner": item.owner.name if item.owner else patient.name if item.owner_patient_id else "Unassigned", "simulated": bool(item.owner and item.owner.is_demo), "due_date": item.due_date, "status": item.status} for item in tasks], "handoffs": [{"id": item.id, "title": item.title, "recipient": item.to_name, "simulated": item.to_is_demo, "status": item.status} for item in handoffs], "appointments": [{"id": item.id, "title": item.title, "date": item.appointment_date, "time": item.appointment_time, "location": item.location} for item in appointments]}

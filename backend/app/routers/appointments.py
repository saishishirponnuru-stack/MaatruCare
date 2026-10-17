from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment
from ..schemas import AppointmentAction, AppointmentCreate, AppointmentResponse, AppointmentUpdate
from ..services.access_service import get_active_caregiver, require_patient_caregiver, require_permission
from ..services.audit_service import record_audit

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentResponse])
def list_appointments(
    actor_caregiver_id: int = Query(...),
    db: Session = Depends(get_db),
) -> list[Appointment]:
    actor = get_active_caregiver(db, actor_caregiver_id)
    require_permission(db, actor, "Appointments")
    return list(
        db.scalars(
            select(Appointment)
            .where(Appointment.patient_id == actor.patient_id)
            .order_by(Appointment.appointment_date, Appointment.appointment_time, Appointment.id)
        ).all()
    )


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)) -> Appointment:
    actor = require_patient_caregiver(db, payload.actor_caregiver_id, payload.patient_id)
    require_permission(db, actor, "Appointments")
    if not payload.title.strip() or not payload.clinician_name.strip() or not payload.location.strip():
        raise HTTPException(status_code=422, detail="Appointment title, clinician, and location are required")
    if payload.status not in {"Confirmed", "Cancelled"}:
        raise HTTPException(status_code=400, detail="Unsupported appointment status")
    try:
        appointment = Appointment(patient_id=payload.patient_id, title=payload.title.strip(), clinician_name=payload.clinician_name.strip(), location=payload.location.strip(), appointment_date=payload.appointment_date, appointment_time=payload.appointment_time, status=payload.status)
        db.add(appointment)
        db.flush()
        record_audit(db, patient_id=payload.patient_id, actor_name=actor.name, action="appointment_created", resource_type="Appointment", resource_id=appointment.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return appointment


@router.put("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(appointment_id: int, payload: AppointmentUpdate, db: Session = Depends(get_db)) -> Appointment:
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    actor = require_patient_caregiver(db, payload.actor_caregiver_id, appointment.patient_id)
    require_permission(db, actor, "Appointments")
    values = payload.model_dump(exclude_unset=True)
    values.pop("actor_caregiver_id", None)
    if "status" in values and values["status"] not in {"Confirmed", "Cancelled"}:
        raise HTTPException(status_code=400, detail="Unsupported appointment status")
    for key, value in values.items():
        if isinstance(value, str) and not value.strip():
            raise HTTPException(status_code=422, detail=f"{key} cannot be empty")
        setattr(appointment, key, value.strip() if isinstance(value, str) else value)
    try:
        record_audit(db, patient_id=appointment.patient_id, actor_name=actor.name, action="appointment_updated", resource_type="Appointment", resource_id=appointment.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return appointment


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(appointment_id: int, payload: AppointmentAction, db: Session = Depends(get_db)) -> Appointment:
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    actor = require_patient_caregiver(db, payload.actor_caregiver_id, appointment.patient_id)
    require_permission(db, actor, "Appointments")
    if appointment.status == "Cancelled":
        raise HTTPException(status_code=409, detail="Appointment is already cancelled")
    appointment.status = "Cancelled"
    try:
        record_audit(db, patient_id=appointment.patient_id, actor_name=actor.name, action="appointment_cancelled", resource_type="Appointment", resource_id=appointment.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return appointment

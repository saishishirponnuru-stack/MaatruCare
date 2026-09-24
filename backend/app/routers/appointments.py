from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment
from ..schemas import AppointmentResponse

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentResponse])
def list_appointments(db: Session = Depends(get_db)) -> list[Appointment]:
    return list(db.scalars(select(Appointment).order_by(Appointment.appointment_date, Appointment.appointment_time, Appointment.id)).all())

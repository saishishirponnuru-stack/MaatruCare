from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from .database import Base


class Patient(Base):
	__tablename__ = "patients"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	name: Mapped[str] = mapped_column(String(200), nullable=False)
	email: Mapped[str | None] = mapped_column(String(255))
	phone: Mapped[str | None] = mapped_column(String(50))
	current_phase: Mapped[str] = mapped_column(String(100), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	caregivers: Mapped[list["Caregiver"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")
	tasks: Mapped[list["Task"]] = orm_relationship(back_populates="patient", foreign_keys="Task.patient_id", cascade="all, delete-orphan")
	appointments: Mapped[list["Appointment"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")
	handoffs: Mapped[list["CareHandoff"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")
	timeline_events: Mapped[list["TimelineEvent"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")
	consent_records: Mapped[list["ConsentRecord"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")
	audit_logs: Mapped[list["AuditLog"]] = orm_relationship(back_populates="patient", cascade="all, delete-orphan")


class Caregiver(Base):
	__tablename__ = "caregivers"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	name: Mapped[str] = mapped_column(String(200), nullable=False)
	relationship: Mapped[str] = mapped_column(String(100), nullable=False)
	email: Mapped[str | None] = mapped_column(String(255))
	access_status: Mapped[str] = mapped_column(String(50), default="Active", nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="caregivers")
	permissions: Mapped[list["Permission"]] = orm_relationship(back_populates="caregiver", cascade="all, delete-orphan")
	owned_tasks: Mapped[list["Task"]] = orm_relationship(back_populates="owner", foreign_keys="Task.owner_id")
	outgoing_handoffs: Mapped[list["CareHandoff"]] = orm_relationship(foreign_keys="CareHandoff.from_caregiver_id", back_populates="from_caregiver")
	incoming_handoffs: Mapped[list["CareHandoff"]] = orm_relationship(foreign_keys="CareHandoff.to_caregiver_id", back_populates="to_caregiver")
	consent_records: Mapped[list["ConsentRecord"]] = orm_relationship(back_populates="caregiver")


class Permission(Base):
	__tablename__ = "permissions"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"), nullable=False)
	permission_name: Mapped[str] = mapped_column(String(100), nullable=False)
	enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
	updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

	caregiver: Mapped[Caregiver] = orm_relationship(back_populates="permissions")


class Task(Base):
	__tablename__ = "tasks"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	title: Mapped[str] = mapped_column(String(255), nullable=False)
	owner_id: Mapped[int | None] = mapped_column(ForeignKey("caregivers.id"))
	owner_patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"))
	due_date: Mapped[date] = mapped_column(Date, nullable=False)
	category: Mapped[str] = mapped_column(String(100), nullable=False)
	status: Mapped[str] = mapped_column(String(50), default="Open", nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
	completed_at: Mapped[datetime | None] = mapped_column(DateTime)

	patient: Mapped[Patient] = orm_relationship(back_populates="tasks", foreign_keys=[patient_id])
	owner: Mapped[Caregiver | None] = orm_relationship(back_populates="owned_tasks", foreign_keys=[owner_id])
	owner_patient: Mapped[Patient | None] = orm_relationship(foreign_keys=[owner_patient_id])


class Appointment(Base):
	__tablename__ = "appointments"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	title: Mapped[str] = mapped_column(String(255), nullable=False)
	clinician_name: Mapped[str] = mapped_column(String(200), nullable=False)
	location: Mapped[str] = mapped_column(String(255), nullable=False)
	appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
	appointment_time: Mapped[time] = mapped_column(Time, nullable=False)
	status: Mapped[str] = mapped_column(String(50), nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="appointments")


class CareHandoff(Base):
	__tablename__ = "care_handoffs"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	title: Mapped[str] = mapped_column(String(255), nullable=False)
	from_caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"), nullable=False)
	to_caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"), nullable=False)
	reason: Mapped[str] = mapped_column(Text, nullable=False)
	status: Mapped[str] = mapped_column(String(50), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
	acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime)

	patient: Mapped[Patient] = orm_relationship(back_populates="handoffs")
	from_caregiver: Mapped[Caregiver] = orm_relationship(foreign_keys=[from_caregiver_id], back_populates="outgoing_handoffs")
	to_caregiver: Mapped[Caregiver] = orm_relationship(foreign_keys=[to_caregiver_id], back_populates="incoming_handoffs")


class ConsentRecord(Base):
	__tablename__ = "consent_records"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"), nullable=False)
	permission_name: Mapped[str] = mapped_column(String(100), nullable=False)
	action: Mapped[str] = mapped_column(String(50), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="consent_records")
	caregiver: Mapped[Caregiver] = orm_relationship(back_populates="consent_records")


class TimelineEvent(Base):
	__tablename__ = "timeline_events"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	event_type: Mapped[str] = mapped_column(String(100), nullable=False)
	title: Mapped[str] = mapped_column(String(255), nullable=False)
	description: Mapped[str | None] = mapped_column(Text)
	event_date: Mapped[date] = mapped_column(Date, nullable=False)
	source: Mapped[str | None] = mapped_column(String(255))
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="timeline_events")


class AuditLog(Base):
	__tablename__ = "audit_logs"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	actor_name: Mapped[str] = mapped_column(String(200), nullable=False)
	action: Mapped[str] = mapped_column(String(100), nullable=False)
	resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
	resource_id: Mapped[int] = mapped_column(Integer, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="audit_logs")

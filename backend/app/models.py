from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from .database import Base


class Account(Base):
	__tablename__ = "accounts"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
	role: Mapped[str] = mapped_column(String(30), nullable=False)
	name: Mapped[str] = mapped_column(String(200), nullable=False)
	email: Mapped[str | None] = mapped_column(String(255))
	phone: Mapped[str | None] = mapped_column(String(32))
	patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"))
	caregiver_id: Mapped[int | None] = mapped_column(ForeignKey("caregivers.id"))
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CaregiverInvitation(Base):
	__tablename__ = "caregiver_invitations"

	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False)
	email: Mapped[str] = mapped_column(String(255), nullable=False)
	name: Mapped[str | None] = mapped_column(String(200))
	relationship: Mapped[str] = mapped_column(String(100), default="Family caregiver", nullable=False)
	created_by_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
	accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
	withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime)
	email_status: Mapped[str] = mapped_column(String(30), default="not_requested", nullable=False)
	email_accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
	provider_message_id: Mapped[str | None] = mapped_column(String(255))
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


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
	role: Mapped[str] = mapped_column(String(100), default="Caregiver", nullable=False)
	is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
	# Compatibility principal for patient actions; never a caregiver relationship.
	is_patient: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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
	note: Mapped[str | None] = mapped_column(Text)
	priority: Mapped[str] = mapped_column(String(20), default="Normal", nullable=False)
	ai_draft_id: Mapped[int | None] = mapped_column(ForeignKey("ai_drafts.id"))
	ai_suggestion_index: Mapped[int | None] = mapped_column(Integer)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
	completed_at: Mapped[datetime | None] = mapped_column(DateTime)

	patient: Mapped[Patient] = orm_relationship(back_populates="tasks", foreign_keys=[patient_id])
	owner: Mapped[Caregiver | None] = orm_relationship(back_populates="owned_tasks", foreign_keys=[owner_id])
	owner_patient: Mapped[Patient | None] = orm_relationship(foreign_keys=[owner_patient_id])


	@property
	def owner_name(self) -> str | None:
		return self.owner.name if self.owner else None

	@property
	def owner_is_demo(self) -> bool:
		return bool(self.owner and self.owner.is_demo)


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
	context: Mapped[str | None] = mapped_column(Text)
	related_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
	ai_draft_id: Mapped[int | None] = mapped_column(ForeignKey("ai_drafts.id"))
	status: Mapped[str] = mapped_column(String(50), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
	acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime)
	sent_at: Mapped[datetime | None] = mapped_column(DateTime)
	completed_at: Mapped[datetime | None] = mapped_column(DateTime)
	cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
	archived_at: Mapped[datetime | None] = mapped_column(DateTime)

	patient: Mapped[Patient] = orm_relationship(back_populates="handoffs")
	from_caregiver: Mapped[Caregiver] = orm_relationship(foreign_keys=[from_caregiver_id], back_populates="outgoing_handoffs")
	to_caregiver: Mapped[Caregiver] = orm_relationship(foreign_keys=[to_caregiver_id], back_populates="incoming_handoffs")

	@property
	def from_name(self) -> str:
		return self.from_caregiver.name

	@property
	def to_name(self) -> str:
		return self.to_caregiver.name

	@property
	def from_is_demo(self) -> bool:
		return self.from_caregiver.is_demo

	@property
	def to_is_demo(self) -> bool:
		return self.to_caregiver.is_demo


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
	actor_name: Mapped[str | None] = mapped_column(String(200))
	resource_type: Mapped[str | None] = mapped_column(String(100))
	resource_id: Mapped[int | None] = mapped_column(Integer)
	simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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
	actor_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
	actor_subject: Mapped[str | None] = mapped_column(String(255))
	actor_caregiver_id: Mapped[int | None] = mapped_column(ForeignKey("caregivers.id"))
	simulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

	patient: Mapped[Patient] = orm_relationship(back_populates="audit_logs")


class AIDraft(Base):
	__tablename__ = "ai_drafts"
	id: Mapped[int] = mapped_column(Integer, primary_key=True)
	patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
	account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
	operation: Mapped[str] = mapped_column(String(40), nullable=False)
	status: Mapped[str] = mapped_column(String(20), default="Ready", nullable=False)
	source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
	output_json: Mapped[str] = mapped_column(Text, nullable=False)
	review_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

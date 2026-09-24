from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class ORMResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)


class PatientResponse(ORMResponse):
	id: int
	name: str
	email: str | None
	phone: str | None
	current_phase: str
	created_at: datetime


class CaregiverResponse(ORMResponse):
	id: int
	patient_id: int
	name: str
	relationship: str
	email: str | None
	access_status: str
	created_at: datetime


class PermissionResponse(ORMResponse):
	id: int
	caregiver_id: int
	permission_name: str
	enabled: bool
	updated_at: datetime


class TaskResponse(ORMResponse):
	id: int
	patient_id: int
	title: str
	owner_id: int | None
	owner_patient_id: int | None
	due_date: date
	category: str
	status: str
	created_at: datetime
	completed_at: datetime | None


class AppointmentResponse(ORMResponse):
	id: int
	patient_id: int
	title: str
	clinician_name: str
	location: str
	appointment_date: date
	appointment_time: time
	status: str


class CareHandoffResponse(ORMResponse):
	id: int
	patient_id: int
	title: str
	from_caregiver_id: int
	to_caregiver_id: int
	reason: str
	status: str
	created_at: datetime
	acknowledged_at: datetime | None


class ConsentRecordResponse(ORMResponse):
	id: int
	patient_id: int
	caregiver_id: int
	permission_name: str
	action: str
	created_at: datetime


class TimelineEventResponse(ORMResponse):
	id: int
	patient_id: int
	event_type: str
	title: str
	description: str | None
	event_date: date
	source: str | None
	created_at: datetime


class AuditLogResponse(ORMResponse):
	id: int
	patient_id: int
	actor_name: str
	action: str
	resource_type: str
	resource_id: int
	created_at: datetime

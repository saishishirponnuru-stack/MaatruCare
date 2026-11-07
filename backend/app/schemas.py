from datetime import date, datetime, time

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


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
	is_patient: bool = False
	id: int
	patient_id: int
	name: str
	relationship: str
	role: str
	is_demo: bool
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
	owner_name: str | None = None
	owner_is_demo: bool = False
	note: str | None = None
	priority: str = "Normal"
	ai_draft_id: int | None = None
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


class TaskCreate(BaseModel):
	patient_id: int
	title: str = Field(min_length=1, max_length=255)
	note: str | None = Field(default=None, max_length=2000)
	priority: Literal["Low", "Normal", "High"] = "Normal"
	ai_draft_id: int | None = None
	ai_suggestion_index: int | None = Field(default=None, ge=0)
	human_approved: bool = False
	owner_id: int | None = None
	owner_patient_id: int | None = None
	due_date: date
	category: str
	actor_caregiver_id: int


class TaskUpdate(BaseModel):
	note: str | None = Field(default=None, max_length=2000)
	priority: Literal["Low", "Normal", "High"] | None = None
	status: Literal["Open", "In progress", "Completed"] | None = None
	title: str | None = None
	owner_id: int | None = None
	owner_patient_id: int | None = None
	due_date: date | None = None
	category: str | None = None
	actor_caregiver_id: int


class TaskCompletion(BaseModel):
	actor_caregiver_id: int
	completed: bool = True


class AppointmentResponse(ORMResponse):
	id: int
	patient_id: int
	title: str
	clinician_name: str
	location: str
	appointment_date: date
	appointment_time: time
	status: str


class AppointmentCreate(BaseModel):
	patient_id: int
	title: str
	clinician_name: str
	location: str
	appointment_date: date
	appointment_time: time
	status: str = "Confirmed"
	actor_caregiver_id: int


class AppointmentUpdate(BaseModel):
	title: str | None = None
	clinician_name: str | None = None
	location: str | None = None
	appointment_date: date | None = None
	appointment_time: time | None = None
	status: str | None = None
	actor_caregiver_id: int


class AppointmentAction(BaseModel):
	actor_caregiver_id: int


class CareHandoffResponse(ORMResponse):
	cancelled_at: datetime | None = None
	archived_at: datetime | None = None
	context: str | None = None
	related_task_id: int | None = None
	ai_draft_id: int | None = None
	from_name: str
	to_name: str
	from_is_demo: bool
	to_is_demo: bool
	sent_at: datetime | None = None
	completed_at: datetime | None = None
	id: int
	patient_id: int
	title: str
	from_caregiver_id: int
	to_caregiver_id: int
	reason: str
	status: str
	created_at: datetime
	acknowledged_at: datetime | None


class CareHandoffCreate(BaseModel):
	context: str | None = Field(default=None, max_length=2000)
	related_task_id: int | None = None
	ai_draft_id: int | None = None
	human_approved: bool = False
	patient_id: int
	title: str = Field(min_length=1, max_length=255)
	from_caregiver_id: int
	to_caregiver_id: int
	reason: str = Field(min_length=1, max_length=2000)
	actor_caregiver_id: int


class CareHandoffActor(BaseModel):
	actor_caregiver_id: int


class PermissionUpdate(BaseModel):
	patient_id: int
	caregiver_id: int
	permission_name: str
	enabled: bool
	actor_caregiver_id: int


class ConsentRecordResponse(ORMResponse):
	id: int
	patient_id: int
	caregiver_id: int
	permission_name: str
	action: str
	created_at: datetime


class TimelineEventResponse(ORMResponse):
	actor_name: str | None = None
	resource_type: str | None = None
	resource_id: int | None = None
	simulated: bool = False
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


class CareHandoffManage(CareHandoffActor):
	expected_status: Literal["Prepared", "Awaiting acknowledgement", "Acknowledged", "Completed"]

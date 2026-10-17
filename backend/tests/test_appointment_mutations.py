from sqlalchemy import select
from fastapi.testclient import TestClient

from app.models import AuditLog


def test_appointment_create_update_and_cancel(client: TestClient, db_session) -> None:
	created = client.post(
		"/api/appointments",
		json={"patient_id": 1, "title": "Follow-up coordination visit", "clinician_name": "Dr. Meera Sharma", "location": "City Women's Clinic", "appointment_date": "2026-10-21", "appointment_time": "09:30:00", "actor_caregiver_id": 1},
	)
	assert created.status_code == 201
	appointment_id = created.json()["id"]
	assert created.json()["status"] == "Confirmed"

	updated = client.put(
		f"/api/appointments/{appointment_id}",
		json={"location": "City Women's Clinic - Room 2", "actor_caregiver_id": 1},
	)
	assert updated.status_code == 200
	assert updated.json()["location"] == "City Women's Clinic - Room 2"

	cancelled = client.post(f"/api/appointments/{appointment_id}/cancel", json={"actor_caregiver_id": 1})
	assert cancelled.status_code == 200
	assert cancelled.json()["status"] == "Cancelled"

	actions = db_session.scalars(
		select(AuditLog.action).where(AuditLog.resource_type == "Appointment", AuditLog.resource_id == appointment_id).order_by(AuditLog.id)
	).all()
	assert actions == ["appointment_created", "appointment_updated", "appointment_cancelled"]


def test_appointment_validation_and_permission(client: TestClient) -> None:
	invalid_status = client.post(
		"/api/appointments",
		json={"patient_id": 1, "title": "Invalid", "clinician_name": "Clinician", "location": "Clinic", "appointment_date": "2026-10-21", "appointment_time": "09:30:00", "status": "Completed", "actor_caregiver_id": 1},
	)
	assert invalid_status.status_code == 400

	unauthorized = client.post(
		"/api/appointments",
		json={"patient_id": 1, "title": "Unauthorized", "clinician_name": "Clinician", "location": "Clinic", "appointment_date": "2026-10-21", "appointment_time": "09:30:00", "actor_caregiver_id": 3},
	)
	assert unauthorized.status_code == 403
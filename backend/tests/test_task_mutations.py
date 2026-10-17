from sqlalchemy import select
from fastapi.testclient import TestClient

from app.models import AuditLog


def test_task_create_update_complete_and_reopen(client: TestClient, db_session) -> None:
	created = client.post(
		"/api/tasks",
		json={"patient_id": 1, "title": "Confirm accessible transport", "owner_id": 2, "due_date": "2026-10-20", "category": "Transport", "actor_caregiver_id": 1},
	)
	assert created.status_code == 201
	task_id = created.json()["id"]
	assert created.json()["status"] == "Open"

	updated = client.put(
		f"/api/tasks/{task_id}",
		json={"title": "Confirm accessible transport timing", "actor_caregiver_id": 1},
	)
	assert updated.status_code == 200
	assert updated.json()["title"] == "Confirm accessible transport timing"

	completed = client.post(f"/api/tasks/{task_id}/complete", json={"actor_caregiver_id": 1, "completed": True})
	assert completed.status_code == 200
	assert completed.json()["status"] == "Completed"
	assert completed.json()["completed_at"] is not None

	reopened = client.post(f"/api/tasks/{task_id}/complete", json={"actor_caregiver_id": 1, "completed": False})
	assert reopened.status_code == 200
	assert reopened.json()["status"] == "Open"
	assert reopened.json()["completed_at"] is None

	actions = db_session.scalars(
		select(AuditLog.action).where(AuditLog.resource_type == "Task", AuditLog.resource_id == task_id).order_by(AuditLog.id)
	).all()
	assert actions == ["task_created", "task_updated", "task_completed", "task_reopened"]


def test_task_rejects_invalid_assignment_and_unauthorized_mutation(client: TestClient) -> None:
	invalid_owner = client.post(
		"/api/tasks",
		json={"patient_id": 1, "title": "Invalid owner", "owner_id": 999, "due_date": "2026-10-20", "category": "Transport", "actor_caregiver_id": 1},
	)
	assert invalid_owner.status_code == 404

	unknown_actor = client.post(
		"/api/tasks",
		json={"patient_id": 1, "title": "Unknown actor task", "owner_id": 2, "due_date": "2026-10-20", "category": "Transport", "actor_caregiver_id": 999},
	)
	assert unknown_actor.status_code == 404
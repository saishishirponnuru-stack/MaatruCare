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

def test_task_creation_completion_and_reopening_record_timeline_events(client: TestClient, db_session) -> None:
        from app.models import TimelineEvent

        created = client.post(
                "/api/tasks",
                json={
                        "patient_id": 1,
                        "title": "Timeline regression test task",
                        "owner_id": 2,
                        "due_date": "2026-10-28",
                        "category": "Coordination",
                        "actor_caregiver_id": 1,
                },
        )
        assert created.status_code == 201
        task_id = created.json()["id"]

        completed = client.post(
                f"/api/tasks/{task_id}/complete",
                json={"actor_caregiver_id": 1, "completed": True},
        )
        assert completed.status_code == 200

        reopened = client.post(
                f"/api/tasks/{task_id}/complete",
                json={"actor_caregiver_id": 1, "completed": False},
        )
        assert reopened.status_code == 200

        events = db_session.scalars(
                select(TimelineEvent)
                .where(
                        TimelineEvent.source == "Coordination task",
                        TimelineEvent.title == "Timeline regression test task",
                )
                .order_by(TimelineEvent.id)
        ).all()

        assert len(events) == 3
        assert [event.description for event in events] == [
                "A coordination task was created.",
                "A coordination task was completed.",
                "A coordination task was reopened.",
        ]


def test_task_delete_persists_and_preserves_audit_history(client: TestClient, db_session) -> None:
        from app.models import Task, TimelineEvent

        created = client.post(
                "/api/tasks",
                json={
                        "patient_id": 1,
                        "title": "Delete regression task",
                        "owner_id": 2,
                        "due_date": "2026-10-28",
                        "category": "Coordination",
                        "actor_caregiver_id": 1,
                },
        )
        assert created.status_code == 201
        task_id = created.json()["id"]

        deleted = client.request("DELETE", f"/api/tasks/{task_id}", json={"actor_caregiver_id": 1})
        assert deleted.status_code == 204
        assert db_session.get(Task, task_id) is None
        assert db_session.scalar(select(AuditLog.action).where(AuditLog.resource_type == "Task", AuditLog.resource_id == task_id).order_by(AuditLog.id.desc())) == "task_deleted"
        removal_event = db_session.scalar(
                select(TimelineEvent).where(
                        TimelineEvent.source == "Coordination task",
                        TimelineEvent.title == "Task removed",
                        TimelineEvent.description == 'Task "Delete regression task" was removed from current responsibilities.',
                )
        )
        assert removal_event is not None
        assert client.request("DELETE", f"/api/tasks/{task_id}", json={"actor_caregiver_id": 1}).status_code == 404


def test_repeated_task_completion_does_not_duplicate_history(client: TestClient, db_session) -> None:
        from app.models import TimelineEvent

        created = client.post(
                "/api/tasks",
                json={
                        "patient_id": 1,
                        "title": "Idempotent completion task",
                        "owner_id": 2,
                        "due_date": "2026-10-28",
                        "category": "Coordination",
                        "actor_caregiver_id": 1,
                },
        )
        task_id = created.json()["id"]
        assert client.post(f"/api/tasks/{task_id}/complete", json={"actor_caregiver_id": 1, "completed": True}).status_code == 200
        assert client.post(f"/api/tasks/{task_id}/complete", json={"actor_caregiver_id": 1, "completed": True}).status_code == 409
        events = db_session.scalars(
                select(TimelineEvent).where(
                        TimelineEvent.source == "Coordination task",
                        TimelineEvent.title == "Idempotent completion task",
                )
        ).all()
        assert [event.description for event in events] == [
                "A coordination task was created.",
                "A coordination task was completed.",
        ]


def test_task_delete_requires_patient_scoped_permission(client: TestClient, db_session) -> None:
        from app.models import Permission
        from sqlalchemy import select

        created = client.post(
                "/api/tasks",
                json={
                        "patient_id": 1,
                        "title": "Unauthorized delete task",
                        "owner_id": 2,
                        "due_date": "2026-10-28",
                        "category": "Coordination",
                        "actor_caregiver_id": 1,
                },
        )
        task_id = created.json()["id"]
        permission = db_session.scalar(select(Permission).where(Permission.caregiver_id == 3, Permission.permission_name == "Coordination tasks"))
        original_enabled = permission.enabled
        permission.enabled = False
        db_session.commit()
        try:
                assert client.request("DELETE", f"/api/tasks/{task_id}", json={"actor_caregiver_id": 3}).status_code == 403
        finally:
                permission.enabled = original_enabled
                db_session.commit()

from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuditLog, CareHandoff, TimelineEvent


def enable_handoff_access(client: TestClient) -> None:
	response = client.put(
		"/api/permissions",
		json={
			"patient_id": 1,
			"caregiver_id": 2,
			"permission_name": "Care handoffs",
			"enabled": True,
			"actor_caregiver_id": 1,
		},
	)
	assert response.status_code in {200, 409}


def test_handoff_lifecycle_and_audit_entries(client: TestClient) -> None:
	enable_handoff_access(client)
	created = client.post(
		"/api/handoffs",
		json={
			"patient_id": 1,
			"title": "Transport coordination",
			"from_caregiver_id": 1,
			"to_caregiver_id": 2,
			"reason": "Coordinate transport logistics",
			"actor_caregiver_id": 1,
		},
	)
	assert created.status_code == 201
	handoff = created.json()
	assert handoff["status"] == "Prepared"

	sent = client.post(f"/api/handoffs/{handoff['id']}/send", json={"actor_caregiver_id": 1})
	assert sent.status_code == 200
	assert sent.json()["status"] == "Awaiting acknowledgement"

	acknowledged = client.post(f"/api/handoffs/{handoff['id']}/acknowledge", json={"actor_caregiver_id": 2})
	assert acknowledged.status_code == 200
	assert acknowledged.json()["status"] == "Acknowledged"
	assert datetime.fromisoformat(acknowledged.json()["acknowledged_at"]) <= datetime.utcnow()


def test_handoff_rejects_wrong_recipient_and_duplicate_acknowledgment(client: TestClient) -> None:
	enable_handoff_access(client)
	created = client.post(
		"/api/handoffs",
		json={
			"patient_id": 1,
			"title": "Document coordination",
			"from_caregiver_id": 1,
			"to_caregiver_id": 2,
			"reason": "Prepare approved documents",
			"actor_caregiver_id": 1,
		},
	)
	handoff_id = created.json()["id"]
	client.post(f"/api/handoffs/{handoff_id}/send", json={"actor_caregiver_id": 1})

	wrong_recipient = client.post(f"/api/handoffs/{handoff_id}/acknowledge", json={"actor_caregiver_id": 3})
	assert wrong_recipient.status_code == 403

	assert client.post(f"/api/handoffs/{handoff_id}/acknowledge", json={"actor_caregiver_id": 2}).status_code == 200
	duplicate = client.post(f"/api/handoffs/{handoff_id}/acknowledge", json={"actor_caregiver_id": 2})
	assert duplicate.status_code == 409


def test_handoff_validates_ids_states_and_access(client: TestClient) -> None:
	enable_handoff_access(client)
	invalid_patient = client.post(
		"/api/handoffs",
		json={"patient_id": 999, "title": "x", "from_caregiver_id": 1, "to_caregiver_id": 2, "reason": "x", "actor_caregiver_id": 1},
	)
	assert invalid_patient.status_code == 404

	invalid_caregiver = client.post(
		"/api/handoffs",
		json={"patient_id": 1, "title": "x", "from_caregiver_id": 999, "to_caregiver_id": 2, "reason": "x", "actor_caregiver_id": 999},
	)
	assert invalid_caregiver.status_code == 404

	created = client.post(
		"/api/handoffs",
		json={"patient_id": 1, "title": "State test", "from_caregiver_id": 1, "to_caregiver_id": 2, "reason": "x", "actor_caregiver_id": 1},
	).json()
	handoff_id = created["id"]
	assert client.post(f"/api/handoffs/{handoff_id}/acknowledge", json={"actor_caregiver_id": 2}).status_code == 409
	assert client.post(f"/api/handoffs/{handoff_id}/send", json={"actor_caregiver_id": 2}).status_code == 403
	assert client.post(f"/api/handoffs/{handoff_id}/send", json={"actor_caregiver_id": 1}).status_code == 200

	unauthorized_read = client.get(f"/api/handoffs/{handoff_id}?actor_caregiver_id=3")
	assert unauthorized_read.status_code == 403
	recipient_read = client.get(f"/api/handoffs/{handoff_id}?actor_caregiver_id=2")
	assert recipient_read.status_code == 200


def test_handoff_audit_rows_are_non_sensitive(client: TestClient, db_session) -> None:
	created = client.post(
		"/api/handoffs",
		json={"patient_id": 1, "title": "Audit test", "from_caregiver_id": 1, "to_caregiver_id": 2, "reason": "Coordinate a visit", "actor_caregiver_id": 1},
	).json()
	client.post(f"/api/handoffs/{created['id']}/send", json={"actor_caregiver_id": 1})
	client.post(f"/api/handoffs/{created['id']}/acknowledge", json={"actor_caregiver_id": 2})

	rows = db_session.scalars(select(AuditLog).where(AuditLog.resource_id == created["id"]).order_by(AuditLog.id)).all()
	assert [row.action for row in rows] == ["handoff_created", "handoff_sent", "handoff_acknowledged"]
	assert all(row.resource_type == "CareHandoff" for row in rows)
	events = db_session.scalars(select(TimelineEvent).where(TimelineEvent.source == "Care handoff", TimelineEvent.title.in_(["Care handoff prepared", "Care handoff sent", "Care handoff acknowledged"]))).all()
	assert [event.title for event in events[-3:]] == ["Care handoff prepared", "Care handoff sent", "Care handoff acknowledged"]


def test_handoff_completion_lifecycle(client: TestClient, db_session) -> None:
        enable_handoff_access(client)
        created = client.post(
                "/api/handoffs",
                json={
                        "patient_id": 1,
                        "title": "Complete transport coordination",
                        "from_caregiver_id": 1,
                        "to_caregiver_id": 2,
                        "reason": "Confirm responsibility transfer",
                        "actor_caregiver_id": 1,
                },
        )
        assert created.status_code == 201
        handoff_id = created.json()["id"]

        premature = client.post(
                f"/api/handoffs/{handoff_id}/complete",
                json={"actor_caregiver_id": 2},
        )
        assert premature.status_code == 409

        sent = client.post(
                f"/api/handoffs/{handoff_id}/send",
                json={"actor_caregiver_id": 1},
        )
        assert sent.status_code == 200

        acknowledged = client.post(
                f"/api/handoffs/{handoff_id}/acknowledge",
                json={"actor_caregiver_id": 2},
        )
        assert acknowledged.status_code == 200

        completed = client.post(
                f"/api/handoffs/{handoff_id}/complete",
                json={"actor_caregiver_id": 2},
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "Completed"

        duplicate = client.post(
                f"/api/handoffs/{handoff_id}/complete",
                json={"actor_caregiver_id": 2},
        )
        assert duplicate.status_code == 409

        rows = db_session.scalars(
                select(AuditLog)
                .where(AuditLog.resource_id == handoff_id)
                .order_by(AuditLog.id)
        ).all()
        assert [row.action for row in rows][-1] == "handoff_completed"


def test_handoff_completion_rejects_non_recipient(client: TestClient) -> None:
        enable_handoff_access(client)
        created = client.post(
                "/api/handoffs",
                json={
                        "patient_id": 1,
                        "title": "Recipient authorization test",
                        "from_caregiver_id": 1,
                        "to_caregiver_id": 2,
                        "reason": "Verify recipient-only completion",
                        "actor_caregiver_id": 1,
                },
        )
        handoff_id = created.json()["id"]

        client.post(
                f"/api/handoffs/{handoff_id}/send",
                json={"actor_caregiver_id": 1},
        )
        client.post(
                f"/api/handoffs/{handoff_id}/acknowledge",
                json={"actor_caregiver_id": 2},
        )

        response = client.post(
                f"/api/handoffs/{handoff_id}/complete",
                json={"actor_caregiver_id": 1},
        )
        assert response.status_code == 403

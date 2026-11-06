from sqlalchemy import select
from fastapi.testclient import TestClient

from app.models import AuditLog, ConsentRecord, Permission


def test_permission_grant_revoke_and_audit_history(client: TestClient, db_session) -> None:
	grant = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Care handoffs", "enabled": True, "actor_caregiver_id": 1},
	)
	assert grant.status_code == 200
	assert grant.json()["enabled"] is True
	duplicate_grant = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Care handoffs", "enabled": True, "actor_caregiver_id": 1},
	)
	assert duplicate_grant.status_code == 200
	assert duplicate_grant.json()["id"] == grant.json()["id"]

	permissions = client.get("/api/permissions?patient_id=1&actor_caregiver_id=1")
	assert permissions.status_code == 200
	assert any(item["caregiver_id"] == 3 and item["permission_name"] == "Care handoffs" and item["enabled"] for item in permissions.json())

	revoke = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Care handoffs", "enabled": False, "actor_caregiver_id": 1},
	)
	assert revoke.status_code == 200
	assert revoke.json()["enabled"] is False

	consent_actions = db_session.scalars(
		select(ConsentRecord.action).where(
			ConsentRecord.caregiver_id == 3,
			ConsentRecord.permission_name == "Care handoffs",
		)
	).all()
	assert consent_actions[-2:] == ["granted", "revoked"]
	audit_actions = db_session.scalars(
		select(AuditLog.action).where(
			AuditLog.resource_type == "Permission",
			AuditLog.resource_id == grant.json()["id"],
		).order_by(AuditLog.id)
	).all()
	assert audit_actions[-2:] == ["permission_granted", "permission_revoked"]


def test_permission_validation_and_controller_restrictions(client: TestClient) -> None:
	invalid_patient = client.put(
		"/api/permissions",
		json={"patient_id": 999, "caregiver_id": 2, "permission_name": "Appointments", "enabled": True, "actor_caregiver_id": 1},
	)
	assert invalid_patient.status_code == 404

	invalid_caregiver = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 999, "permission_name": "Appointments", "enabled": True, "actor_caregiver_id": 1},
	)
	assert invalid_caregiver.status_code == 404

	non_controller = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Care handoffs", "enabled": True, "actor_caregiver_id": 2},
	)
	assert non_controller.status_code == 403

	unsupported = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Medical records", "enabled": True, "actor_caregiver_id": 1},
	)
	assert unsupported.status_code == 400


def test_controller_can_create_missing_permission_record(client: TestClient, db_session) -> None:
	permission = db_session.scalar(
		select(Permission).where(
			Permission.caregiver_id == 3,
			Permission.permission_name == "Appointments",
		)
	)
	assert permission is not None
	original_enabled = permission.enabled
	db_session.delete(permission)
	db_session.commit()

	grant = client.put(
		"/api/permissions",
		json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Appointments", "enabled": True, "actor_caregiver_id": 1},
	)
	assert grant.status_code == 200
	assert grant.json()["enabled"] is True
	created_permission = db_session.get(Permission, grant.json()["id"])
	assert created_permission is not None
	db_session.delete(created_permission)
	db_session.add(Permission(caregiver_id=3, permission_name="Appointments", enabled=original_enabled))
	db_session.commit()


def test_revoked_handoff_permission_blocks_access(client: TestClient) -> None:
	created = client.post(
		"/api/handoffs",
		json={"patient_id": 1, "title": "Permission check", "from_caregiver_id": 1, "to_caregiver_id": 3, "reason": "Coordinate transport", "actor_caregiver_id": 1},
	)
	assert created.status_code == 403

	assert client.get("/api/handoffs?actor_caregiver_id=3").status_code == 403
	assert client.get("/api/tasks?actor_caregiver_id=3").status_code == 200
	assert client.get("/api/appointments?actor_caregiver_id=3").status_code == 403



def test_disabled_coordination_permission_denies_caregiver_and_task_reads(client: TestClient, db_session) -> None:
    permission = db_session.scalar(
        select(Permission).where(
            Permission.caregiver_id == 1,
            Permission.permission_name == "Coordination tasks",
        )
    )
    assert permission is not None
    previous_enabled = permission.enabled
    permission.enabled = False
    db_session.commit()

    try:
        caregivers = client.get("/api/caregivers?actor_caregiver_id=1")
        tasks = client.get("/api/tasks?actor_caregiver_id=1")
        assert caregivers.status_code == 403
        assert caregivers.json()["detail"] == "Permission is not enabled"
        assert tasks.status_code == 403
        assert tasks.json()["detail"] == "Permission is not enabled"
    finally:
        permission.enabled = previous_enabled
        db_session.commit()


def test_missing_permission_revoke_remains_a_conflict(client: TestClient, db_session) -> None:
    permission = db_session.scalar(
        select(Permission).where(
            Permission.caregiver_id == 3,
            Permission.permission_name == "Appointments",
        )
    )
    assert permission is not None
    original_enabled = permission.enabled
    db_session.delete(permission)
    db_session.commit()

    response = client.put(
        "/api/permissions",
        json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Appointments", "enabled": False, "actor_caregiver_id": 1},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Permission record does not exist to revoke"

    db_session.add(Permission(caregiver_id=3, permission_name="Appointments", enabled=original_enabled))
    db_session.commit()


def test_duplicate_permission_records_remain_a_conflict(client: TestClient, db_session) -> None:
    duplicate = Permission(caregiver_id=3, permission_name="Appointments", enabled=True)
    db_session.add(duplicate)
    db_session.commit()

    response = client.put(
        "/api/permissions",
        json={"patient_id": 1, "caregiver_id": 3, "permission_name": "Appointments", "enabled": True, "actor_caregiver_id": 1},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Multiple permission records exist for this caregiver and permission"
    db_session.delete(duplicate)
    db_session.commit()

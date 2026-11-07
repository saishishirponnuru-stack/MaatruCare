from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuditLog, Caregiver, ConsentRecord, Permission


def test_remove_caregiver_revokes_patient_relationship_and_preserves_account_history(client: TestClient, db_session) -> None:
    original_permissions = {
        permission.id: permission.enabled
        for permission in db_session.scalars(select(Permission).where(Permission.caregiver_id == 2)).all()
    }
    response = client.delete("/api/caregivers/2?actor_caregiver_id=1")
    assert response.status_code == 200
    assert response.json()["access_status"] == "Revoked"
    assert db_session.get(Caregiver, 2).access_status == "Revoked"
    assert db_session.scalars(select(Permission).where(Permission.caregiver_id == 2, Permission.enabled.is_(True))).all() == []
    assert db_session.scalar(select(ConsentRecord).where(ConsentRecord.caregiver_id == 2, ConsentRecord.action == "revoked")) is not None
    assert db_session.scalar(select(AuditLog).where(AuditLog.resource_type == "Caregiver", AuditLog.resource_id == 2)) is not None
    assert all(item["id"] != 2 for item in client.get("/api/caregivers?actor_caregiver_id=1").json())
    caregiver = db_session.get(Caregiver, 2)
    caregiver.access_status = "Active"
    for permission in db_session.scalars(select(Permission).where(Permission.caregiver_id == 2)).all():
        permission.enabled = original_permissions[permission.id]
    db_session.commit()


def test_remove_caregiver_rejects_unauthorized_and_primary_relationships(client: TestClient) -> None:
    assert client.delete("/api/caregivers/3?actor_caregiver_id=3").status_code == 403
    assert client.delete("/api/caregivers/1?actor_caregiver_id=1").status_code == 409
    assert client.delete("/api/caregivers/999?actor_caregiver_id=1").status_code == 404

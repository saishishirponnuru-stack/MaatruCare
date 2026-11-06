from fastapi.testclient import TestClient


def water_payload(**overrides):
    payload = {
        "patient_id": 1,
        "actor_caregiver_id": 1,
        "log_date": "2026-11-06",
        "status": "Adequate",
        "quantity_ml": 1200,
    }
    payload.update(overrides)
    return payload


def test_lifestyle_private_by_default_and_owner_persistence(client: TestClient) -> None:
    denied = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=2")
    assert denied.status_code == 403

    created = client.post("/api/lifestyle/water", json=water_payload())
    assert created.status_code == 200
    record_id = created.json()["id"]

    updated = client.put(f"/api/lifestyle/water/{record_id}", json=water_payload(status="Not adequate", quantity_ml=800))
    assert updated.status_code == 200
    assert updated.json()["status"] == "Not adequate"

    reloaded = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1")
    assert reloaded.status_code == 200
    assert any(item["id"] == record_id and item["quantity_ml"] == 800 for item in reloaded.json()["water"])


def test_lifestyle_permission_grant_and_revocation(client: TestClient) -> None:
    grant = client.put(
        "/api/permissions",
        json={"patient_id": 1, "caregiver_id": 2, "permission_name": "Lifestyle records", "enabled": True, "actor_caregiver_id": 1},
    )
    assert grant.status_code == 200
    assert client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=2").status_code == 200

    revoke = client.put(
        "/api/permissions",
        json={"patient_id": 1, "caregiver_id": 2, "permission_name": "Lifestyle records", "enabled": False, "actor_caregiver_id": 1},
    )
    assert revoke.status_code == 200
    assert client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=2").status_code == 403


def test_lifestyle_rejects_invalid_ownership_and_input(client: TestClient) -> None:
    ownership = client.post("/api/lifestyle/water", json=water_payload(patient_id=999))
    assert ownership.status_code == 404

    invalid_status = client.post("/api/lifestyle/water", json=water_payload(status="Unknown"))
    assert invalid_status.status_code == 422

    invalid_quantity = client.post("/api/lifestyle/water", json=water_payload(quantity_ml=-1))
    assert invalid_quantity.status_code == 422


def test_diet_and_activity_records_can_be_created_and_updated(client: TestClient) -> None:
    recommendation = client.post(
        "/api/lifestyle/diet/recommendations",
        json={
            "patient_id": 1,
            "actor_caregiver_id": 1,
            "title": "Owner-entered meal note",
            "instructions": "Follow the written consultation instructions.",
            "start_date": "2026-11-06",
            "active": True,
        },
    )
    assert recommendation.status_code == 200
    recommendation_id = recommendation.json()["id"]

    adherence = client.post(
        f"/api/lifestyle/diet/recommendations/{recommendation_id}/adherence",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-06", "status": "Partially followed", "reason": "Synthetic test reason"},
    )
    assert adherence.status_code == 200
    assert client.put(
        f"/api/lifestyle/diet/adherence/{adherence.json()['id']}",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-06", "status": "Followed"},
    ).status_code == 200

    routine = client.post(
        "/api/lifestyle/activities/routines",
        json={"patient_id": 1, "actor_caregiver_id": 1, "name": "Gentle walk", "activity_type": "Exercise", "duration_minutes": 20},
    )
    assert routine.status_code == 200
    routine_id = routine.json()["id"]
    log = client.post(
        f"/api/lifestyle/activities/routines/{routine_id}/logs",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-06", "completed": False, "missed_reason": "Synthetic test reason"},
    )
    assert log.status_code == 200
    assert client.put(
        f"/api/lifestyle/activities/logs/{log.json()['id']}",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-06", "completed": True},
    ).status_code == 200

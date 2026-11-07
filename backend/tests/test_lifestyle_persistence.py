from fastapi.testclient import TestClient


def test_lifestyle_preferences_persist_and_sleep_calculates_overnight(client: TestClient) -> None:
    preference = client.put(
        "/api/lifestyle/preferences",
        json={"patient_id": 1, "actor_caregiver_id": 1, "water_goal_ml": 1750, "sleep_goal_minutes": 450},
    )
    assert preference.status_code == 200

    sleep = client.post(
        "/api/lifestyle/sleep",
        json={
            "patient_id": 1,
            "actor_caregiver_id": 1,
            "log_date": "2026-11-08",
            "status": "Restful",
            "bedtime": "23:30:00",
            "wake_time": "07:00:00",
            "interruptions": 1,
        },
    )
    assert sleep.status_code == 200
    assert sleep.json()["duration_hours"] == 7.5

    response = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1")
    assert response.status_code == 200
    assert response.json()["preferences"]["water_goal_ml"] == 1750
    assert any(item["id"] == sleep.json()["id"] and item["interruptions"] == 1 for item in response.json()["sleep"])


def test_water_delete_is_owner_controlled_and_persistent(client: TestClient) -> None:
    water = client.post(
        "/api/lifestyle/water",
        json={"patient_id": 1, "actor_caregiver_id": 1, "log_date": "2026-11-08", "status": "Adequate", "quantity_ml": 250},
    )
    assert water.status_code == 200
    record_id = water.json()["id"]

    denied = client.delete(f"/api/lifestyle/water/{record_id}?actor_caregiver_id=2")
    assert denied.status_code == 403

    deleted = client.delete(f"/api/lifestyle/water/{record_id}?actor_caregiver_id=1")
    assert deleted.status_code == 200
    payload = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1").json()
    assert all(item["id"] != record_id for item in payload["water"])


def test_sleep_delete_is_owner_controlled_and_persistent(client: TestClient) -> None:
    sleep = client.post(
        "/api/lifestyle/sleep",
        json={
            "patient_id": 1,
            "actor_caregiver_id": 1,
            "log_date": "2026-11-09",
            "status": "Restful",
            "bedtime": "23:00:00",
            "wake_time": "07:00:00",
        },
    )
    assert sleep.status_code == 200
    record_id = sleep.json()["id"]

    denied = client.delete(f"/api/lifestyle/sleep/{record_id}?actor_caregiver_id=2")
    assert denied.status_code == 403

    deleted = client.delete(f"/api/lifestyle/sleep/{record_id}?actor_caregiver_id=1")
    assert deleted.status_code == 200
    payload = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1").json()
    assert all(item["id"] != record_id for item in payload["sleep"])

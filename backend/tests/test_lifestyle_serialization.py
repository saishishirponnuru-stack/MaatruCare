from fastapi.testclient import TestClient


def test_lifestyle_get_serializes_all_record_categories_as_json(client: TestClient) -> None:
    sleep = client.post(
        "/api/lifestyle/sleep",
        json={
            "patient_id": 1,
            "actor_caregiver_id": 1,
            "log_date": "2026-11-07",
            "status": "Sound and adequate",
            "duration_hours": 8,
            "bedtime": "22:30:00",
            "wake_time": "06:30:00",
        },
    )
    assert sleep.status_code == 200

    weight = client.post(
        "/api/lifestyle/weight",
        json={"patient_id": 1, "actor_caregiver_id": 1, "entry_date": "2026-11-07", "weight_kg": 62.5},
    )
    assert weight.status_code == 200

    recommendation = client.post(
        "/api/lifestyle/diet/recommendations",
        json={
            "patient_id": 1,
            "actor_caregiver_id": 1,
            "title": "Serialization test recommendation",
            "instructions": "Synthetic owner-entered instructions.",
            "start_date": "2026-11-07",
        },
    )
    assert recommendation.status_code == 200
    recommendation_id = recommendation.json()["id"]

    adherence = client.post(
        f"/api/lifestyle/diet/recommendations/{recommendation_id}/adherence",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-07", "status": "Not followed", "reason": "Synthetic test"},
    )
    assert adherence.status_code == 200

    routine = client.post(
        "/api/lifestyle/activities/routines",
        json={"patient_id": 1, "actor_caregiver_id": 1, "name": "Serialization test routine", "activity_type": "Meditation"},
    )
    assert routine.status_code == 200
    routine_id = routine.json()["id"]

    activity = client.post(
        f"/api/lifestyle/activities/routines/{routine_id}/logs",
        json={"actor_caregiver_id": 1, "log_date": "2026-11-07", "completed": True},
    )
    assert activity.status_code == 200

    response = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1")
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
    "water",
    "sleep",
    "weight",
    "diet_recommendations",
    "diet_adherence",
    "routines",
    "activity_logs",
    "preferences",
}
    assert any(item["id"] == sleep.json()["id"] and item["bedtime"] == "22:30:00" for item in payload["sleep"])
    assert any(item["id"] == weight.json()["id"] and item["weight_kg"] == 62.5 for item in payload["weight"])
    assert any(item["id"] == recommendation_id for item in payload["diet_recommendations"])
    assert any(item["id"] == adherence.json()["id"] for item in payload["diet_adherence"])
    assert any(item["id"] == routine_id for item in payload["routines"])
    assert any(item["id"] == activity.json()["id"] for item in payload["activity_logs"])

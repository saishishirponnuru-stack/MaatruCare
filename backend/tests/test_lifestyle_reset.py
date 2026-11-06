from fastapi.testclient import TestClient
from datetime import date

from app.lifestyle_models import ActivityLog, ActivityRoutine, DietAdherence, DietRecommendation, LifestylePreference, SleepLog, WaterLog, WeightEntry
from app.models import Patient


def test_lifestyle_reset_requires_explicit_demo_flag_and_controller(client: TestClient, monkeypatch, db_session) -> None:
    monkeypatch.delenv("MAATRUCARE_DEMO_RESET_ENABLED", raising=False)
    water = client.post(
        "/api/lifestyle/water",
        json={"patient_id": 1, "actor_caregiver_id": 1, "log_date": "2026-11-09", "status": "Adequate", "quantity_ml": 250},
    )
    assert water.status_code == 200

    disabled = client.post(
        "/api/lifestyle/reset",
        json={"patient_id": 1, "actor_caregiver_id": 1, "reset_preferences": False},
    )
    assert disabled.status_code == 403

    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED", "true")
    denied = client.post(
        "/api/lifestyle/reset",
        json={"patient_id": 1, "actor_caregiver_id": 2, "reset_preferences": False},
    )
    assert denied.status_code == 403
    db_session.query(WaterLog).filter(WaterLog.id == water.json()["id"]).delete(synchronize_session=False)
    db_session.commit()


def test_lifestyle_reset_is_scoped_and_repeatable(client: TestClient, monkeypatch, db_session) -> None:
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED", "true")
    recommendation = client.post(
        "/api/lifestyle/diet/recommendations",
        json={"patient_id": 1, "actor_caregiver_id": 1, "title": "Preserve me", "instructions": "Synthetic recommendation", "start_date": "2026-11-09"},
    )
    assert recommendation.status_code == 200
    water = client.post(
        "/api/lifestyle/water",
        json={"patient_id": 1, "actor_caregiver_id": 1, "log_date": "2026-11-09", "status": "Adequate", "quantity_ml": 250},
    )
    assert water.status_code == 200

    reset = client.post("/api/lifestyle/reset", json={"patient_id": 1, "actor_caregiver_id": 1, "reset_preferences": True})
    assert reset.status_code == 200
    assert reset.json()["deleted"]["water"] >= 1

    second = client.post("/api/lifestyle/reset", json={"patient_id": 1, "actor_caregiver_id": 1, "reset_preferences": True})
    assert second.status_code == 200
    payload = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1").json()
    assert all(item["id"] != water.json()["id"] for item in payload["water"])
    assert any(item["id"] == recommendation.json()["id"] for item in payload["diet_recommendations"])
    db_session.query(DietRecommendation).filter(DietRecommendation.id == recommendation.json()["id"]).delete(synchronize_session=False)
    db_session.commit()


def test_lifestyle_reset_preserves_other_patient_and_only_resets_preferences_when_requested(client: TestClient, monkeypatch, db_session) -> None:
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED", "true")
    other = Patient(name="Synthetic Second Patient", current_phase="Pregnancy", email="second@example.test")
    db_session.add(other)
    db_session.flush()
    other_id = other.id
    other_water = WaterLog(patient_id=other_id, log_date=date(2098, 1, 2), status="Adequate", quantity_ml=300)
    other_preference = LifestylePreference(patient_id=other_id, water_goal_ml=1700, sleep_goal_minutes=450)
    db_session.add_all([other_water, other_preference])
    db_session.commit()

    water = client.post("/api/lifestyle/water", json={"patient_id": 1, "actor_caregiver_id": 1, "log_date": "2098-01-02", "status": "Adequate", "quantity_ml": 300})
    sleep = client.post("/api/lifestyle/sleep", json={"patient_id": 1, "actor_caregiver_id": 1, "log_date": "2098-01-02", "status": "Restful", "duration_hours": 8})
    weight = client.post("/api/lifestyle/weight", json={"patient_id": 1, "actor_caregiver_id": 1, "entry_date": "2098-01-02", "weight_kg": 62.5})
    recommendation = client.post("/api/lifestyle/diet/recommendations", json={"patient_id": 1, "actor_caregiver_id": 1, "title": "Synthetic recommendation", "instructions": "Test-only example", "start_date": "2098-01-01"})
    assert all(response.status_code == 200 for response in (water, sleep, weight, recommendation))
    adherence = client.post(f"/api/lifestyle/diet/recommendations/{recommendation.json()['id']}/adherence", json={"actor_caregiver_id": 1, "log_date": "2098-01-02", "status": "Followed"})
    routine = client.post("/api/lifestyle/activities/routines", json={"patient_id": 1, "actor_caregiver_id": 1, "name": "Synthetic walk", "activity_type": "Exercise"})
    assert adherence.status_code == 200 and routine.status_code == 200
    activity = client.post(f"/api/lifestyle/activities/routines/{routine.json()['id']}/logs", json={"actor_caregiver_id": 1, "log_date": "2098-01-02", "completed": True, "actual_minutes": 20})
    preferences = client.put("/api/lifestyle/preferences", json={"patient_id": 1, "actor_caregiver_id": 1, "water_goal_ml": 2100, "sleep_goal_minutes": 480})
    assert activity.status_code == 200 and preferences.status_code == 200

    reset = client.post("/api/lifestyle/reset", json={"patient_id": 1, "actor_caregiver_id": 1, "reset_preferences": False})
    assert reset.status_code == 200
    assert all(reset.json()["deleted"][category] >= 1 for category in ("water", "sleep", "weight", "diet_adherence", "activity_logs"))
    payload = client.get("/api/lifestyle?patient_id=1&actor_caregiver_id=1").json()
    assert payload["water"] == payload["sleep"] == payload["weight"] == payload["diet_adherence"] == payload["activity_logs"] == []
    assert any(item["id"] == recommendation.json()["id"] for item in payload["diet_recommendations"])
    assert any(item["id"] == routine.json()["id"] for item in payload["routines"])
    assert payload["preferences"]["water_goal_ml"] == 2100
    assert payload["preferences"]["sleep_goal_minutes"] == 480

    reset_preferences = client.post("/api/lifestyle/reset", json={"patient_id": 1, "actor_caregiver_id": 1, "reset_preferences": True})
    assert reset_preferences.status_code == 200
    assert reset_preferences.json()["preferences_reset"] is True
    db_session.expire_all()
    assert db_session.get(LifestylePreference, payload["preferences"]["id"]) is None
    assert db_session.get(WaterLog, other_water.id) is not None
    assert db_session.get(LifestylePreference, other_preference.id) is not None

    db_session.query(ActivityLog).filter(ActivityLog.routine_id == routine.json()["id"]).delete(synchronize_session=False)
    db_session.query(ActivityRoutine).filter(ActivityRoutine.id == routine.json()["id"]).delete(synchronize_session=False)
    db_session.query(DietRecommendation).filter(DietRecommendation.id == recommendation.json()["id"]).delete(synchronize_session=False)

    # Remove only this test's second synthetic patient and its dependent records.
    for model, field in ((ActivityLog, None), (DietAdherence, None), (WaterLog, "patient_id"), (SleepLog, "patient_id"), (WeightEntry, "patient_id"), (LifestylePreference, "patient_id"), (DietRecommendation, "patient_id"), (ActivityRoutine, "patient_id")):
        if field:
            db_session.query(model).filter(getattr(model, field) == other_id).delete(synchronize_session=False)
    db_session.delete(db_session.get(Patient, other_id))
    db_session.commit()

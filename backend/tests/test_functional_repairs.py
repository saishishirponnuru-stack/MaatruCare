"""Regression coverage uses isolated SQLite records and real JWT actor binding."""
import time
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import select

from app.models import Account, AuditLog, CaregiverInvitation, Patient, Permission


@pytest.fixture
def patient_workspace(client, monkeypatch):
    monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")

    def headers(email):
        token = jwt.encode({"sub": email, "email": email, "aud": "authenticated", "exp": time.time() + 3600}, "test-secret", algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    def patient(name):
        email = f"{uuid4()}@example.test"
        auth = headers(email)
        response = client.post("/api/auth/bootstrap", headers=auth, json={"role": "patient", "name": name})
        assert response.status_code == 201, response.text
        return auth, response.json()

    def caregiver(auth, name="Same Name"):
        email = f"{uuid4()}@example.test"
        invitation = client.post("/api/auth/invitations", headers=auth, json={"email": email, "name": name})
        assert invitation.status_code == 201, invitation.text
        caregiver_auth = headers(email)
        accepted = client.post(f"/api/auth/invitations/{invitation.json()['token']}/accept", headers=caregiver_auth)
        assert accepted.status_code == 200, accepted.text
        return caregiver_auth, accepted.json()

    auth, account = patient("Own Onboarding Name")
    return auth, account, patient, caregiver, headers


def permission(client, auth, account, caregiver_id, name, enabled=True):
    return client.put("/api/permissions", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": 999, "caregiver_id": caregiver_id, "permission_name": name, "enabled": enabled})


def test_onboarding_isolated_idempotent_and_caregiver_profile_cannot_rename_patient(client, patient_workspace, db_session):
    auth, account, patient, caregiver, _ = patient_workspace
    other_auth, other = patient("Other Account Name")
    repeated = client.post("/api/auth/bootstrap", headers=auth, json={"role": "patient", "name": "Ignored repeat"})
    assert repeated.json()["patient_id"] == account["patient_id"]
    assert repeated.json()["name"] == "Own Onboarding Name"
    assert other["patient_id"] != account["patient_id"]
    assert client.get("/api/auth/me", headers=other_auth).json()["name"] == "Other Account Name"
    assert account["caregiver"]["is_patient"] is True
    assert client.get("/api/caregivers", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).json() == []
    caregiver_auth, _ = caregiver(auth)
    assert client.put("/api/auth/profile", headers=caregiver_auth, json={"name": "Changed Caregiver"}).status_code == 200
    assert client.get("/api/auth/me", headers=auth).json()["patient"]["name"] == "Own Onboarding Name"
    assert len(db_session.scalars(select(Account).where(Account.subject == account["subject"])).all()) == 1
    assert db_session.get(Patient, account["patient_id"]).name == "Own Onboarding Name"


def test_permission_targets_stable_ids_and_self_is_protected(client, patient_workspace, db_session):
    auth, account, _, caregiver, _ = patient_workspace
    _, first = caregiver(auth)
    second_auth, second = caregiver(auth)
    response = permission(client, auth, account, first["caregiver_id"], "Appointments")
    assert response.status_code == 200, response.text
    assert response.json()["caregiver_id"] == first["caregiver_id"]
    assert db_session.scalar(select(Permission).where(Permission.caregiver_id == second["caregiver_id"], Permission.permission_name == "Appointments")).enabled is False
    assert permission(client, auth, account, account["caregiver_id"], "Appointments", False).status_code == 403
    assert permission(client, second_auth, account, first["caregiver_id"], "Appointments", False).status_code == 403
    assert permission(client, auth, account, first["caregiver_id"], "Appointments", False).status_code == 200


def test_invitation_withdrawal_preserves_history_and_invalidates_redemption(client, patient_workspace, db_session):
    auth, _, patient, _, headers = patient_workspace
    other_auth, _ = patient("Another Patient")
    email = f"{uuid4()}@example.test"
    created = client.post("/api/auth/invitations", headers=auth, json={"email": email})
    invitation = client.get("/api/auth/invitations", headers=auth).json()[0]
    path = f"/api/auth/invitations/{invitation['id']}/withdraw"
    assert client.post(path, headers=other_auth).status_code == 404
    assert client.post(path, headers=auth).status_code == 200
    assert client.post(path, headers=auth).status_code == 409
    assert client.get("/api/auth/invitations", headers=auth).json()[0]["status"] == "Withdrawn"
    assert db_session.get(CaregiverInvitation, invitation["id"]) is not None
    redeem_auth = headers(email)
    token = created.json()["token"]
    assert client.post(f"/api/auth/invitations/{token}/accept", headers=redeem_auth).status_code == 404
    assert client.post("/api/auth/bootstrap", headers=redeem_auth, json={"role": "caregiver", "name": "Invited", "invitation_token": token}).status_code == 400


def test_accepted_invitation_cannot_be_withdrawn(client, patient_workspace):
    auth, _, _, caregiver, _ = patient_workspace
    caregiver(auth)
    invitation = client.get("/api/auth/invitations", headers=auth).json()[0]
    assert invitation["status"] == "Accepted"
    assert client.post(f"/api/auth/invitations/{invitation['id']}/withdraw", headers=auth).status_code == 409


def test_real_handoff_transitions_use_recipient_and_persist_timestamps(client, patient_workspace):
    auth, account, _, caregiver, _ = patient_workspace
    recipient_auth, recipient = caregiver(auth)
    assert permission(client, auth, account, recipient["caregiver_id"], "Care handoffs").status_code == 200
    created = client.post("/api/handoffs", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": 999, "from_caregiver_id": account["caregiver_id"], "to_caregiver_id": recipient["caregiver_id"], "title": "Transfer responsibility", "reason": "Appointment coordination"})
    assert created.status_code == 201, created.text
    handoff_id = created.json()["id"]
    path = f"/api/handoffs/{handoff_id}"
    actor = {"actor_caregiver_id": recipient["caregiver_id"]}
    assert client.post(f"{path}/send", headers=recipient_auth, json=actor).status_code == 403
    assert client.post(f"{path}/send", headers=auth, json=actor).json()["sent_at"]
    assert client.post(f"{path}/acknowledge", headers=auth, json=actor).status_code == 403
    assert permission(client, auth, account, recipient["caregiver_id"], "Care handoffs", False).status_code == 200
    assert client.post(f"{path}/acknowledge", headers=recipient_auth, json=actor).status_code == 403
    assert permission(client, auth, account, recipient["caregiver_id"], "Care handoffs").status_code == 200
    assert client.post(f"{path}/acknowledge", headers=recipient_auth, json=actor).json()["acknowledged_at"]
    completed = client.post(f"{path}/complete", headers=recipient_auth, json=actor)
    assert completed.json()["status"] == "Completed" and completed.json()["completed_at"]
    assert client.get(path, headers=auth, params=actor).json()["status"] == "Completed"
    received = client.get(path, headers=recipient_auth, params=actor).json()
    assert received["from_name"] == account["name"] and received["to_name"] == recipient["name"]
    assert client.post(f"{path}/complete", headers=recipient_auth, json=actor).status_code == 409


def test_demo_handoff_simulations_are_audited(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, _ = patient_workspace
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    demo = client.post("/api/caregivers/demo", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "name": "Synthetic participant", "relationship": "Friend", "role": "Support caregiver"}).json()
    assert permission(client, auth, account, demo["id"], "Care handoffs").status_code == 200
    handoff = client.post("/api/handoffs", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "from_caregiver_id": account["caregiver_id"], "to_caregiver_id": demo["id"], "title": "Demo workflow", "reason": "Demonstration"}).json()
    for action in ("send", "acknowledge", "complete"):
        result = client.post(f"/api/handoffs/{handoff['id']}/{action}", headers=auth, json={"actor_caregiver_id": account["caregiver_id"]})
        assert result.status_code == 200, result.text
    actions = db_session.scalars(select(AuditLog.action).where(AuditLog.patient_id == account["patient_id"])).all()
    assert "handoff_acknowledged_simulated" in actions
    assert "handoff_completed_simulated" in actions


def lifestyle_params(account):
    return {"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"]}


def test_sleep_overnight_duration_optional_quality_and_validation(client, patient_workspace):
    auth, account, _, _, _ = patient_workspace
    payload = {**lifestyle_params(account), "log_date": "2026-11-07", "bedtime": "23:30", "wake_time": "07:00"}
    saved = client.post("/api/lifestyle/sleep", headers=auth, json=payload)
    assert saved.status_code == 200, saved.text
    assert saved.json()["duration_hours"] == 7.5
    assert saved.json()["status"] == "Not recorded"
    for change in ({"wake_time": "23:30"}, {"wake_time": None}, {"wake_time": "22:30"}, {"bedtime": "bad"}):
        assert client.post("/api/lifestyle/sleep", headers=auth, json={**payload, **change}).status_code == 422
    assert any(item["id"] == saved.json()["id"] for item in client.get("/api/lifestyle", headers=auth, params=lifestyle_params(account)).json()["sleep"])


def test_activity_duplicate_rule_updates_single_checkin(client, patient_workspace):
    auth, account, _, _, _ = patient_workspace
    routine = client.post("/api/lifestyle/activities/routines", headers=auth, json={**lifestyle_params(account), "name": "Personal routine", "activity_type": "Other"}).json()
    path = f"/api/lifestyle/activities/routines/{routine['id']}/logs"
    payload = {"actor_caregiver_id": account["caregiver_id"], "log_date": "2026-11-07", "completed": True, "completion_status": "Partially completed", "actual_minutes": 10}
    first = client.post(path, headers=auth, json=payload)
    assert first.status_code == 200 and first.json()["completed"] is False
    second = client.post(path, headers=auth, json={**payload, "completion_status": "Completed", "actual_minutes": 20})
    assert second.json()["id"] == first.json()["id"]
    data = client.get("/api/lifestyle", headers=auth, params=lifestyle_params(account)).json()
    assert len(data["activity_logs"]) == 1 and data["activity_logs"][0]["actual_minutes"] == 20
    assert client.post(path, headers=auth, json={**payload, "completion_status": "Unknown"}).status_code == 422


def test_nutrition_logs_with_optional_personal_plan_are_scoped(client, patient_workspace):
    auth, account, patient, _, _ = patient_workspace
    other_auth, other = patient("Other nutrition workspace")
    plan = client.post("/api/lifestyle/diet/recommendations", headers=auth, json={**lifestyle_params(account), "title": "Personal goal", "instructions": "My own meal notes", "start_date": "2026-11-07"}).json()
    base = {**lifestyle_params(account), "log_date": "2026-11-07", "meal_type": "Lunch", "notes": "Personal meal entry"}
    assert client.post("/api/lifestyle/nutrition", headers=auth, json=base).status_code == 200
    assert client.post("/api/lifestyle/nutrition", headers=auth, json={**base, "recommendation_id": plan["id"], "adherence": "Followed"}).status_code == 200
    assert client.post("/api/lifestyle/nutrition", headers=auth, json={**base, "adherence": "Followed"}).status_code == 422
    assert client.post("/api/lifestyle/nutrition", headers=other_auth, json={**base, **lifestyle_params(other), "recommendation_id": plan["id"]}).status_code == 422
    data = client.get("/api/lifestyle", headers=auth, params=lifestyle_params(account)).json()
    assert len(data["nutrition"]) == 2
    assert client.get("/api/lifestyle", headers=other_auth, params=lifestyle_params(other)).json()["nutrition"] == []


def test_reset_preview_requires_local_demo_and_explicit_patient_allowlist(client, patient_workspace, monkeypatch):
    auth, account, _, _, _ = patient_workspace
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED", "true")
    monkeypatch.setenv("MAATRUCARE_ENV", "production")
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_PATIENT_IDS", str(account["patient_id"]))
    assert client.get("/api/lifestyle/reset-preview", headers=auth, params=lifestyle_params(account)).json()["enabled"] is False
    monkeypatch.setenv("MAATRUCARE_ENV", "local")
    preview = client.get("/api/lifestyle/reset-preview", headers=auth, params=lifestyle_params(account)).json()
    assert preview["enabled"] and "nutrition" in preview["counts"]
    # Deliberately never execute a reset in this regression suite.

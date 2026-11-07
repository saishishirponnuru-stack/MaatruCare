"""Isolated JWT/SQLite checks; never creates production users or caregivers."""
import pytest
from sqlalchemy import func, select

from test_functional_repairs import patient_workspace, permission
from app.models import Account, CaregiverInvitation
from app.services.demo_caregiver_service import demo_caregivers_available


@pytest.mark.parametrize("environment,render", [("production", "false"), ("test", "true")])
def test_production_simulations_require_valid_workspace_allowlist(monkeypatch, environment, render):
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    monkeypatch.setenv("MAATRUCARE_ENV", environment)
    monkeypatch.setenv("RENDER", render)
    monkeypatch.delenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", raising=False)
    assert not demo_caregivers_available(17)
    for invalid in ("*", "17,all", "17,", "", "18"):
        monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", invalid)
        assert not demo_caregivers_available(17)
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", "17, 18")
    assert demo_caregivers_available(17)
    assert not demo_caregivers_available(19)
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false")
    assert not demo_caregivers_available(17)


def test_capability_and_creation_enforce_same_authenticated_workspace(client, patient_workspace, monkeypatch):
    auth, account, mother, caregiver, _ = patient_workspace
    other_auth, other = mother("Unlisted workspace")
    member_auth, _ = caregiver(auth)
    monkeypatch.setenv("MAATRUCARE_ENV", "production")
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    monkeypatch.delenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", raising=False)
    payload = {"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "name": "Fictional Friend", "relationship": "Friend", "role": "Support caregiver"}
    assert client.get("/api/auth/invitation-delivery", headers=auth).json()["simulated_available"] is False
    assert client.post("/api/caregivers/demo", headers=auth, json=payload).status_code == 404
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", str(account["patient_id"]))
    response = client.get("/api/auth/invitation-delivery", headers=auth)
    assert response.status_code == 200 and response.json()["simulated_available"] is True
    assert client.get("/api/auth/invitation-delivery", headers=other_auth).json()["simulated_available"] is False
    assert client.post("/api/caregivers/demo", headers=other_auth, json={**payload, "patient_id": other["patient_id"]}).status_code == 404
    assert client.post("/api/caregivers/demo", headers=other_auth, json=payload).status_code == 403
    assert client.post("/api/caregivers/demo", headers=member_auth, json=payload).status_code == 403
    assert client.get("/api/auth/invitation-delivery", headers=member_auth).status_code == 403
    assert client.post("/api/caregivers/demo", json=payload).status_code == 401


def test_requested_fictional_caregivers_persist_without_invitations(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, _ = patient_workspace
    monkeypatch.setenv("MAATRUCARE_ENV", "production")
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", str(account["patient_id"]))
    from app.routers import auth as auth_router
    monkeypatch.setattr(auth_router, "send_invitation_email", lambda *args: pytest.fail("Simulation must never send email"))
    members = []
    for name, relationship in [("Rahul Rao", "Partner"), ("Lakshmi Rao", "Parent"), ("Priya Rao", "Sister")]:
        payload = {"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "name": name, "relationship": relationship, "role": "Support caregiver", "coordination_access": True}
        saved = client.post("/api/caregivers/demo", headers=auth, json=payload)
        assert saved.status_code == 201, saved.text
        member = saved.json()
        assert member["is_demo"] is True and member["access_status"] == "Active"
        assert member["name"] == name and member["relationship"] == relationship
        members.append(member)
        assert client.post("/api/caregivers/demo", headers=auth, json={**payload, "name": " " + name.lower() + " "}).status_code == 409
    loaded = client.get("/api/caregivers", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]})
    assert {m["id"] for m in loaded.json()} == {m["id"] for m in members}
    assert db_session.scalar(select(func.count()).select_from(CaregiverInvitation).where(CaregiverInvitation.patient_id == account["patient_id"])) == 0
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.caregiver_id.in_([m["id"] for m in members]))) == 0
    assert permission(client, auth, account, members[0]["id"], "Care handoffs", False).status_code == 200
    saved_permissions = client.get("/api/permissions", headers=auth, params={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"]}).json()
    assert next(p for p in saved_permissions if p["caregiver_id"] == members[0]["id"] and p["permission_name"] == "Care handoffs")["enabled"] is False

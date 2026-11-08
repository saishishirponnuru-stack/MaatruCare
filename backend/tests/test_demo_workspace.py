"""Explicit new-account demo opt-in; no conversion or cross-workspace writes."""
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, func, select, text

from test_functional_repairs import patient_workspace
from app.database import Base
from app.migrations import migrate_schema
from app.models import Account, AuditLog, Caregiver, Patient, Task, CareHandoff


@pytest.fixture
def production_simulations(monkeypatch):
    monkeypatch.setenv("MAATRUCARE_ENV", "production")
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", "1")


def test_explicit_new_demo_is_empty_idempotent_and_owner_scoped(client, patient_workspace, production_simulations, db_session):
    real_auth, real, _, _, headers = patient_workspace
    auth = headers(f"{uuid4()}@example.test")
    request = {"role": "patient", "name": "Fictional Judge", "demo_workspace": True}
    created = client.post("/api/auth/bootstrap", headers=auth, json=request)
    assert created.status_code == 201, created.text
    owner = created.json()
    patient_id = owner["patient_id"]
    assert patient_id != real["patient_id"]
    assert owner["patient"]["is_demo_workspace"] is True
    assert client.get("/api/auth/me", headers=auth).json()["patient"]["is_demo_workspace"] is True
    assert client.post("/api/auth/bootstrap", headers=auth, json=request).json()["patient_id"] == patient_id
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.subject == owner["subject"])) == 1
    assert db_session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.patient_id == patient_id, AuditLog.action == "demo_workspace_created")) == 1
    assert db_session.scalar(select(func.count()).select_from(Caregiver).where(Caregiver.patient_id == patient_id, Caregiver.is_patient.is_(False))) == 0
    for model in (Task, CareHandoff):
        assert db_session.scalar(select(func.count()).select_from(model).where(model.patient_id == patient_id)) == 0
    assert client.get("/api/auth/invitation-delivery", headers=auth).json()["simulated_available"] is True
    payload = {"patient_id": patient_id, "actor_caregiver_id": owner["caregiver_id"], "name": "Fictional Helper", "relationship": "Friend", "role": "Support caregiver"}
    member = client.post("/api/caregivers/demo", headers=auth, json=payload)
    assert member.status_code == 201, member.text
    assert member.json()["is_demo"] is True
    assert client.post("/api/caregivers/demo", headers=auth, json=payload).status_code == 409
    assert client.post("/api/caregivers/demo", headers=real_auth, json=payload).status_code == 403
    loaded_response = client.get("/api/caregivers", headers=auth, params={"actor_caregiver_id": owner["caregiver_id"]})
    assert loaded_response.status_code == 200
    loaded = loaded_response.json()
    assert [m["id"] for m in loaded] == [member.json()["id"]]
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.caregiver_id == member.json()["id"])) == 0


def test_existing_real_workspace_cannot_be_converted(client, patient_workspace, production_simulations, db_session):
    auth, account, _, caregiver, _ = patient_workspace
    caregiver_auth, _ = caregiver(auth)
    for caller in (auth, caregiver_auth):
        response = client.post("/api/auth/bootstrap", headers=caller, json={"role": "patient", "name": "Replacement", "demo_workspace": True})
        assert response.status_code == 409
    assert db_session.get(Patient, account["patient_id"]).is_demo_workspace is False
    assert client.get("/api/auth/me", headers=auth).json()["name"] == account["name"]
    # No general profile endpoint can modify the workspace designation.
    client.put("/api/auth/profile", headers=auth, json={"name": account["name"], "is_demo_workspace": True})
    db_session.expire_all()
    assert db_session.get(Patient, account["patient_id"]).is_demo_workspace is False


def test_demo_opt_in_does_not_claim_or_modify_legacy_profile(client, patient_workspace, production_simulations, db_session):
    _, _, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"
    legacy = Patient(name="Existing information", email=email, current_phase="Postnatal")
    db_session.add(legacy)
    db_session.commit()
    response = client.post("/api/auth/bootstrap", headers=headers(email), json={"role": "patient", "name": "Fictional Name", "demo_workspace": True})
    assert response.status_code == 201
    assert response.json()["patient_id"] != legacy.id
    db_session.refresh(legacy)
    assert (legacy.name, legacy.current_phase, legacy.is_demo_workspace) == ("Existing information", "Postnatal", False)


def test_demo_creation_requires_enabled_feature_and_owner_role(client, patient_workspace, monkeypatch):
    _, _, _, _, headers = patient_workspace
    auth = headers(f"{uuid4()}@example.test")
    payload = {"role": "patient", "name": "Fictional Name", "demo_workspace": True}
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false")
    assert client.post("/api/auth/bootstrap", headers=auth, json=payload).status_code == 404
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    assert client.post("/api/auth/bootstrap", headers=auth, json={**payload, "role": "caregiver"}).status_code == 400
    assert client.post("/api/auth/bootstrap", json=payload).status_code == 401


def test_additive_workspace_migration_retains_existing_information():
    # Only a disposable in-memory database simulates the preceding schema.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO patients (id, name, current_phase, created_at) VALUES (7, 'Retained fictional record', 'Pregnancy', CURRENT_TIMESTAMP)"))
        connection.execute(text("ALTER TABLE patients DROP COLUMN is_demo_workspace"))
    migrate_schema(engine)
    migrate_schema(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT id, name, is_demo_workspace FROM patients")).one() == (7, "Retained fictional record", 0)
    engine.dispose()

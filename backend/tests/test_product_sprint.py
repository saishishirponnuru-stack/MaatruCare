import json
from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect, select, text

from test_functional_repairs import patient_workspace, permission, lifestyle_params
from app.models import AIDraft, CaregiverInvitation, Permission, Task, TimelineEvent
from app.routers import ai

NOTE = "Fictional: Mira will arrange transport. Dev will prepare the folder. Pickup time is unconfirmed."


def output(operation="extract_tasks"):
    return {"summary": "Transport and folder preparation need coordination.", "facts": [{"text": "Mira will arrange transport.", "source_quote": "Mira will arrange transport"}], "dates": [], "times": [], "people": ["Mira", "Dev"], "responsibilities": [], "missing_information": ["Confirm pickup time."], "suggestions": [{"title": "Arrange transport", "kind": "From note", "source_quote": "Mira will arrange transport", "assignee_name": "Mira", "due_date": None}], "handoff_title": "Transport responsibility" if operation == "handoff_draft" else None, "handoff_summary": "Arrange transport; pickup time needs confirmation." if operation == "handoff_draft" else None, "care_update": "Transport and folder preparation are being arranged." if operation == "update_draft" else None}


def draft(client, auth, monkeypatch, operation="extract_tasks"):
    monkeypatch.setattr(ai, "generate_workspace", lambda *args: output(operation))
    response = client.post("/api/ai/workspace", headers=auth, json={"note": NOTE, "operation": operation, "external_processing_consent": True})
    assert response.status_code == 200, response.text
    return response.json()


def test_invitation_expiry_duplicates_and_reserved_relationship(client, patient_workspace, db_session):
    auth, _, _, _, headers = patient_workspace
    email = "expiration-fixture@example.test"
    response = client.post("/api/auth/invitations", headers=auth, json={"email": email, "relationship": "Brother"})
    assert response.status_code == 201
    assert client.post("/api/auth/invitations", headers=auth, json={"email": email.upper()}).status_code == 409
    invitation = client.get("/api/auth/invitations", headers=auth).json()[0]
    row = db_session.get(CaregiverInvitation, invitation["id"])
    row.created_at = datetime.utcnow() - timedelta(days=8)
    db_session.commit()
    assert client.get("/api/auth/invitations", headers=auth).json()[0]["status"] == "Expired"
    recipient = headers(email)
    assert client.post(f"/api/auth/invitations/{response.json()['token']}/accept", headers=recipient).status_code == 410
    assert client.post("/api/auth/bootstrap", headers=recipient, json={"role": "caregiver", "name": "Fixture", "invitation_token": response.json()["token"]}).status_code == 410
    assert client.post(f"/api/auth/invitations/{row.id}/withdraw", headers=auth).status_code == 409
    assert client.post("/api/auth/invitations", headers=auth, json={"email": "another@example.test", "relationship": "Primary caregiver"}).status_code == 422
    assert client.post("/api/auth/invitations", headers=auth, json={"email": "bad@@address"}).status_code == 422


def test_profile_phase_phone_and_relationship_cannot_escalate(client, patient_workspace):
    auth, account, _, caregiver, _ = patient_workspace
    saved = client.put("/api/auth/profile", headers=auth, json={"name": account["name"], "phone": "+91 90000 12345", "current_phase": "Postnatal"})
    assert saved.json()["phone"] == "+91 90000 12345"
    assert client.get("/api/auth/me", headers=auth).json()["patient"]["current_phase"] == "Postnatal"
    member_auth, member = caregiver(auth)
    assert client.put("/api/auth/profile", headers=member_auth, json={"name": "Caregiver", "current_phase": "Pregnancy"}).status_code == 403
    assert client.put(f"/api/caregivers/{member['caregiver_id']}", headers=auth, json={"actor_caregiver_id": account["caregiver_id"], "name": "Caregiver", "relationship": "Primary caregiver"}).status_code == 422


def test_task_note_status_and_analytics_denominator(client, patient_workspace):
    auth, account, _, _, _ = patient_workspace
    params = lifestyle_params(account)
    created = client.post("/api/tasks", headers=auth, json={**params, "title": "Arrange pickup", "owner_patient_id": account["patient_id"], "due_date": str(date.today() - timedelta(days=1)), "category": "Transport", "note": "Use the north entrance", "priority": "High"})
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert client.put(f"/api/tasks/{task_id}", headers=auth, json={"actor_caregiver_id": 999, "status": "In progress"}).json()["status"] == "In progress"
    assert client.get("/api/tasks", headers=auth, params=params).json()[0]["note"] == "Use the north entrance"
    metrics = client.get("/api/analytics", headers=auth, params={**params, "start": str(date.today()), "end": str(date.today())}).json()
    assert metrics["tasks"] == {"eligible": 1, "simulated_tasks": 0, "completed": 0, "pending": 1, "overdue": 1}
    assert metrics["handoffs"]["average_acknowledgement_minutes"] is None
    completed = client.put(f"/api/tasks/{task_id}", headers=auth, json={"actor_caregiver_id": 999, "status": "Completed"})
    assert completed.json()["completed_at"]
    same_status = client.put(f"/api/tasks/{task_id}", headers=auth, json={"actor_caregiver_id": 999, "status": "Completed"})
    assert same_status.json()["completed_at"] == completed.json()["completed_at"]
    assert client.get("/api/analytics/facts", headers=auth, params=params).json()["tasks"] == []


def test_timeline_respects_revoked_category_and_retains_actor(client, patient_workspace):
    auth, account, _, caregiver, _ = patient_workspace
    member_auth, member = caregiver(auth)
    for category in ("Coordination tasks", "Approved care updates"):
        assert permission(client, auth, account, member["caregiver_id"], category).status_code == 200
    created = client.post("/api/tasks", headers=auth, json={**lifestyle_params(account), "title": "Private responsibility", "owner_patient_id": account["patient_id"], "due_date": str(date.today()), "category": "Coordination"})
    params = {"actor_caregiver_id": member["caregiver_id"]}
    before = client.get("/api/timeline", headers=member_auth, params=params).json()
    assert any(item["event_type"] == "Task" and item["actor_name"] == account["name"] for item in before)
    permission(client, auth, account, member["caregiver_id"], "Coordination tasks", False)
    after = client.get("/api/timeline", headers=member_auth, params=params).json()
    assert all(item["event_type"] != "Task" for item in after)
    assert client.get("/api/tasks", headers=member_auth, params=params).status_code == 403
    assert client.delete(f"/api/caregivers/{member['caregiver_id']}", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).status_code == 200
    assert client.get("/api/auth/me", headers=member_auth).status_code == 403


def test_weight_daily_correction_and_activity_plan_snapshot(client, patient_workspace):
    auth, account, _, _, _ = patient_workspace
    params = lifestyle_params(account)
    first = client.post("/api/lifestyle/weight", headers=auth, json={**params, "entry_date": "2026-11-07", "weight_kg": 70})
    second = client.post("/api/lifestyle/weight", headers=auth, json={**params, "entry_date": "2026-11-07", "weight_kg": 71})
    assert first.json()["id"] == second.json()["id"]
    routine = client.post("/api/lifestyle/activities/routines", headers=auth, json={**params, "name": "Evening walk", "activity_type": "Other", "duration_minutes": 30}).json()
    payload = {"actor_caregiver_id": account["caregiver_id"], "log_date": "2026-11-07", "completed": True, "completion_status": "Partially completed", "actual_minutes": 25}
    path = f"/api/lifestyle/activities/routines/{routine['id']}/logs"
    log = client.post(path, headers=auth, json=payload).json()
    assert log["planned_minutes"] == 30 and log["completed"] is False
    assert client.put(f"/api/lifestyle/activities/routines/{routine['id']}", headers=auth, json={**params, "name": "Evening walk", "activity_type": "Other", "duration_minutes": 45}).status_code == 200
    assert client.post(path, headers=auth, json=payload).json()["planned_minutes"] == 30
    assert client.post(path, headers=auth, json={**payload, "log_date": "2026-11-08"}).json()["planned_minutes"] == 45
    saved = client.get("/api/lifestyle", headers=auth, params=params).json()
    assert len(saved["weight"]) == 1 and saved["weight"][0]["weight_kg"] == 71


def test_ai_consent_screening_output_validation_and_no_auto_mutation(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, _ = patient_workspace
    monkeypatch.setattr(ai, "generate_workspace", lambda *args: output())
    for note, consent, status in ((NOTE, False, 400), ("Contact test@example.test for transport", True, 400), ("Tell me how to prescribe a medication", True, 400), ("x" * 3001, True, 422)):
        assert client.post("/api/ai/workspace", headers=auth, json={"note": note, "operation": "extract_tasks", "external_processing_consent": consent}).status_code == status
    saved = draft(client, auth, monkeypatch)
    assert db_session.scalar(select(Task.id).where(Task.patient_id == account["patient_id"])) is None
    assert db_session.get(AIDraft, saved["id"]).source_hash != NOTE
    invalid = output(); invalid["facts"][0]["source_quote"] = "Invented unsupported source"
    monkeypatch.setattr(ai, "generate_workspace", lambda *args: invalid)
    assert client.post("/api/ai/workspace", headers=auth, json={"note": NOTE, "operation": "summarize", "external_processing_consent": True}).status_code == 502


def test_ai_task_approval_persists_is_idempotent_and_account_scoped(client, patient_workspace, monkeypatch):
    auth, account, patient, _, _ = patient_workspace
    saved = draft(client, auth, monkeypatch)
    payload = {**lifestyle_params(account), "title": "Reviewed transport task", "owner_patient_id": account["patient_id"], "due_date": str(date.today()), "category": "Transport", "ai_draft_id": saved["id"], "ai_suggestion_index": 0}
    assert client.post("/api/tasks", headers=auth, json=payload).status_code == 403
    approved = client.post("/api/tasks", headers=auth, json={**payload, "human_approved": True})
    assert approved.status_code == 201, approved.text
    repeated = client.post("/api/tasks", headers=auth, json={**payload, "human_approved": True})
    assert repeated.json()["id"] == approved.json()["id"]
    state = client.get(f"/api/ai/drafts/{saved['id']}", headers=auth).json()
    assert state["review"]["0"]["task_id"] == approved.json()["id"]
    other_auth, other = patient("Other AI account")
    assert client.get(f"/api/ai/drafts/{saved['id']}", headers=other_auth).status_code == 404
    assert client.post("/api/tasks", headers=other_auth, json={**payload, **lifestyle_params(other), "owner_patient_id": other["patient_id"], "human_approved": True}).status_code == 404


def test_ai_rejection_and_handoff_approval(client, patient_workspace, monkeypatch):
    auth, account, _, caregiver, _ = patient_workspace
    saved = draft(client, auth, monkeypatch)
    assert client.post(f"/api/ai/drafts/{saved['id']}/review", headers=auth, json={"action": "reject", "suggestion_index": 0}).status_code == 200
    assert client.post("/api/tasks", headers=auth, json={**lifestyle_params(account), "title": "Rejected suggestion", "owner_patient_id": account["patient_id"], "due_date": str(date.today()), "category": "Coordination", "ai_draft_id": saved["id"], "ai_suggestion_index": 0, "human_approved": True}).status_code == 409
    _, member = caregiver(auth)
    permission(client, auth, account, member["caregiver_id"], "Care handoffs")
    handoff = draft(client, auth, monkeypatch, "handoff_draft")
    payload = {**lifestyle_params(account), "from_caregiver_id": account["caregiver_id"], "to_caregiver_id": member["caregiver_id"], "title": "Reviewed handoff", "reason": "Transfer transport responsibility", "ai_draft_id": handoff["id"]}
    assert client.post("/api/handoffs", headers=auth, json=payload).status_code == 403
    created = client.post("/api/handoffs", headers=auth, json={**payload, "human_approved": True})
    assert created.status_code == 201 and created.json()["status"] == "Prepared"
    assert client.post("/api/handoffs", headers=auth, json={**payload, "human_approved": True}).json()["id"] == created.json()["id"]

    conflicting = client.post(
        "/api/handoffs",
        headers=auth,
        json={
            **payload,
            "title": "Different responsibility",
            "human_approved": True,
        },
    )
    assert conflicting.status_code == 409
    assert "already has a handoff" in conflicting.json()["detail"]

    original = client.get(
        f"/api/handoffs/{created.json()['id']}",
        headers=auth,
        params={"actor_caregiver_id": account["caregiver_id"]},
    )
    assert original.status_code == 200
    assert original.json()["title"] == "Reviewed handoff"


def test_ai_limits_and_revoked_permission(client, patient_workspace, monkeypatch):
    auth, account, _, caregiver, _ = patient_workspace
    monkeypatch.setattr(ai, "RATE_LIMIT", 1)
    draft(client, auth, monkeypatch)
    assert client.post("/api/ai/workspace", headers=auth, json={"note": NOTE, "operation": "extract_tasks", "external_processing_consent": True}).status_code == 429
    member_auth, _ = caregiver(auth)
    assert client.post("/api/ai/workspace", headers=member_auth, json={"note": NOTE, "operation": "extract_tasks", "external_processing_consent": True}).status_code == 403
    assert client.post("/api/ai/workspace", headers=auth, content="x" * 17000).status_code == 413


def test_production_never_enables_test_auth_bypass(client, monkeypatch):
    monkeypatch.setenv("MAATRUCARE_ENV", "production")
    monkeypatch.setenv("MAATRUCARE_TEST_AUTH_COMPAT", "true")
    assert client.get("/api/tasks?actor_caregiver_id=1").status_code == 401


def test_gemini_json_schema_transport(monkeypatch):
    from app.services import ai_service
    captured = {}
    def generate(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(text=json.dumps(output()))
    monkeypatch.setenv("GEMINI_API_KEY", "test-fixture-key")
    monkeypatch.setattr(ai_service.genai, "Client", lambda **kwargs: SimpleNamespace(models=SimpleNamespace(generate_content=generate), close=lambda: None))
    assert ai_service.generate_workspace(NOTE, "extract_tasks", "English")["summary"]
    assert captured["config"].response_schema is None
    assert captured["config"].response_json_schema["type"] == "object"


def test_additive_migration_preserves_rows_and_is_repeatable():
    from app.migrations import migrate_schema
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        for statement in ("CREATE TABLE accounts (id INTEGER PRIMARY KEY, role TEXT, caregiver_id INTEGER)", "CREATE TABLE caregivers (id INTEGER PRIMARY KEY, name TEXT)", "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)", "CREATE TABLE care_handoffs (id INTEGER PRIMARY KEY, title TEXT)", "INSERT INTO tasks (id,title) VALUES (1,'Preserved responsibility')"):
            connection.execute(text(statement))
    migrate_schema(engine)
    migrate_schema(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT title, priority FROM tasks WHERE id=1")).one() == ("Preserved responsibility", "Normal")
        assert "note" in {column["name"] for column in inspect(connection).get_columns("tasks")}
    engine.dispose()


def test_chunked_ai_body_is_bounded_without_content_length(client, patient_workspace):
    auth, *_ = patient_workspace
    def chunks():
        yield b'{"note":"'
        yield b'x' * 17000
        yield b'"}'
    response = client.post("/api/ai/workspace", headers=auth, content=chunks())
    assert response.status_code == 413


def test_analytics_calendar_uses_configured_local_timezone(monkeypatch):
    from app.routers.analytics import local_date
    monkeypatch.setenv("MAATRUCARE_TIMEZONE", "Asia/Kolkata")
    assert local_date(datetime(2026, 11, 7, 20, 0)) == date(2026, 11, 8)


def test_revoked_categories_remove_private_drafts_and_saved_facts(client, patient_workspace, monkeypatch):
    auth, account, _, caregiver, _ = patient_workspace
    member_auth, member = caregiver(auth)
    for category in ("Coordination tasks", "Approved care updates"):
        permission(client, auth, account, member["caregiver_id"], category)
    saved = draft(client, member_auth, monkeypatch)
    assert any(item["id"] == saved["id"] for item in client.get("/api/ai/drafts", headers=member_auth).json())
    permission(client, auth, account, member["caregiver_id"], "Coordination tasks", False)
    assert client.get("/api/ai/drafts", headers=member_auth).json() == []
    assert client.get(f"/api/ai/drafts/{saved['id']}", headers=member_auth).status_code == 403
    facts = client.get("/api/analytics/facts", headers=member_auth, params=lifestyle_params(member)).json()
    assert facts["tasks"] == [] and "Coordination tasks" not in facts["available_categories"]


def test_postgres_driver_and_schema_compile_without_network():
    from sqlalchemy import create_engine, create_mock_engine
    from app.database import Base
    driver = create_engine("postgresql+psycopg://fixture:fixture@localhost/fixture")
    assert driver.dialect.driver == "psycopg"
    statements = []
    mock = create_mock_engine("postgresql+psycopg://", lambda statement, *args, **kwargs: statements.append(str(statement.compile(dialect=driver.dialect))))
    Base.metadata.create_all(mock)
    assert any("CREATE TABLE ai_drafts" in statement for statement in statements)
    assert any("REFERENCES ai_drafts" in statement for statement in statements)
    driver.dispose()


def test_production_preflight_rejects_ephemeral_storage_and_unsafe_flags():
    from scripts.check_production_config import inspect_config
    errors, _ = inspect_config({"DATABASE_URL": "sqlite:///./maatrucare.db", "MAATRUCARE_ENV": "local", "MAATRUCARE_TEST_AUTH_COMPAT": "true", "CORS_ORIGINS": "*"})
    assert any("DATABASE_URL" in item for item in errors)
    assert any("MAATRUCARE_TEST_AUTH_COMPAT" in item for item in errors)
    safe = {"DATABASE_URL": "postgresql://fixture:fixture@example.test/fixture", "MAATRUCARE_ENV": "production", "SUPABASE_JWKS_URL": "https://fixture.supabase.co/auth/v1/.well-known/jwks.json", "SUPABASE_ISSUER": "https://fixture.supabase.co/auth/v1", "CORS_ORIGINS": "https://fixture.example.test"}
    assert inspect_config(safe)[0] == []


def test_render_cannot_enable_demo_reset_even_with_local_flags(monkeypatch):
    from app.routers.lifestyle import reset_enabled
    monkeypatch.setenv("MAATRUCARE_ENV", "local")
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED", "true")
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_PATIENT_IDS", "123")
    monkeypatch.setenv("RENDER", "true")
    assert reset_enabled(123) is False


def test_revoked_task_assignee_remains_identified_in_history(client, patient_workspace):
    auth, account, _, caregiver, _ = patient_workspace
    _, member = caregiver(auth)
    permission(client, auth, account, member["caregiver_id"], "Coordination tasks")
    created = client.post("/api/tasks", headers=auth, json={**lifestyle_params(account), "title": "Retained ownership", "owner_id": member["caregiver_id"], "due_date": str(date.today()), "category": "Coordination"})
    assert created.status_code == 201
    name = created.json()["owner_name"]
    assert name
    client.delete(f"/api/caregivers/{member['caregiver_id']}", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]})
    tasks = client.get("/api/tasks", headers=auth, params=lifestyle_params(account)).json()
    assert tasks[0]["owner_name"] == name and tasks[0]["owner_id"] == member["caregiver_id"]

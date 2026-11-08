"""Signature experiences reuse real scoped records; external AI is substituted."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import select
from app.models import Appointment, Task
from app.routers import ai
from test_functional_repairs import patient_workspace, permission
from test_core_workflows import create, transition

NOTE = "Fictional coordination note: Prepare the folder and confirm pickup."


def task_payload(account, title):
    return {"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"],
            "owner_patient_id": account["patient_id"], "title": title,
            "due_date": "2030-01-01", "category": "Coordination"}


def provider(monkeypatch, titles):
    ai._request_times.clear()
    calls = []
    def generate(note, operation, language):
        calls.append((note, operation, language))
        return {"summary": "Review these logistical suggestions.", "suggestions": [
            {"title": title, "kind": "Suggestion", "source_quote": "Prepare the folder and confirm pickup."} for title in titles]}
    monkeypatch.setattr(ai, "generate_workspace", generate)
    return calls


def plan(client, auth):
    return client.post("/api/ai/workspace", headers=auth, json={"operation": "care_plan", "note": NOTE,
        "external_processing_consent": True})


def test_planner_omits_open_and_repeated_titles_without_sending_records(client, patient_workspace, monkeypatch):
    auth, account, other, _, _ = patient_workspace
    assert client.post("/api/tasks", headers=auth, json=task_payload(account, "Prepare folder")).status_code == 201
    unrelated_auth, unrelated = other("Unrelated owner")
    assert client.post("/api/tasks", headers=unrelated_auth, json=task_payload(unrelated, "Confirm pickup")).status_code == 201
    calls = provider(monkeypatch, [" PREPARE   folder ", "Confirm pickup", "confirm pickup"])
    response = plan(client, auth)
    assert response.status_code == 200, response.text
    output = response.json()["output"]
    assert [item["title"] for item in output["suggestions"]] == ["Confirm pickup"]
    assert output["missing_information"]
    assert calls == [(NOTE, "care_plan", "English")]  # No saved title, identity or other workspace was transmitted.


def test_planner_human_approval_persistence_retry_and_duplicate_guard(client, patient_workspace, monkeypatch):
    auth, account, _, _, _ = patient_workspace
    provider(monkeypatch, ["Confirm pickup"])
    draft = plan(client, auth).json()
    payload = {**task_payload(account, "Confirm pickup"), "ai_draft_id": draft["id"], "ai_suggestion_index": 0}
    assert client.post("/api/tasks", headers=auth, json=payload).status_code == 403
    assert client.get("/api/tasks", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).json() == []
    payload["human_approved"] = True
    first = client.post("/api/tasks", headers=auth, json=payload)
    repeated = client.post("/api/tasks", headers=auth, json=payload)
    assert first.status_code == repeated.status_code == 201
    assert first.json()["id"] == repeated.json()["id"]
    refreshed = client.get(f"/api/ai/drafts/{draft['id']}", headers=auth).json()
    assert refreshed["review"]["0"]["task_id"] == first.json()["id"]
    assert len(client.get("/api/tasks", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).json()) == 1
    # A task created after generation is also checked at approval, including edited titles.
    provider(monkeypatch, ["Another responsibility"])
    second = plan(client, auth).json()
    changed = {**payload, "ai_draft_id": second["id"], "title": "  CONFIRM  pickup  "}
    assert client.post("/api/tasks", headers=auth, json=changed).status_code == 409


def test_planner_context_and_generation_enforce_permissions_and_scope(client, patient_workspace, monkeypatch):
    auth, account, other, caregiver, _ = patient_workspace
    recipient_auth, recipient = caregiver(auth)
    provider(monkeypatch, ["Confirm pickup"])
    assert plan(client, recipient_auth).status_code == 403
    assert permission(client, auth, account, recipient["caregiver_id"], "Coordination tasks").status_code == 200
    assert plan(client, recipient_auth).status_code == 200
    assert permission(client, auth, account, recipient["caregiver_id"], "Coordination tasks", False).status_code == 200
    assert plan(client, recipient_auth).status_code == 403
    other_auth, _ = other("Other workspace")
    facts = client.get("/api/analytics/facts", headers=other_auth, params={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"]})
    assert facts.status_code == 403
    draft = plan(client, auth).json()
    assert client.get(f"/api/ai/drafts/{draft['id']}", headers=other_auth).status_code == 404


def test_planner_failures_missing_consent_and_unsupported_facts_leave_tasks_unchanged(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, _ = patient_workspace
    calls = provider(monkeypatch, ["Confirm pickup"])
    assert client.post("/api/ai/workspace", headers=auth, json={"operation": "care_plan", "note": NOTE}).status_code == 400
    assert not calls
    from app.services.ai_service import AIProviderError
    def unavailable(*args):
        raise AIProviderError("provider unavailable")
    monkeypatch.setattr(ai, "generate_workspace", unavailable)
    assert plan(client, auth).status_code == 503
    monkeypatch.setattr(ai, "generate_workspace", lambda *args: {"summary": "No invented facts", "suggestions": [{"title": "Invented", "kind": "Suggestion", "source_quote": "Not in note"}]})
    assert plan(client, auth).status_code == 502
    assert db_session.scalars(select(Task).where(Task.patient_id == account["patient_id"])).all() == []


def test_story_filters_real_ordered_handoff_activity_and_rejects_other_workspaces(client, patient_workspace):
    auth, account, other, caregiver, _ = patient_workspace
    recipient_auth, recipient = caregiver(auth)
    permission(client, auth, account, recipient["caregiver_id"], "Care handoffs")
    permission(client, auth, account, recipient["caregiver_id"], "Approved care updates")
    handoff = create(client, auth, account, recipient["caregiver_id"])
    other_handoff = create(client, auth, account, recipient["caregiver_id"])
    transition(client, auth, handoff, "send")
    transition(client, recipient_auth, handoff, "acknowledge")
    query = {"actor_caregiver_id": account["caregiver_id"], "category": "Handoffs", "resource_type": "CareHandoff", "resource_id": handoff["id"], "order": "oldest"}
    response = client.get("/api/timeline", headers=auth, params=query)
    assert response.status_code == 200, response.text
    events = response.json()
    assert len(events) == 3
    assert all(item["resource_id"] == handoff["id"] and item["resource_id"] != other_handoff["id"] for item in events)
    assert [item["created_at"] for item in events] == sorted(item["created_at"] for item in events)
    assert events[-1]["actor_name"] == recipient["name"] and not events[-1]["simulated"]
    unrelated_auth, _ = other("Other story")
    # Actor IDs are rebound to the signed-in account; a forged query cannot
    # select another workspace, so a scoped empty result is also safe.
    unrelated = client.get("/api/timeline", headers=unrelated_auth, params=query)
    assert unrelated.status_code == 200 and unrelated.json() == []
    # An authorized category does not expose handoffs between other participants.
    third_auth, third = caregiver(auth)
    permission(client, auth, account, third["caregiver_id"], "Care handoffs")
    permission(client, auth, account, third["caregiver_id"], "Approved care updates")
    query["actor_caregiver_id"] = third["caregiver_id"]
    assert client.get("/api/timeline", headers=third_auth, params=query).json() == []


def test_planner_facts_exclude_past_today_appointments(client, patient_workspace, db_session):
    auth, account, _, _, _ = patient_workspace
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    for day, title, clock in [(today, "Earlier today", time(0)), (today + timedelta(days=1), "Next visit", time(10))]:
        db_session.add(Appointment(patient_id=account["patient_id"], title=title, clinician_name="Fictional clinician", location="Fictional clinic", appointment_date=day, appointment_time=clock, status="Confirmed"))
    db_session.commit()
    response = client.get("/api/analytics/facts", headers=auth, params={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"]})
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["appointments"]] == ["Next visit"]

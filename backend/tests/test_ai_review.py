"""Approval persistence tests use the isolated database and provider substitution."""
import pytest
from time import perf_counter
from sqlalchemy import event
from app.database import engine
from app.routers import ai
from test_functional_repairs import patient_workspace, permission

NOTE = "Fictional coordination note: Confirm the fictional folder."

def generated(client, auth, monkeypatch, operation="care_plan"):
    ai._request_times.clear()
    monkeypatch.setattr(ai, "generate_workspace", lambda *args: {
        "summary": "Confirm the fictional folder.", "care_update": "", "handoff_summary": "",
        "suggestions": [{"title": "Confirm fictional folder", "kind": "From note", "source_quote": "Confirm the fictional folder."}],
    })
    result = client.post("/api/ai/workspace", headers=auth, json={"operation": operation, "note": NOTE, "external_processing_consent": True})
    assert result.status_code == 200, result.text
    return result.json()

@pytest.mark.parametrize("operation,field", [("care_plan", "summary"), ("extract_tasks", "summary"), ("summarize", "summary"), ("appointment_prep", "summary"), ("handoff_draft", "handoff_summary"), ("update_draft", "care_update")])
def test_review_edited_text_persists_without_creating_tasks(client, patient_workspace, monkeypatch, operation, field):
    auth, account, _, _, _ = patient_workspace
    draft = generated(client, auth, monkeypatch, operation)
    queries = []
    def capture(connection, cursor, statement, parameters, context, executemany):
        queries.append(statement.lstrip().split()[0])
    event.listen(engine, "before_cursor_execute", capture)
    started = perf_counter()
    try:
        response = client.post(f"/api/ai/drafts/{draft['id']}/review", headers=auth, json={"action": "approve", "edited_text": "Confirm the fictional folder and pickup location."})
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    if operation == "care_plan":
        print("ISOLATED_REVIEW_PROFILE", {"api_ms": round((perf_counter() - started) * 1000, 2), "selects": queries.count("SELECT"), "writes": sum(item in {"UPDATE", "INSERT"} for item in queries)})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "Approved"
    saved = client.get(f"/api/ai/drafts/{draft['id']}", headers=auth).json()
    assert saved["output"][field] == "Confirm the fictional folder and pickup location."
    assert saved["output"]["suggestions"] == draft["output"]["suggestions"]
    assert saved["review"] == {}
    assert client.get("/api/tasks", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).json() == []

def test_rejection_and_validation_errors_persist_no_unapproved_actions(client, patient_workspace, monkeypatch):
    auth, account, _, _, _ = patient_workspace
    draft = generated(client, auth, monkeypatch)
    url = f"/api/ai/drafts/{draft['id']}/review"
    assert client.post(url, headers=auth, json={"action": "approve", "edited_text": "   "}).status_code == 422
    assert client.get(f"/api/ai/drafts/{draft['id']}", headers=auth).json()["status"] == "Ready"
    assert client.post(url, headers=auth, json={"action": "reject", "suggestion_index": 0}).status_code == 200
    assert client.post(url, headers=auth, json={"action": "reject"}).json()["status"] == "Rejected"
    saved = client.get(f"/api/ai/drafts/{draft['id']}", headers=auth).json()
    assert saved["status"] == "Rejected" and saved["review"]["0"]["action"] == "reject"
    assert client.get("/api/tasks", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).json() == []

def test_review_enforces_draft_ownership_and_current_permissions(client, patient_workspace, monkeypatch):
    auth, account, other, caregiver, _ = patient_workspace
    other_auth, _ = other("Other review owner")
    draft = generated(client, auth, monkeypatch)
    assert client.post(f"/api/ai/drafts/{draft['id']}/review", headers=other_auth, json={"action": "approve"}).status_code == 404
    member_auth, member = caregiver(auth)
    permission(client, auth, account, member["caregiver_id"], "Coordination tasks")
    draft = generated(client, member_auth, monkeypatch)
    permission(client, auth, account, member["caregiver_id"], "Coordination tasks", False)
    assert client.post(f"/api/ai/drafts/{draft['id']}/review", headers=member_auth, json={"action": "approve"}).status_code == 403

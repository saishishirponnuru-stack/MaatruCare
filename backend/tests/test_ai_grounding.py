"""Deterministic Gemini doubles; never send notes externally or use the local DB."""
import json
from types import SimpleNamespace

import pytest
from app.ai_schemas import WorkspaceOutput
from app.services import ai_service as service
from app.services.ai_grounding import verify_workspace, WorkspaceVerificationError
from app.routers import ai
from test_functional_repairs import patient_workspace

ORIGINAL = ("Ananya has confirmed transportation for the appointment on 2026-11-18 at 10:30 AM. "
    "Meera has prepared the appointment documents. Priya will accompany Meera to the appointment. "
    "The clinic location is still unconfirmed. Ananya will be unavailable on 2026-11-18, so Priya will coordinate transportation that day. "
    "The appointment time has been confirmed, but the clinic address still needs verification.")


def handoff():
    quote = "Ananya will be unavailable on 2026-11-18, so Priya will coordinate transportation that day."
    return {"summary": "Priya will coordinate transport while Ananya is unavailable; clinic address needs verification.",
        "facts": [{"text": "The appointment is at 10:30 AM on 2026-11-18.", "source_quote": ORIGINAL.split(". ")[0] + "."}],
        "dates": ["2026-11-18"], "times": ["10:30 AM"], "people": ["Ananya", "Meera", "Priya"],
        "responsibilities": [{"text": "Priya takes over transportation on the stated date.", "source_quote": quote}],
        "missing_information": ["Verify clinic address.", "Clarify the earlier transport confirmation versus Ananya's unavailability."],
        "suggestions": [{"title": "Verify clinic address", "kind": "Suggestion", "source_quote": "The clinic location is still unconfirmed.", "assignee_name": None, "due_date": None}],
        "handoff_title": "Transport coordination transfer", "handoff_summary": "Priya will coordinate transportation on 2026-11-18. Clinic address remains unconfirmed."}


def provider(monkeypatch, outputs):
    calls, closed = [], []
    def generate(**kwargs):
        calls.append(kwargs)
        result = outputs[min(len(calls) - 1, len(outputs) - 1)]
        if isinstance(result, Exception): raise result
        return SimpleNamespace(text=result if isinstance(result, str) else json.dumps(result, ensure_ascii=False))
    monkeypatch.setenv("GEMINI_API_KEY", "isolated-test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    monkeypatch.setattr(service.genai, "Client", lambda **_: SimpleNamespace(models=SimpleNamespace(generate_content=generate), close=lambda: closed.append(True)))
    return calls, closed


def test_original_handoff_with_exact_evidence_and_unresolved_address_succeeds_once(monkeypatch):
    calls, closed = provider(monkeypatch, [handoff()])
    result = service.generate_workspace(ORIGINAL, "handoff_draft", "English")
    assert len(calls) == 1 and closed == [True]
    assert result["suggestions"][0]["due_date"] is None
    assert "unconfirmed" in result["handoff_summary"]
    assert calls[0]["model"] == "gemini-3.5-flash"


@pytest.mark.parametrize("failure", ["quote", "time", "date", "person", "assignee", "deadline", "schema"])
def test_one_targeted_correction_of_actual_failed_field(monkeypatch, caplog, failure):
    invalid = handoff()
    if failure == "quote": invalid["responsibilities"][0]["source_quote"] = "Ananya is unavailable ... Priya will coordinate transportation."
    if failure == "time": invalid["times"] = ["10:30am"]
    if failure == "date": invalid["dates"] = ["18 November 2026"]
    if failure == "person": invalid["people"] = ["Invented Person"]
    if failure == "assignee": invalid["suggestions"][0]["assignee_name"] = "Invented Person"
    if failure == "deadline": invalid["suggestions"][0]["due_date"] = "2026-11-19"
    if failure == "schema": invalid["suggestions"][0]["due_date"] = "tomorrow"
    calls, _ = provider(monkeypatch, [invalid, handoff()])
    assert service.generate_workspace(ORIGINAL, "handoff_draft", "English")["times"] == ["10:30 AM"]
    assert len(calls) == 2 and calls[1]["contents"] == ORIGINAL
    assert "Validation correction" not in calls[0]["config"].system_instruction
    correction = calls[1]["config"].system_instruction.split("Validation correction")[1]
    assert any(field in correction for field in ["source_quote", "times", "dates", "people", "assignee_name", "due_date"])
    assert "Invented Person" not in caplog.text and ORIGINAL not in caplog.text
    assert all(call["config"].http_options.retry_options.attempts == 1 for call in calls)


@pytest.mark.parametrize("note,language,summary", [
    ("Asha cannot drive. Dev will handle the ride. Address unknown.", "English", "Dev takes over the ride; verify the address."),
    ("hey, can't do the ride now. Sam's taking over. where's pickup?", "English", "Sam is taking over; pickup location needs clarification."),
    ("कल गाड़ी का इंतज़ाम करना है। जगह तय नहीं है।", "Hindi", "जगह की पुष्टि अभी बाकी है।"),
    ("రేపు ప్రయాణం ఏర్పాటు చేయాలి. స్థలం ఇంకా తెలియదు.", "Telugu", "స్థలం నిర్ధారణ కావాలి."),
    ("Ride कल arrange करना. pickup స్థలం unknown.", "English", "Arrange the ride; pickup location remains unresolved."),
    ("Documents ready; pickup? no time yet", "English", "Documents are ready. Clarify pickup time."),
    ("I enjoyed looking at the clouds today.", "English", "No coordination logistics were provided."),
])
def test_varied_notes_and_reviewable_paraphrases_need_no_rigid_sentence_template(monkeypatch, note, language, summary):
    output = {"summary": summary, "facts": [] if "clouds" in note else [{"text": summary, "source_quote": note}], "missing_information": [] if "clouds" in note else ["Clarify unresolved logistics."]}
    calls, _ = provider(monkeypatch, [output])
    result = service.generate_workspace(note, "handoff_draft", language)
    assert result["summary"] == summary
    assert len(calls) == 1 and not result["suggestions"]


def test_explicit_iso_deadline_is_retained_but_implied_deadline_is_not_invented(monkeypatch):
    note = "Prepare documents by 2026-11-18. Appointment tomorrow; address unknown."
    output = {"summary": "Prepare documents; clarify appointment location.", "suggestions": [{"title": "Prepare documents", "kind": "From note", "source_quote": "Prepare documents by 2026-11-18.", "due_date": "2026-11-18"}, {"title": "Confirm address", "kind": "Suggestion", "source_quote": "Appointment tomorrow; address unknown.", "due_date": None}]}
    provider(monkeypatch, [output]); result = service.generate_workspace(note, "extract_tasks", "English")
    assert [s["due_date"] for s in result["suggestions"]] == ["2026-11-18", None]


@pytest.mark.parametrize("kind", ["quote", "fact", "schema"])
def test_repeated_invalid_output_is_rejected_after_two_calls(monkeypatch, kind):
    invalid = handoff()
    if kind == "quote": invalid["facts"][0]["source_quote"] = "A fabricated clinic address."
    if kind == "fact": invalid["dates"] = ["2099-12-31"]
    if kind == "schema": invalid = {"summary": 123}
    calls, closed = provider(monkeypatch, [invalid])
    with pytest.raises(ValueError): service.generate_workspace(ORIGINAL, "handoff_draft", "English")
    assert len(calls) == 2 and closed == [True]


@pytest.mark.parametrize("operation", list(service.WORKSPACE_INSTRUCTIONS))
def test_all_modes_share_grounding_and_preserve_first_attempt_success(monkeypatch, operation):
    calls, _ = provider(monkeypatch, [handoff()])
    assert service.generate_workspace(ORIGINAL, operation, "English")["summary"]
    assert len(calls) == 1


def test_retry_stays_in_existing_route_budget(monkeypatch):
    invalid = handoff(); invalid["times"] = ["10:30am"]
    calls, _ = provider(monkeypatch, [invalid, handoff()])
    clock = iter([100, 100, 118]); monkeypatch.setattr(service.time, "monotonic", lambda: next(clock))
    service.generate_workspace(ORIGINAL, "handoff_draft", "English")
    assert [call["config"].http_options.timeout for call in calls] == [18000, 5000]


def test_unverified_recovery_never_saves_a_draft_or_task(client, patient_workspace, monkeypatch, db_session):
    from sqlalchemy import select, func
    from app.models import AIDraft, Task
    auth, account, *_ = patient_workspace
    invalid = handoff(); invalid["people"] = ["Invented Person"]
    calls, _ = provider(monkeypatch, [invalid]); ai._request_times.clear()
    before = [db_session.scalar(select(func.count(model.id)).where(model.patient_id == account["patient_id"])) for model in (AIDraft, Task)]
    response = client.post("/api/ai/workspace", headers=auth, json={"note": ORIGINAL, "operation": "handoff_draft", "external_processing_consent": True})
    assert response.status_code == 502 and "records are unchanged" in response.json()["detail"]
    assert len(calls) == 2
    assert before == [db_session.scalar(select(func.count(model.id)).where(model.patient_id == account["patient_id"])) for model in (AIDraft, Task)]


def test_persistence_boundary_checks_grounding_even_if_generator_is_substituted():
    invalid = handoff(); invalid["facts"][0]["source_quote"] = "Fabricated quotation"
    with pytest.raises(WorkspaceVerificationError): verify_workspace(WorkspaceOutput.model_validate(invalid), ORIGINAL)


def test_informal_handoff_requires_no_template(monkeypatch):
    note = "ananya cant come tmrw meera docs priya cab"
    output = {
        "summary": "Ananya cannot attend; Meera handles documents and Priya transport.",
        "facts": [
            {
                "text": "Ananya cannot attend.",
                "source_quote": "ananya cant come tmrw"
            }
        ],
        "responsibilities": [
            {
                "text": "Priya handles transport.",
                "source_quote": "priya cab"
            }
        ]
    }
    calls, _ = provider(monkeypatch, [output])
    result = service.generate_workspace(note, "handoff_draft", "English")
    assert len(calls) == 1
    assert result["responsibilities"]

import logging
import json
import os
import re
import threading
import time
import hashlib
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AIDraft, Task
from ..ai_schemas import WorkspaceRequest, WorkspaceOutput, DraftReview
from ..services.ai_service import generate_workspace
from ..services.ai_draft_service import own_draft
from ..services.access_service import get_active_caregiver, require_permission
from ..services.audit_service import record_audit

from ..services.ai_service import AIProviderError, generate_coordination_summary
from ..services.auth_service import require_current_account

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])

RATE_LIMIT = max(1, min(1000, int(os.getenv("AI_RATE_LIMIT", "20"))))
RATE_WINDOW = 3600
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))
PERSONAL_DATA_PATTERNS = (
    re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?<!\w)(?:\+?\d[\d ().-]{7,}\d)(?!\w)"),
    re.compile(r"\b(?:patient\s*id|mrn|medical record number|date of birth|dob|ssn)\s*[:#-]?\s*[A-Za-z0-9/-]+", re.IGNORECASE),
)
CLINICAL_CONTENT_PATTERN = re.compile(
    r"\b(?:diagnos\w*|symptom\w*|medication\w*|prescription\w*|dosage|lab results?|test results?|blood pressure|ultrasound|scan findings?|treat\w*|therap\w*|bleed\w*|hemorrhag\w*)\b",
    re.IGNORECASE,
)


def contains_personal_data(note: str) -> bool:
    if PERSONAL_DATA_PATTERNS[0].search(note) or PERSONAL_DATA_PATTERNS[2].search(note):
        return True
    return any(
        len(re.sub(r"\D", "", candidate.group())) >= 10
        for candidate in PERSONAL_DATA_PATTERNS[1].finditer(note)
    )

_request_times = defaultdict(list)
_lock = threading.Lock()


class CoordinationRequest(BaseModel):
    note: str = Field(min_length=10, max_length=3000)
    external_processing_consent: bool = False


@router.post("/coordination-summary")
def coordination_summary(payload: CoordinationRequest, request: Request):
    account = require_current_account(request)

    if contains_personal_data(payload.note):
        raise HTTPException(
            status_code=400,
            detail="Remove personal identifiers; use fictional coordination notes only.",
        )
    if CLINICAL_CONTENT_PATTERN.search(payload.note):
        raise HTTPException(
            status_code=400,
            detail="Clinical details are not supported; submit non-clinical coordination only.",
        )
    if not payload.external_processing_consent:
        raise HTTPException(400, "Confirm that the note is fictional or de-identified and may be sent to Gemini")

    client_ip = f"account:{account.id or account.subject}"
    now = time.monotonic()

    with _lock:
        recent = [
            timestamp
            for timestamp in _request_times[client_ip]
            if now - timestamp < RATE_WINDOW
        ]

        if len(recent) >= RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Demo request limit reached. Please try again later.",
            )

        recent.append(now)
        _request_times[client_ip] = recent

    if not _workspace_capacity.acquire(blocking=False):
        raise HTTPException(429, "AI is busy. Try again shortly.")
    future = _workspace_executor.submit(generate_coordination_summary, payload.note)
    future.add_done_callback(lambda _: _workspace_capacity.release())
    try:
        return future.result(timeout=AI_TIMEOUT_SECONDS)
    except FutureTimeoutError as exc:
        logger.warning("AI coordination request timed out")
        raise HTTPException(status_code=504, detail="AI assistance timed out; please try again.") from exc
    except AIProviderError as exc:
        logger.warning("AI provider failure category=%s", exc.category)
        details = {
            "missing configuration": "AI provider is not configured.",
            "invalid credentials": "AI provider credentials were rejected.",
            "unsupported model": "The configured AI model is unavailable.",
            "quota exhausted": "AI provider quota is exhausted; please try again later.",
            "rate limited": "AI provider is rate limited; please try again later.",
            "timeout": "AI assistance timed out; please try again.",
            "provider unavailable": "AI provider is temporarily unavailable.",
        }
        raise HTTPException(status_code=503, detail=details.get(exc.category, details["provider unavailable"])) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("AI provider returned an invalid response")
        raise HTTPException(status_code=502, detail="AI provider returned an invalid response.") from exc
    except Exception as exc:
        logger.warning("AI coordination request failed")
        raise HTTPException(
            status_code=503,
            detail="AI provider is temporarily unavailable.",
        ) from exc


_workspace_executor = ThreadPoolExecutor(max_workers=2)
_workspace_capacity = threading.BoundedSemaphore(2)
OPERATION_PERMISSION = {"extract_tasks": "Coordination tasks", "care_plan": "Coordination tasks", "appointment_prep": "Appointments", "handoff_draft": "Care handoffs", "update_draft": "Approved care updates", "nutrition_notes": "Lifestyle records"}
ADDITIONAL_CLINICAL = re.compile(r"\b(?:prescribe|supplements?|vitamins?|insulin|metformin|seizures?|emergency|triage|severe pain)\b|दवा|इलाज|निदान|రక్తస్రావం|మందులు|చికిత్స", re.IGNORECASE)


def screen_note(note):
    if contains_personal_data(note):
        raise HTTPException(400, "Remove personal identifiers. Use fictional or de-identified coordination notes.")
    if CLINICAL_CONTENT_PATTERN.search(note) or ADDITIONAL_CLINICAL.search(note):
        raise HTTPException(400, "This assistant organizes non-clinical logistics. For medical or urgent concerns, contact a qualified clinician or local emergency services.")


def account_actor(request, db):
    account = require_current_account(request)
    if not account.id or not account.patient_id or not account.caregiver_id:
        raise HTTPException(403, "Complete account setup before using this workspace")
    actor = get_active_caregiver(db, account.caregiver_id)
    return account, actor


def draft_response(draft):
    return {"id": draft.id, "operation": draft.operation, "status": draft.status, "output": json.loads(draft.output_json), "review": json.loads(draft.review_json), "created_at": draft.created_at, "requires_human_review": True}


@router.post("/workspace")
def workspace(payload: WorkspaceRequest, request: Request, db: Session = Depends(get_db)):
    account, actor = account_actor(request, db)
    if payload.operation in OPERATION_PERMISSION:
        require_permission(db, actor, OPERATION_PERMISSION[payload.operation])
    screen_note(payload.note)
    if not payload.external_processing_consent:
        raise HTTPException(400, "Confirm fictional or de-identified content and external Gemini processing before continuing")
    key = f"account:{account.id}"
    now = time.monotonic()
    with _lock:
        recent = [stamp for stamp in _request_times[key] if now - stamp < RATE_WINDOW]
        if len(recent) >= RATE_LIMIT:
            raise HTTPException(429, "AI request limit reached. Please try again later.")
        _request_times[key] = [*recent, now]
    if not _workspace_capacity.acquire(blocking=False):
        raise HTTPException(429, "AI is busy. Try again shortly.")
    future = _workspace_executor.submit(generate_workspace, payload.note, payload.operation, payload.language)
    future.add_done_callback(lambda _: _workspace_capacity.release())
    try:
        output = WorkspaceOutput.model_validate(future.result(timeout=25))
        for fact in [*output.facts, *output.responsibilities, *output.suggestions]:
            if fact.source_quote not in payload.note:
                raise ValueError("Unsupported source reference")
        for value in [*output.dates, *output.times, *output.people]:
            if not value or value not in payload.note:
                raise ValueError("Unsupported extracted fact")
        for suggestion in output.suggestions:
            if suggestion.assignee_name and suggestion.assignee_name not in payload.note:
                raise ValueError("Unsupported assignee")
            if suggestion.due_date and suggestion.due_date.isoformat() not in payload.note:
                raise ValueError("Ambiguous date requires human clarification")
        screen_note(json.dumps(output.model_dump(mode="json"), ensure_ascii=False))
    except FutureTimeoutError:
        raise HTTPException(504, "AI took too long. Your care records are unchanged.") from None
    except AIProviderError as exc:
        detail = "AI is not configured in this environment." if exc.category == "missing configuration" else "AI is temporarily unavailable. Your care records are unchanged."
        raise HTTPException(503, detail) from None
    except (ValueError, TypeError, HTTPException):
        raise HTTPException(502, "The response could not be verified against your note. Edit the note and try again.") from None
    except Exception:
        logger.warning("AI workspace generation failed")
        raise HTTPException(503, "AI is temporarily unavailable. Your care records are unchanged.") from None
    if payload.operation == "care_plan":
        # Compare locally; existing record titles are never sent to the model.
        from ..services.ai_draft_service import normalized_task_title
        existing_titles = {normalized_task_title(title) for title in db.scalars(select(Task.title).where(Task.patient_id == account.patient_id, Task.status != "Completed")).all()}
        distinct = []
        for suggestion in output.suggestions:
            key = normalized_task_title(suggestion.title)
            if key not in existing_titles:
                distinct.append(suggestion)
                existing_titles.add(key)
        if len(distinct) != len(output.suggestions):
            output.missing_information = [*output.missing_information[:7], "Repeated proposals and tasks already open in your workspace were omitted. Review Tasks for existing responsibilities."]
        output.suggestions = distinct
    draft = AIDraft(patient_id=account.patient_id, account_id=account.id, operation=payload.operation, source_hash=hashlib.sha256(payload.note.encode()).hexdigest(), output_json=output.model_dump_json(), status="Ready")
    db.add(draft)
    db.flush()
    record_audit(db, patient_id=account.patient_id, actor_name=account.name, action="ai_draft_created", resource_type="AIDraft", resource_id=draft.id)
    db.commit()
    return draft_response(draft)


@router.get("/drafts")
def drafts(request: Request, db: Session = Depends(get_db)):
    account, actor = account_actor(request, db)
    records = db.scalars(select(AIDraft).where(AIDraft.account_id == account.id, AIDraft.patient_id == account.patient_id).order_by(AIDraft.id.desc()).limit(10)).all()
    visible = []
    for item in records:
        try:
            if item.operation in OPERATION_PERMISSION:
                require_permission(db, actor, OPERATION_PERMISSION[item.operation])
        except HTTPException as exc:
            if exc.status_code == 403:
                continue
            raise
        visible.append(draft_response(item))
    return visible


@router.get("/drafts/{draft_id}")
def read_draft(draft_id: int, request: Request, db: Session = Depends(get_db)):
    _, actor = account_actor(request, db)
    draft = own_draft(db, draft_id)
    if draft.operation in OPERATION_PERMISSION:
        require_permission(db, actor, OPERATION_PERMISSION[draft.operation])
    return draft_response(draft)


@router.post("/drafts/{draft_id}/review")
def review(draft_id: int, payload: DraftReview, request: Request, db: Session = Depends(get_db)):
    account, actor = account_actor(request, db)
    draft = own_draft(db, draft_id)
    if draft.operation in OPERATION_PERMISSION:
        require_permission(db, actor, OPERATION_PERMISSION[draft.operation])
    output = json.loads(draft.output_json)
    decisions = json.loads(draft.review_json)
    if payload.suggestion_index is not None:
        if payload.suggestion_index >= len(output.get("suggestions", [])):
            raise HTTPException(422, "Suggestion not found")
        previous = decisions.get(str(payload.suggestion_index), {})
        if previous.get("task_id"):
            raise HTTPException(409, "This suggestion already created a task. Manage it under Tasks.")
        decisions[str(payload.suggestion_index)] = {"action": payload.action}
    else:
        if payload.edited_text is not None:
            screen_note(payload.edited_text)
            if not payload.edited_text.strip(): raise HTTPException(422, "The draft cannot be empty")
            output["care_update" if draft.operation == "update_draft" else "handoff_summary" if draft.operation == "handoff_draft" else "summary"] = payload.edited_text.strip()
            draft.output_json = json.dumps(output)
        draft.status = "Approved" if payload.action == "approve" else "Rejected"
    draft.review_json = json.dumps(decisions)
    record_audit(db, patient_id=account.patient_id, actor_name=account.name, action="ai_draft_approved" if payload.action == "approve" else "ai_draft_rejected", resource_type="AIDraft", resource_id=draft.id)
    db.commit()
    return draft_response(draft)

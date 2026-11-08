import json
import unicodedata
from fastapi import HTTPException
from sqlalchemy import select
from ..models import AIDraft, Task, CareHandoff, Patient
from .auth_service import get_current_account
from .audit_service import record_audit


def normalized_task_title(title):
    return " ".join(unicodedata.normalize("NFKC", title).casefold().split())


def own_draft(db, draft_id, patient_id=None):
    account = get_current_account()
    draft = db.get(AIDraft, draft_id)
    if account is None or draft is None or draft.account_id != account.id or draft.patient_id != account.patient_id or patient_id is not None and draft.patient_id != patient_id:
        raise HTTPException(404, "Draft not found")
    return draft


def validate_task_approval(db, payload):
    draft = own_draft(db, payload.ai_draft_id, payload.patient_id)
    if not payload.human_approved:
        raise HTTPException(403, "Review and approve this suggestion before creating a task")
    suggestions = json.loads(draft.output_json).get("suggestions", [])
    index = payload.ai_suggestion_index
    if index is None or index >= len(suggestions) or draft.operation not in {"extract_tasks", "appointment_prep", "summarize", "care_plan"}:
        raise HTTPException(422, "Choose a task suggestion from this draft")
    if draft.status == "Rejected" or json.loads(draft.review_json).get(str(index), {}).get("action") == "reject":
        raise HTTPException(409, "This suggestion was rejected")
    existing = db.scalar(select(Task).where(Task.ai_draft_id == draft.id, Task.ai_suggestion_index == index))
    if existing is not None:
        return existing
    if draft.operation == "care_plan":
        # Serialize approvals for this workspace on PostgreSQL, including
        # proposals from different drafts. Existing per-suggestion uniqueness
        # still protects repeated submissions of the same draft.
        db.scalar(select(Patient.id).where(Patient.id == payload.patient_id).with_for_update())
        titles = db.scalars(select(Task.title).where(Task.patient_id == payload.patient_id, Task.status != "Completed")).all()
        if any(normalized_task_title(title) == normalized_task_title(payload.title) for title in titles):
            raise HTTPException(409, "An open task with this title already exists. Review it in Tasks or give this responsibility a distinct title.")
    return None


def record_task_approval(db, payload, task, actor_name):
    draft = own_draft(db, payload.ai_draft_id, payload.patient_id)
    review = json.loads(draft.review_json)
    review[str(payload.ai_suggestion_index)] = {"action": "approve", "task_id": task.id}
    draft.review_json = json.dumps(review)
    draft.status = "Approved"
    record_audit(db, patient_id=draft.patient_id, actor_name=actor_name, action="ai_draft_approved", resource_type="AIDraft", resource_id=draft.id)


def validate_handoff_approval(db, draft_id, human_approved, patient_id):
    draft = own_draft(db, draft_id, patient_id)
    if not human_approved:
        raise HTTPException(403, "Review and approve this draft before creating a handoff")
    if draft.operation != "handoff_draft" or draft.status == "Rejected":
        raise HTTPException(409, "This draft cannot create a handoff")
    return db.scalar(select(CareHandoff).where(CareHandoff.ai_draft_id == draft.id))


def record_handoff_approval(db, draft_id, handoff, actor_name):
    draft = own_draft(db, draft_id, handoff.patient_id)
    draft.status = "Approved"
    draft.review_json = json.dumps({"handoff_id": handoff.id, "action": "approve"})
    record_audit(db, patient_id=draft.patient_id, actor_name=actor_name, action="ai_draft_approved", resource_type="AIDraft", resource_id=draft.id)

"""Signed, short-lived deletion previews; only the existing local/demo gate uses this."""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import HTTPException
from sqlalchemy import select, delete

from ..lifestyle_models import ActivityLog, ActivityRoutine, DietAdherence, DietRecommendation, LifestylePreference, NutritionLog, SleepLog, WaterLog, WeightEntry
from .auth_service import get_current_account

# Process-local: restarting invalidates outstanding confirmations. Production
# remains disabled; a shared signing/retention design needs separate approval.
_key = secrets.token_bytes(32)


def snapshot(db, patient_id, reset_preferences=False, lock=False):
    filters = {
        "water": (WaterLog, WaterLog.patient_id == patient_id),
        "sleep": (SleepLog, SleepLog.patient_id == patient_id),
        "weight": (WeightEntry, WeightEntry.patient_id == patient_id),
        "nutrition": (NutritionLog, NutritionLog.patient_id == patient_id),
        "diet_adherence": (DietAdherence, DietAdherence.recommendation_id.in_(select(DietRecommendation.id).where(DietRecommendation.patient_id == patient_id))),
        "activity_logs": (ActivityLog, ActivityLog.routine_id.in_(select(ActivityRoutine.id).where(ActivityRoutine.patient_id == patient_id))),
    }
    if reset_preferences:
        filters["preferences"] = (LifestylePreference, LifestylePreference.patient_id == patient_id)
    records = {}
    fingerprint = {}
    for category, (model, condition) in filters.items():
        query = select(model).where(condition).order_by(model.id)
        rows = db.scalars(query.with_for_update() if lock else query).all()
        records[category] = (model, [row.id for row in rows])
        # Compare values as well as IDs/counts. No deleted content is returned
        # to the browser, placed in the token, logged, or copied into the audit.
        fingerprint[category] = [[getattr(row, col.name) for col in model.__table__.columns] for row in rows]
    digest = hashlib.sha256(json.dumps(fingerprint, default=str, sort_keys=True).encode()).hexdigest()
    return records, digest


def actor_key(actor):
    account = get_current_account()
    return account.subject if account else f"isolated-legacy-test:{actor.id}"


def preview(db, patient_id, actor, reset_preferences=False):
    records, digest = snapshot(db, patient_id, reset_preferences)
    counts = {name: len(ids) for name, (_, ids) in records.items()}
    body = json.dumps({"patient": patient_id, "actor": actor_key(actor), "preferences": reset_preferences,
                       "digest": digest, "expires": time.time() + 300}, sort_keys=True).encode()
    encoded = base64.urlsafe_b64encode(body).decode().rstrip("=")
    signature = hmac.new(_key, encoded.encode(), hashlib.sha256).hexdigest()
    return counts, f"{encoded}.{signature}"


def validate(token, *, patient_id, actor, reset_preferences, digest):
    try:
        encoded, signature = token.split(".")
        if not hmac.compare_digest(signature, hmac.new(_key, encoded.encode(), hashlib.sha256).hexdigest()):
            raise ValueError()
        body = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if body["expires"] <= time.time() or body["patient"] != patient_id or body["actor"] != actor_key(actor) or body["preferences"] != reset_preferences or body["digest"] != digest:
            raise ValueError()
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(409, "Your deletion preview expired or records changed. Review a fresh preview before confirming.") from None


def delete_snapshot(db, records):
    counts = {}
    for category, (model, ids) in records.items():
        counts[category] = 0
        # Exact IDs, never a broad patient predicate after preview. Concurrent
        # new entries cannot accidentally join the deletion set. Chunk for SQLite.
        for offset in range(0, len(ids), 400):
            counts[category] += db.execute(delete(model).where(model.id.in_(ids[offset:offset + 400]))).rowcount
    return counts

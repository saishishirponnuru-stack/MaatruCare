import logging
import os
import threading
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..services.ai_service import generate_coordination_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])

DEMO_NOTES = {
    "priya will collect the appointment documents. arjun will arrange transport for the clinic visit.",
    "rahul will arrange transport for the appointment. lakshmi will prepare the necessary documents.",
}

RATE_LIMIT = 5
RATE_WINDOW = 3600

_request_times = defaultdict(list)
_lock = threading.Lock()


class CoordinationRequest(BaseModel):
    note: str = Field(min_length=10, max_length=3000)


@router.post("/coordination-summary")
def coordination_summary(payload: CoordinationRequest, request: Request):
    if os.getenv("AI_PUBLIC_DEMO_MODE", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="Public AI demo is currently disabled.",
        )

    normalized_note = " ".join(payload.note.lower().split())

    if normalized_note not in DEMO_NOTES:
        raise HTTPException(
            status_code=400,
            detail="This public demo accepts only approved synthetic notes.",
        )

    client_ip = request.client.host if request.client else "unknown"
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

    try:
        return generate_coordination_summary(payload.note)
    except Exception:
        logger.exception("AI coordination request failed")
        raise HTTPException(
            status_code=503,
            detail="AI assistance is temporarily unavailable.",
        )
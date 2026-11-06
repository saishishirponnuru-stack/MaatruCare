import logging
import os
import re
import threading
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..services.ai_service import generate_coordination_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])

RATE_LIMIT = 5
RATE_WINDOW = 3600
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


@router.post("/coordination-summary")
def coordination_summary(payload: CoordinationRequest, request: Request):
    if os.getenv("AI_PUBLIC_DEMO_MODE", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="Public AI demo is currently disabled.",
        )

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

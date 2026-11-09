"""Loopback-only browser fixtures. Disposable SQLite and synthetic JWTs only."""
import argparse
import os
from pathlib import Path
import secrets
import sys
import tempfile
import time
from uuid import uuid4

import jwt

if os.getenv("RENDER", "").lower() == "true" or os.getenv("MAATRUCARE_ENV", "").lower() == "production":
    raise RuntimeError("Browser fixtures must never run on a production host")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
scratch = tempfile.TemporaryDirectory(prefix="maatrucare-browser-tests-")
secret = secrets.token_urlsafe(48)
polish_tests = os.getenv("MAATRUCARE_BROWSER_POLISH_TESTS") == "true"
os.environ.update(DATABASE_URL=f"sqlite:///{Path(scratch.name) / 'test.sqlite3'}", RENDER="false",
                  MAATRUCARE_ENV="local" if polish_tests else "test", MAATRUCARE_TEST_AUTH_COMPAT="false", MAATRUCARE_SEED_DEMO_DATA="false",
                  MAATRUCARE_DEMO_RESET_ENABLED="true" if polish_tests else "false", MAATRUCARE_DEMO_CAREGIVERS_ENABLED="true",
                  MAATRUCARE_DEMO_ONBOARDING_SEED_ENABLED="true" if polish_tests else "false",
                  MAATRUCARE_DEMO_RESET_PATIENT_IDS=",".join(map(str,range(1,1001))) if polish_tests else "",
                  MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS="1",
                  MAATRUCARE_INVITATION_EMAIL_ENABLED="false", RESEND_API_KEY="", MAATRUCARE_INVITATION_FROM="",
                  MAATRUCARE_PUBLIC_APP_URL="http://localhost:3100",
                  SUPABASE_JWT_SECRET=secret, SUPABASE_ISSUER="", SUPABASE_JWKS_URL="", SUPABASE_AUDIENCE="authenticated",
                  CORS_ORIGINS="http://localhost:3100", GEMINI_API_KEY="")
from app.database import Base, SessionLocal, engine
from app.models import Account, Caregiver, Patient
from app import lifestyle_models  # Register the complete schema before fixture startup.

# sqlite3's legacy DDL mode otherwise commits each table/index individually.
# Keep the disposable schema setup in one durable transaction; application
# transactions and production database configuration are unchanged.
assert engine.dialect.name == "sqlite" and Path(engine.url.database).resolve().parent == Path(scratch.name).resolve()
with engine.connect() as connection:
    # Browser requests overlap reads and writes. WAL prevents a reader from
    # blocking a writer's commit in this throwaway fixture database. Never
    # change the journal mode of a development or production datastore here.
    assert connection.exec_driver_sql("PRAGMA journal_mode=WAL").scalar_one() == "wal"
    connection.exec_driver_sql("BEGIN")
    Base.metadata.create_all(bind=connection)
    connection.commit()
from app.main import app

# Provider substitution is confined to this isolated harness. The application
# still validates, stores and reviews drafts through its normal authenticated APIs.
# No request in this harness reaches Gemini or sends email.
from app.routers import ai as fixture_ai
from app.services.ai_service import AIProviderError

def fixture_generate_workspace(note, operation, language):
    source = "Prepare the fictional folder for the visit."
    if note != f"Fictional coordination note: {source}" or operation not in {"extract_tasks", "care_plan", "summarize", "appointment_prep", "handoff_draft", "update_draft", "nutrition_notes"}:
        raise AIProviderError("provider unavailable")
    return {"summary": source, "care_update": source if operation == "update_draft" else "", "handoff_summary": source if operation == "handoff_draft" else "", "handoff_title": "Fictional folder handoff" if operation == "handoff_draft" else None, "facts": [{"text": source, "source_quote": source}],
            "suggestions": [{"title": "Prepare fictional folder", "kind": "From note", "source_quote": source, "assignee_name": None, "due_date": None}] if operation in {"summarize", "extract_tasks", "appointment_prep", "care_plan"} else []}

fixture_ai.generate_workspace = fixture_generate_workspace

actors = {}
with SessionLocal() as db:
    for key, name in (("A", "Mira Fictional"), ("B", "Nila Fictional")):
        patient = Patient(name=name, email=f"fixture-{key}@example.test", current_phase="Pregnancy")
        db.add(patient)
        db.flush()
        principal = Caregiver(patient_id=patient.id, name=name, relationship="Mother", role="Patient", is_patient=True)
        db.add(principal)
        db.flush()
        account = Account(subject=str(uuid4()), name=name, email=patient.email, role="patient", patient_id=patient.id, caregiver_id=principal.id)
        db.add(account)
        db.flush()
        actors[key] = {"id": account.subject, "email": account.email, "name": name}
    db.commit()
actors["C"] = {"id": str(uuid4()), "email": "new-fixture@example.test", "name": "New Fictional Owner"}


@app.post("/auth/v1/logout", status_code=204)
def fixture_logout():
    # Only the external provider logout response is substituted. Application
    # auth/session cleanup runs unchanged; this is never a real Supabase test.
    from fastapi import Response
    return Response(status_code=204)


@app.get("/__fixture/session")
def fixture_session(actor: str = "A", fresh: bool = False):
    profile = {"id": str(uuid4()), "email": f"fixture-{uuid4()}@example.test", "name": "New Fictional Owner"} if fresh else actors[actor]
    now = int(time.time())
    token = jwt.encode({"sub": profile["id"], "email": profile["email"], "aud": "authenticated", "exp": now + 3600}, secret, algorithm="HS256")
    return {"access_token": token, "refresh_token": "isolated-fixture-only", "token_type": "bearer",
            "expires_in": 3600, "expires_at": now + 3600, "user": {**profile, "aud": "authenticated", "role": "authenticated",
            "app_metadata": {}, "user_metadata": {"name": profile["name"]}, "created_at": "2026-11-08T00:00:00Z"}}


if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18010)
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, access_log=False, log_level="warning")

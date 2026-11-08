"""Shared capability check for explicitly enabled, scoped simulations."""
import os
from sqlalchemy.orm import Session

from ..models import Patient


def demo_mode_enabled() -> bool:
    return os.getenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false").strip().lower() == "true"


def demo_caregivers_available(patient_id: int | None, db: Session | None = None) -> bool:
    if not demo_mode_enabled() or not patient_id:
        return False
    configured_ids = os.getenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", "").strip()
    production = os.getenv("MAATRUCARE_ENV", "local").lower() == "production" or os.getenv("RENDER", "").lower() == "true"
    if configured_ids:
        try:
            allowed_ids = {int(value.strip()) for value in configured_ids.split(",")}
        except ValueError:
            return False
        if patient_id in allowed_ids:
            return True
    elif not production:
        return True
    # This designation is persisted by new-account onboarding, never by a
    # caller-supplied patient ID or a profile update. Existing workspaces stay real.
    patient = db.get(Patient, patient_id) if db is not None else None
    return bool(patient and patient.is_demo_workspace)

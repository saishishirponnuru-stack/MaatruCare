"""Shared capability check for explicitly enabled, scoped simulations."""
import os


def demo_caregivers_available(patient_id: int | None) -> bool:
    if os.getenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false").strip().lower() != "true" or not patient_id:
        return False
    configured_ids = os.getenv("MAATRUCARE_DEMO_CAREGIVER_PATIENT_IDS", "").strip()
    production = os.getenv("MAATRUCARE_ENV", "local").lower() == "production" or os.getenv("RENDER", "").lower() == "true"
    if not configured_ids:
        return not production
    try:
        allowed_ids = {int(value.strip()) for value in configured_ids.split(",")}
    except ValueError:
        return False
    return patient_id in allowed_ids

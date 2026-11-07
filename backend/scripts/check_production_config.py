"""Read-only environment preflight. Prints setting names and checks, never values.

Does not import the application, open a database, call a provider, or migrate data.
"""
import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv


def inspect_config(env):
    errors, warnings = [], []
    url = env.get("DATABASE_URL", "")
    postgres = url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://"))
    persistent_sqlite = url.startswith("sqlite") and "/var/data/" in url and env.get("MAATRUCARE_SQLITE_PERSISTENT", "").lower() == "true"
    if not postgres and not persistent_sqlite:
        errors.append("DATABASE_URL must use managed PostgreSQL or explicitly provisioned /var/data SQLite storage.")
    if persistent_sqlite:
        warnings.append("Verify the /var/data disk mount, backup policy and restore procedure on the actual host.")
    if postgres:
        warnings.append("Database connectivity, retained rows and backup/restore must be verified on the deployment host.")
    if env.get("MAATRUCARE_ENV", "").lower() != "production":
        errors.append("Set MAATRUCARE_ENV=production in the production environment.")
    secret = env.get("SUPABASE_JWT_SECRET", "")
    jwks = env.get("SUPABASE_JWKS_URL", "")
    issuer = env.get("SUPABASE_ISSUER", "")
    if secret:
        if len(secret) < 32 or "replace-with" in secret:
            errors.append("SUPABASE_JWT_SECRET must be the actual legacy HS256 secret with sufficient length, or unset for JWKS verification.")
    elif not jwks.startswith("https://") or "your-project" in jwks:
        errors.append("Configure a valid HTTPS SUPABASE_JWKS_URL for the selected project.")
    if not issuer.startswith("https://") or "your-project" in issuer:
        errors.append("Configure the matching HTTPS SUPABASE_ISSUER.")
    if jwks and issuer and urlparse(jwks).hostname != urlparse(issuer).hostname:
        errors.append("SUPABASE_JWKS_URL and SUPABASE_ISSUER must belong to the same authentication project.")
    origins = [item.strip() for item in env.get("CORS_ORIGINS", "").split(",") if item.strip()]
    if not origins or any(item == "*" or not item.startswith("https://") for item in origins):
        errors.append("CORS_ORIGINS must list the exact HTTPS production frontend origins.")
    for flag in ("MAATRUCARE_TEST_AUTH_COMPAT", "MAATRUCARE_DEMO_RESET_ENABLED", "MAATRUCARE_SEED_DEMO_DATA"):
        if env.get(flag, "false").lower() == "true":
            errors.append(f"Disable {flag} in production.")
    if env.get("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false").lower() == "true":
        warnings.append("Synthetic participants are enabled; keep simulation labels visible and use fictional demonstration data.")
    if not env.get("GEMINI_API_KEY"):
        warnings.append("Gemini generation is unconfigured; saved-record questions and the core application still work.")
    warnings.append("Use one backend worker until AI rate limits are shared across processes.")
    warnings.append("Real health information requires privacy, retention, vendor-processing and operational security review before external AI use.")
    return errors, warnings


if __name__ == "__main__":
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    errors, warnings = inspect_config(os.environ)
    for item in errors:
        print(f"BLOCKER: {item}")
    for item in warnings:
        print(f"CHECK: {item}")
    print("Configuration preflight passed; infrastructure verification is still required." if not errors else "Production configuration preflight is blocked. No data or infrastructure was changed.")
    raise SystemExit(1 if errors else 0)

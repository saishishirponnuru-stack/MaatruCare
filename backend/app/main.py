import os

from .routers import ai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import HTTPException


from .database import Base, SessionLocal, engine
from .models import Patient, Caregiver
from . import lifestyle_models
from .routers import (
    appointments,
    caregivers,
    handoffs,
    patients,
    permissions,
    tasks,
    timeline,
    lifestyle,
    auth,
    analytics,
)
from .dependencies import authenticate_request
from .services.auth_service import set_current_account
from .services.safe_access_logging import install as install_safe_access_logging
install_safe_access_logging()

Base.metadata.create_all(bind=engine)


from .migrations import migrate_schema

migrate_schema(engine)


def initialize_demo_data() -> None:
    """Initialize sample data only when the database is empty."""
    db = SessionLocal()

    try:
        if db.query(Patient).first() is not None:
            return

        if db.query(Caregiver).first() is not None:
            return

        from .seed import seed_database

        seed_database()
    finally:
        db.close()


app = FastAPI(title="MaatruCare API")

class AuthMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request, call_next):
		set_current_account(None)
		if request.url.path.startswith("/api/ai/"):
			try:
				if int(request.headers.get("content-length", "0")) > 16384:
					return JSONResponse(status_code=413, content={"detail": "AI requests must be no larger than 16 KB"})
			except ValueError:
				return JSONResponse(status_code=400, content={"detail": "Invalid request size"})
			body = bytearray()
			async for chunk in request.stream():
				if len(body) + len(chunk) > 16384:
					return JSONResponse(status_code=413, content={"detail": "AI requests must be no larger than 16 KB"})
				body.extend(chunk)
			# Starlette's cached request replays this bounded body to downstream validation.
			request._body = bytes(body)

		try:
			await authenticate_request(request)
		except HTTPException as exc:
			return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
		return await call_next(request)


app.add_middleware(AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://maatru-care.vercel.app").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    # Empty production accounts start empty; seed data is an explicit local option.
    import os
    if os.getenv("MAATRUCARE_SEED_DEMO_DATA", "false").lower() == "true" and os.getenv("MAATRUCARE_ENV", "local").lower() != "production" and os.getenv("RENDER", "").lower() != "true":
        initialize_demo_data()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "MaatruCare API"}


app.include_router(patients.router)
app.include_router(caregivers.router)
app.include_router(tasks.router)
app.include_router(appointments.router)
app.include_router(handoffs.router)
app.include_router(permissions.router)
app.include_router(timeline.router)
app.include_router(lifestyle.router)
app.include_router(auth.router)

app.include_router(ai.router)
app.include_router(analytics.router)

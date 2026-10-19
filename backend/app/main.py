from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .models import Patient, Caregiver
from .routers import (
    appointments,
    caregivers,
    handoffs,
    patients,
    permissions,
    tasks,
    timeline,
)

Base.metadata.create_all(bind=engine)


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://maatru-care.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
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
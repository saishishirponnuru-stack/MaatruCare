from .routers import ai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text

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
)

Base.metadata.create_all(bind=engine)


def migrate_lifestyle_columns() -> None:
    """Add only missing nullable Lifestyle columns to pre-existing SQLite tables."""
    if engine.dialect.name != "sqlite":
        return
    additions = {
        "lifestyle_sleep_logs": {"interruptions": "INTEGER"},
        "lifestyle_activity_logs": {"completion_status": "VARCHAR(30)", "actual_minutes": "INTEGER"},
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


migrate_lifestyle_columns()


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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
app.include_router(lifestyle.router)

app.include_router(ai.router)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import appointments, caregivers, handoffs, patients, tasks, timeline

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MaatruCare API")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
	allow_credentials=True,
	allow_methods=["GET"],
	allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
	return {"status": "ok", "service": "MaatruCare API"}


app.include_router(patients.router)
app.include_router(caregivers.router)
app.include_router(tasks.router)
app.include_router(appointments.router)
app.include_router(handoffs.router)
app.include_router(timeline.router)

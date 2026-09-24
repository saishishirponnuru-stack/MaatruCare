import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.seed import seed_database


@pytest.fixture(scope="module", autouse=True)
def seeded_database() -> None:
    seed_database()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "MaatruCare API"}


def test_patient_retrieval(client: TestClient) -> None:
    response = client.get("/api/patients")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Ananya Rao"


def test_caregiver_retrieval(client: TestClient) -> None:
    response = client.get("/api/caregivers")

    assert response.status_code == 200
    assert [caregiver["name"] for caregiver in response.json()] == ["Rahul Rao", "Lakshmi Rao", "Priya Rao"]


def test_task_retrieval(client: TestClient) -> None:
    response = client.get("/api/tasks")

    assert response.status_code == 200
    assert len(response.json()) == 4
    assert response.json()[0]["status"] == "Open"


def test_handoff_retrieval(client: TestClient) -> None:
    response = client.get("/api/handoffs")

    assert response.status_code == 200
    assert response.json()[0]["title"] == "Appointment coordination"
    assert response.json()[0]["status"] == "Awaiting acknowledgement"


def test_other_read_endpoints(client: TestClient) -> None:
    assert client.get("/api/appointments").status_code == 200
    assert client.get("/api/timeline").status_code == 200

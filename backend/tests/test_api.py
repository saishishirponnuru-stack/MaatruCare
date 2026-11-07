from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "MaatruCare API"}


def test_patient_retrieval(client: TestClient) -> None:
    response = client.get("/api/patients?actor_caregiver_id=1")

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Ananya Rao"


def test_caregiver_retrieval(client: TestClient) -> None:
    response = client.get("/api/caregivers?actor_caregiver_id=1")

    assert response.status_code == 200
    assert [caregiver["name"] for caregiver in response.json()] == ["Rahul Rao", "Lakshmi Rao", "Priya Rao"]


def test_task_retrieval(client: TestClient) -> None:
    response = client.get("/api/tasks?actor_caregiver_id=1")

    assert response.status_code == 200
    assert len(response.json()) == 4
    assert response.json()[0]["status"] == "Open"


def test_handoff_retrieval(client: TestClient) -> None:
    response = client.get("/api/handoffs?actor_caregiver_id=1")

    assert response.status_code == 200
    assert response.json()[0]["title"] == "Appointment coordination"
    assert response.json()[0]["status"] == "Awaiting acknowledgement"


def test_other_read_endpoints(client: TestClient) -> None:
    assert client.get("/api/appointments?actor_caregiver_id=1").status_code == 200
    assert client.get("/api/timeline?actor_caregiver_id=1").status_code == 200


def test_timeline_pagination_is_newest_first_without_overlap(client: TestClient) -> None:
    first = client.get("/api/timeline?actor_caregiver_id=1&limit=2&offset=0")
    second = client.get("/api/timeline?actor_caregiver_id=1&limit=2&offset=2")
    assert first.status_code == 200
    assert second.status_code == 200
    first_events = first.json()
    second_events = second.json()
    assert len(first_events) == 2
    assert len(second_events) == 2
    assert first_events[0]["event_date"] >= first_events[1]["event_date"]
    assert not {event["id"] for event in first_events}.intersection(event["id"] for event in second_events)

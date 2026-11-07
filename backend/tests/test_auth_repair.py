"""Backend identity regressions; all JWTs and workspaces belong to the isolated test DB."""
from uuid import uuid4
from test_functional_repairs import patient_workspace


def test_repeat_signin_retains_workspace_and_records(client, patient_workspace):
    auth, account, _, _, _ = patient_workspace
    created = client.post("/api/tasks",headers=auth,json={"patient_id":account["patient_id"],"actor_caregiver_id":account["caregiver_id"],"owner_patient_id":account["patient_id"],"title":"Retained fictional responsibility","due_date":"2026-11-08","category":"Coordination"})
    assert created.status_code == 201
    again = client.post("/api/auth/bootstrap",headers=auth,json={"name":"Do not replace my saved name","role":"patient"})
    assert again.json()["patient_id"] == account["patient_id"]
    assert again.json()["name"] == account["name"]
    assert client.get("/api/auth/me",headers=auth).json()["subject"] == account["subject"]
    assert any(task["id"] == created.json()["id"] for task in client.get("/api/tasks",headers=auth,params={"actor_caregiver_id":account["caregiver_id"]}).json())
    assert client.get("/api/auth/me").status_code == 401


def test_distinct_verified_subjects_are_not_merged_by_email(client, patient_workspace):
    _, _, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"
    # Different signed identities may never acquire an existing workspace just by email.
    import jwt,time
    def actor(subject):
        return {"Authorization":"Bearer "+jwt.encode({"sub":subject,"email":email,"aud":"authenticated","exp":time.time()+3600},"test-secret",algorithm="HS256")}
    first = client.post("/api/auth/bootstrap",headers=actor(str(uuid4())),json={"role":"patient","name":"First fictional identity"})
    second_auth = actor(str(uuid4()))
    second = client.post("/api/auth/bootstrap",headers=second_auth,json={"role":"patient","name":"Second fictional identity"})
    assert first.status_code == second.status_code == 201
    assert first.json()["patient_id"] != second.json()["patient_id"]
    assert client.get("/api/auth/me",headers=second_auth).json()["name"] == "Second fictional identity"

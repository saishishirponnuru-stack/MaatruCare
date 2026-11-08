"""Explicit local opt-in, no automatic sharing, and all-or-nothing creation."""
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select,func
from app.models import Account,Caregiver,Permission,ConsentRecord,Patient
from app.services import simulated_caregiver_service as service
from test_functional_repairs import patient_workspace,permission


@pytest.fixture
def samples(monkeypatch):
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED","true")
    monkeypatch.setenv("MAATRUCARE_DEMO_ONBOARDING_SEED_ENABLED","true")
    monkeypatch.setenv("MAATRUCARE_ENV","local")
    monkeypatch.setenv("RENDER","false")


def test_explicit_demo_seeds_once_without_auth_accounts_or_permissions(client,patient_workspace,samples,db_session):
    _,_,_,_,headers=patient_workspace
    auth=headers(f"{uuid4()}@example.test");body={"role":"patient","name":"Fictional Sample Owner","demo_workspace":True}
    result=client.post("/api/auth/bootstrap",headers=auth,json=body);assert result.status_code==201
    owner=result.json();pid=owner["patient_id"]
    assert client.post("/api/auth/bootstrap",headers=auth,json=body).json()["patient_id"]==pid
    members=client.get("/api/caregivers",headers=auth,params={"actor_caregiver_id":owner["caregiver_id"]}).json()
    assert [(m["name"],m["relationship"]) for m in members]==[("Ananya Rao","Partner"),("Meera Rao","Mother"),("Priya Sharma","Sister")]
    assert all(m["is_demo"] and m["access_status"]=="Active" and m["email"] is None for m in members)
    ids=[m["id"] for m in members]
    assert db_session.scalar(select(func.count(Account.id)).where(Account.caregiver_id.in_(ids)))==0
    assert not any(db_session.scalars(select(Permission.enabled).where(Permission.caregiver_id.in_(ids))).all())
    assert db_session.scalar(select(func.count(ConsentRecord.id)).where(ConsentRecord.caregiver_id.in_(ids)))==0
    # Sharing is a separate owner action before assigning a fictional task.
    assert permission(client,auth,owner,ids[0],"Coordination tasks").status_code==200
    task=client.post("/api/tasks",headers=auth,json={"patient_id":pid,"actor_caregiver_id":owner["caregiver_id"],"owner_id":ids[0],"title":"Fictional transport","due_date":"2030-01-01","category":"Coordination"})
    assert task.status_code==201,task.text
    assert len(client.get("/api/caregivers",headers=auth,params={"actor_caregiver_id":owner["caregiver_id"]}).json())==3


@pytest.mark.parametrize("environment,render,demo",[("production","false",True),("local","true",True),("local","false",False)])
def test_never_seeds_real_or_production_workspaces(client,patient_workspace,samples,monkeypatch,environment,render,demo):
    _,_,_,_,headers=patient_workspace
    monkeypatch.setenv("MAATRUCARE_ENV",environment);monkeypatch.setenv("RENDER",render)
    result=client.post("/api/auth/bootstrap",headers=headers(f"{uuid4()}@example.test"),json={"role":"patient","name":"Fictional Gate Check","demo_workspace":demo})
    assert result.status_code==201
    owner=result.json()
    # RENDER also disables the compatibility test path; this uses a real test JWT.
    assert client.get("/api/caregivers",headers=headers(owner["subject"]),params={"actor_caregiver_id":owner["caregiver_id"]}).json()==[]


def test_partial_sample_failure_rolls_back_workspace_and_retry_succeeds(client,patient_workspace,samples,monkeypatch,db_session):
    _,_,_,_,headers=patient_workspace
    email=f"{uuid4()}@example.test";auth=headers(email)
    original=service.add_simulated_caregiver;calls=[]
    def fail_second(*args,**kwargs):
        calls.append(True)
        if len(calls)==2:raise RuntimeError("Synthetic sample failure")
        return original(*args,**kwargs)
    monkeypatch.setattr(service,"add_simulated_caregiver",fail_second)
    body={"role":"patient","name":"Fictional Atomic Demo","demo_workspace":True}
    with pytest.raises(RuntimeError,match="Synthetic sample failure"):client.post("/api/auth/bootstrap",headers=auth,json=body)
    assert db_session.scalar(select(Account).where(Account.subject==email)) is None
    assert db_session.scalar(select(Patient).where(Patient.email==email)) is None
    monkeypatch.setattr(service,"add_simulated_caregiver",original)
    result=client.post("/api/auth/bootstrap",headers=auth,json=body);assert result.status_code==201
    pid=result.json()["patient_id"]
    assert db_session.scalar(select(func.count(Caregiver.id)).where(Caregiver.patient_id==pid,Caregiver.is_demo.is_(True)))==3


def test_concurrent_demo_bootstrap_keeps_one_workspace_and_one_sample_circle(client,patient_workspace,samples,db_session):
    _,_,_,_,headers=patient_workspace
    email=f"{uuid4()}@example.test";auth=headers(email)
    body={"role":"patient","name":"Fictional Concurrent Demo","demo_workspace":True}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:client.post("/api/auth/bootstrap",headers=auth,json=body),range(2)))
    assert all(r.status_code==201 for r in results)
    ids={r.json()["patient_id"] for r in results};assert len(ids)==1
    assert db_session.scalar(select(func.count(Patient.id)).where(Patient.email==email))==1
    assert db_session.scalar(select(func.count(Caregiver.id)).where(Caregiver.patient_id==next(iter(ids)),Caregiver.is_demo.is_(True)))==3

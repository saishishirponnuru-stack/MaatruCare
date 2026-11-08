"""Approved destructive testing is confined to conftest's disposable database."""
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import time

import pytest
from sqlalchemy import select,func
from app.database import Base
from app.models import AIDraft,AuditLog
from app.lifestyle_models import WaterLog
from app.services import lifestyle_reset_service as service
from test_functional_repairs import patient_workspace


@pytest.fixture
def reset_case(client,patient_workspace,monkeypatch):
    auth,owner,_,_,_=patient_workspace
    monkeypatch.setenv("MAATRUCARE_ENV","local")
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_ENABLED","true")
    monkeypatch.setenv("MAATRUCARE_DEMO_RESET_PATIENT_IDS",str(owner["patient_id"]))
    identity={"patient_id":owner["patient_id"],"actor_caregiver_id":owner["caregiver_id"]}
    water=client.post("/api/lifestyle/water",headers=auth,json={**identity,"log_date":"2030-01-01","quantity_ml":250,"status":"Adequate"})
    assert water.status_code==200
    def preview(preferences=False):
        r=client.get("/api/lifestyle/reset-preview",headers=auth,params={**identity,"reset_preferences":preferences})
        assert r.status_code==200 and r.json()["enabled"]
        return {**identity,"reset_preferences":preferences,"confirmed":True,"expected_counts":r.json()["counts"],"preview_token":r.json()["preview_token"]}
    return auth,owner,identity,water.json(),preview


def test_reset_preserves_every_unrelated_existing_record_and_adds_audit(client,reset_case,db_session):
    auth,owner,identity,water,preview=reset_case
    # A reviewed AI draft is unrelated to lifestyle history.
    db_session.add(AIDraft(patient_id=owner["patient_id"],account_id=owner["id"],operation="care_plan",status="Approved",source_hash="fictional",output_json='{"summary":"Fictional preserved draft"}'))
    db_session.commit()
    payload=preview();target={"lifestyle_water_logs":{water["id"]}}
    before={table.name:{row.id:tuple(row) for row in db_session.execute(select(table)).all()} for table in Base.metadata.sorted_tables}
    response=client.post("/api/lifestyle/reset",headers=auth,json=payload)
    assert response.status_code==200,response.text
    assert response.json()["deleted"]["water"]==1
    db_session.expire_all()
    for table in Base.metadata.sorted_tables:
        after={row.id:tuple(row) for row in db_session.execute(select(table)).all()}
        for key,value in before[table.name].items():
            if key not in target.get(table.name,set()):assert after.get(key)==value,(table.name,key)
    assert db_session.scalar(select(func.count(AuditLog.id)).where(AuditLog.patient_id==owner["patient_id"],AuditLog.action=="lifestyle_history_reset"))==1
    assert client.post("/api/lifestyle/reset",headers=auth,json=payload).status_code==409


@pytest.mark.parametrize("change",["edit","insert","tamper","expire","no_token"])
def test_stale_or_invalid_confirmation_never_deletes(client,reset_case,db_session,monkeypatch,change):
    auth,_,identity,water,preview=reset_case;payload=preview()
    if change=="edit":
        row=db_session.get(WaterLog,water["id"]);row.quantity_ml=300;db_session.commit()
    elif change=="insert":
        assert client.post("/api/lifestyle/water",headers=auth,json={**identity,"log_date":"2030-01-02","quantity_ml":125,"status":"Adequate"}).status_code==200
    elif change=="tamper":payload["preview_token"]+="broken"
    elif change=="expire":monkeypatch.setattr(service,"time",SimpleNamespace(time=lambda:time.time()+301))
    elif change=="no_token":payload.pop("preview_token")
    assert client.post("/api/lifestyle/reset",headers=auth,json=payload).status_code==409
    db_session.expire_all();assert db_session.get(WaterLog,water["id"]) is not None


def test_partial_deletion_failure_rolls_back_and_allows_safe_retry(client,reset_case,db_session,monkeypatch):
    auth,_,_,water,preview=reset_case;payload=preview();original=service.delete_snapshot
    def fail(db,records):original(db,records);raise RuntimeError("Synthetic reset failure")
    monkeypatch.setattr(service,"delete_snapshot",fail)
    with pytest.raises(RuntimeError,match="Synthetic reset failure"):client.post("/api/lifestyle/reset",headers=auth,json=payload)
    db_session.expire_all();assert db_session.get(WaterLog,water["id"]) is not None
    monkeypatch.setattr(service,"delete_snapshot",original)
    assert client.post("/api/lifestyle/reset",headers=auth,json=payload).status_code==200


def test_concurrent_duplicate_confirmation_only_executes_once(client,reset_case,db_session):
    auth,owner,_,_,preview=reset_case;payload=preview()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:client.post("/api/lifestyle/reset",headers=auth,json=payload).status_code,range(2)))
    assert sorted(results)==[200,409]
    assert db_session.scalar(select(func.count(AuditLog.id)).where(AuditLog.patient_id==owner["patient_id"],AuditLog.action=="lifestyle_history_reset"))==1


def test_other_identity_cannot_use_owner_confirmation(client,reset_case,patient_workspace,db_session):
    auth,owner,_,water,preview=reset_case;payload=preview()
    _,_,other,caregiver,_=patient_workspace
    other_auth,_=other("Fictional other owner");caregiver_auth,_=caregiver(auth)
    for headers in [other_auth,caregiver_auth]:
        assert client.post("/api/lifestyle/reset",headers=headers,json=payload).status_code==403
    db_session.expire_all();assert db_session.get(WaterLog,water["id"]) is not None

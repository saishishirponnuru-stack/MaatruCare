"""JWT regression checks use disposable test records; no real email or database."""
from datetime import date, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import create_engine, select, text, update

from test_functional_repairs import patient_workspace, permission
from app.models import Account, AuditLog, Caregiver, CaregiverInvitation, CareHandoff, Patient, Permission, TimelineEvent
from app.services import invitation_email_service as mail


def simulated(client, auth, account, monkeypatch):
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
    result = client.post("/api/caregivers/demo", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": 987654, "name": "Fictional Friend", "relationship": "Friend", "role": "Support caregiver", "coordination_access": True})
    assert result.status_code == 201, result.text
    assert result.json()["is_demo"]
    return result.json()


def create(client, auth, account, recipient):
    response = client.post("/api/handoffs", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": 987654, "from_caregiver_id": account["caregiver_id"], "to_caregiver_id": recipient, "title": "Coordinate fictional transport", "reason": "Arrange pickup", "context": "Confirm time"})
    assert response.status_code == 201, response.text
    return response.json()


def transition(client, auth, handoff, action):
    return client.post(f"/api/handoffs/{handoff['id']}/{action}", headers=auth, json={"actor_caregiver_id": 987654})


def test_owner_authority_ignores_self_permissions_and_relationship(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, _ = patient_workspace
    member = db_session.get(Caregiver, account["caregiver_id"])
    member.relationship = "Mother"
    db_session.execute(update(Permission).where(Permission.caregiver_id == member.id).values(enabled=False))
    db_session.commit()
    recipient = simulated(client, auth, account, monkeypatch)
    saved = create(client, auth, account, recipient["id"])
    assert saved["status"] == "Prepared"
    for action, status, timestamp in [("send", "Awaiting acknowledgement", "sent_at"), ("acknowledge", "Acknowledged", "acknowledged_at"), ("complete", "Completed", "completed_at")]:
        result = transition(client, auth, saved, action)
        assert result.status_code == 200, result.text
        assert result.json()["status"] == status and result.json()[timestamp]
        assert transition(client, auth, saved, action).status_code == 409
    refreshed = client.get(f"/api/handoffs/{saved['id']}", headers=auth, params={"actor_caregiver_id": 987654}).json()
    assert refreshed["status"] == "Completed" and refreshed["to_is_demo"]
    assert refreshed["reason"] == "Arrange pickup" and refreshed["context"] == "Confirm time"
    rows = db_session.scalars(select(AuditLog).where(AuditLog.resource_type == "CareHandoff", AuditLog.resource_id == saved["id"]).order_by(AuditLog.id)).all()
    assert [row.action for row in rows] == ["handoff_created", "handoff_sent", "handoff_acknowledged_simulated", "handoff_completed_simulated"]
    assert all(row.actor_account_id == account["id"] and row.actor_subject == account["subject"] and row.actor_caregiver_id == account["caregiver_id"] for row in rows)
    assert [row.simulated for row in rows] == [False, False, True, True]
    events = db_session.scalars(select(TimelineEvent).where(TimelineEvent.resource_type == "CareHandoff", TimelineEvent.resource_id == saved["id"]).order_by(TimelineEvent.id)).all()
    assert len(events) == 4 and events[-1].simulated and events[-1].actor_name == account["name"]
    assert all(not row.enabled for row in db_session.scalars(select(Permission).where(Permission.caregiver_id == member.id)).all())
    assert permission(client, auth, account, member.id, "Care handoffs").status_code == 403


def test_real_recipient_binding_revocation_and_workspace_isolation(client, patient_workspace, db_session):
    auth, account, mother, caregiver, _ = patient_workspace
    recipient_auth, recipient = caregiver(auth)
    other_auth, other_member = caregiver(auth)
    unrelated_auth, _ = mother("Other care workspace")
    for member in [recipient, other_member]:
        assert permission(client, auth, account, member["caregiver_id"], "Care handoffs").status_code == 200
    db_session.get(Caregiver, other_member["caregiver_id"]).relationship = "Primary caregiver"
    db_session.commit()
    handoff = create(client, auth, account, recipient["caregiver_id"])
    assert transition(client, auth, handoff, "send").status_code == 200
    for attacker in [auth, other_auth, unrelated_auth]:
        assert transition(client, attacker, handoff, "acknowledge").status_code == 403
    assert client.get(f"/api/handoffs/{handoff['id']}", headers=unrelated_auth, params={"actor_caregiver_id": account["caregiver_id"]}).status_code == 403
    assert client.get("/api/handoffs", headers=unrelated_auth, params={"actor_caregiver_id": account["caregiver_id"], "patient_id": account["patient_id"]}).status_code == 403
    assert permission(client, other_auth, account, recipient["caregiver_id"], "Care handoffs", False).status_code == 403
    assert permission(client, auth, account, recipient["caregiver_id"], "Care handoffs", False).status_code == 200
    assert transition(client, recipient_auth, handoff, "acknowledge").status_code == 403
    assert permission(client, auth, account, recipient["caregiver_id"], "Care handoffs").status_code == 200
    assert transition(client, recipient_auth, handoff, "acknowledge").status_code == 200
    assert transition(client, recipient_auth, handoff, "complete").status_code == 200
    row = db_session.scalar(select(AuditLog).where(AuditLog.resource_id == handoff["id"], AuditLog.action == "handoff_acknowledged"))
    assert row.actor_subject == recipient["subject"] and not row.simulated
    second = create(client, auth, account, recipient["caregiver_id"])
    assert transition(client, auth, second, "send").status_code == 200
    assert client.delete(f"/api/caregivers/{recipient['caregiver_id']}", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]}).status_code == 200
    assert transition(client, recipient_auth, second, "acknowledge").status_code == 403
    assert client.get("/api/handoffs", headers=recipient_auth, params={"actor_caregiver_id": account["caregiver_id"]}).status_code == 403


def test_owner_without_any_self_permission_rows_can_coordinate(client, patient_workspace, monkeypatch, db_session):
    _, _, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"
    workspace = Patient(name="Independent owner", email=email, current_phase="Pregnancy")
    db_session.add(workspace)
    db_session.flush()
    principal = Caregiver(name="Independent owner", patient_id=workspace.id, relationship="Mother", is_patient=True)
    db_session.add(principal)
    db_session.flush()
    account = Account(subject=email, email=email, name=principal.name, role="patient", patient_id=workspace.id, caregiver_id=principal.id)
    db_session.add(account)
    db_session.commit()
    auth = headers(email)
    saved_account = client.get("/api/auth/me", headers=auth).json()
    recipient = simulated(client, auth, saved_account, monkeypatch)
    handoff = create(client, auth, saved_account, recipient["id"])
    for action in ["send", "acknowledge", "complete"]:
        assert transition(client, auth, handoff, action).status_code == 200
    assert db_session.scalar(select(Permission.id).where(Permission.caregiver_id == principal.id)) is None


@pytest.mark.parametrize("phase", ["Prepared", "Awaiting acknowledgement", "Acknowledged", "Completed"])
def test_remove_preserves_history_and_rejects_repeats(client, patient_workspace, monkeypatch, db_session, phase):
    auth, account, mother, caregiver, _ = patient_workspace
    other_auth, _ = mother("Unrelated owner")
    real_auth, real = caregiver(auth)
    assert permission(client, auth, account, real["caregiver_id"], "Care handoffs").status_code == 200
    recipient = simulated(client, auth, account, monkeypatch)
    handoff = create(client, auth, account, recipient["id"])
    for action in ["send", "acknowledge", "complete"][:["Prepared", "Awaiting acknowledgement", "Acknowledged", "Completed"].index(phase)]:
        assert transition(client, auth, handoff, action).status_code == 200
    path = f"/api/handoffs/{handoff['id']}/remove"
    payload = {"actor_caregiver_id": account["caregiver_id"], "expected_status": phase}
    assert client.post(path, headers=other_auth, json=payload).status_code == 403
    assert client.post(path, headers=real_auth, json=payload).status_code == 403
    wrong = "Prepared" if phase != "Prepared" else "Completed"
    assert client.post(path, headers=auth, json={**payload, "expected_status": wrong}).status_code == 409
    result = client.post(path, headers=auth, json=payload)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == ("Completed" if phase == "Completed" else "Cancelled")
    assert result.json()["archived_at" if phase == "Completed" else "cancelled_at"]
    assert client.post(path, headers=auth, json=payload).status_code == 409
    assert transition(client, auth, handoff, "send").status_code == 409
    fresh = client.get(f"/api/handoffs/{handoff['id']}", headers=auth, params={"actor_caregiver_id": account["caregiver_id"]})
    assert fresh.json() == result.json()
    assert db_session.get(CareHandoff, handoff["id"]) is not None
    assert db_session.scalar(select(AuditLog).where(AuditLog.resource_id == handoff["id"], AuditLog.action == ("handoff_archived" if phase == "Completed" else "handoff_cancelled")))
    params = {"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"]}
    assert client.get("/api/analytics/facts", headers=auth, params=params).json()["handoffs"] == []
    stats = client.get("/api/analytics", headers=auth, params={**params, "start": str(date.today()-timedelta(days=1)), "end": str(date.today()+timedelta(days=1))}).json()["handoffs"]
    assert stats["sent"] == 0 and stats["acknowledged"] == 0
    listing = client.get("/api/handoffs", headers=auth, params={**params, "include_archived": True}).json()
    assert any(item["id"] == handoff["id"] for item in listing)


def test_simulated_sharing_remains_controllable_and_cannot_sign_in(client, patient_workspace, monkeypatch, db_session):
    auth, account, _, _, headers = patient_workspace
    member = simulated(client, auth, account, monkeypatch)
    sharing = {row.permission_name: row.enabled for row in db_session.scalars(select(Permission).where(Permission.caregiver_id == member["id"])).all()}
    assert sharing["Coordination tasks"] and sharing["Care handoffs"]
    assert not sharing["Appointments"] and not sharing["Approved care updates"]
    assert permission(client, auth, account, member["id"], "Care handoffs", False).status_code == 200
    blocked = client.post("/api/handoffs", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "from_caregiver_id": account["caregiver_id"], "to_caregiver_id": member["id"], "title": "Blocked", "reason": "Sharing revoked"})
    assert blocked.status_code == 403
    email = f"{uuid4()}@example.test"
    db_session.add(Account(subject=email, email=email, name="Invalid simulated login", role="caregiver", caregiver_id=member["id"], patient_id=account["patient_id"]))
    db_session.commit()
    assert client.get("/api/handoffs", headers=headers(email), params={"actor_caregiver_id": member["id"]}).status_code == 403
    monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "false")
    assert client.post("/api/caregivers/demo", headers=auth, json={"patient_id": account["patient_id"], "actor_caregiver_id": account["caregiver_id"], "name": "Blocked", "relationship": "Friend", "role": "Support caregiver"}).status_code == 404


def test_timeline_filter_order_pagination_and_permission_revocation(client, patient_workspace, db_session):
    auth, account, mother, caregiver, _ = patient_workspace
    other_auth, _ = mother("Unrelated timeline")
    member_auth, member = caregiver(auth)
    assert permission(client, auth, account, member["caregiver_id"], "Approved care updates").status_code == 200
    start = datetime(2026, 11, 6)
    for index in range(18):
        db_session.add(TimelineEvent(patient_id=account["patient_id"], event_type="Task", source="Task", resource_type="Task", resource_id=index+1, title=f"Recorded action {index}", event_date=date(2026,11,6), created_at=start+timedelta(seconds=index)))
    db_session.commit()
    params = {"actor_caregiver_id": account["caregiver_id"], "category": "Tasks", "order": "oldest", "limit": 15}
    first = client.get("/api/timeline", headers=auth, params=params).json()
    later = client.get("/api/timeline", headers=auth, params={**params, "offset": 15}).json()
    assert [row["title"] for row in first+later] == [f"Recorded action {i}" for i in range(18)]
    newest = client.get("/api/timeline", headers=auth, params={**params, "order": "newest"}).json()
    assert newest[0]["title"] == "Recorded action 17"
    assert client.get("/api/timeline", headers=other_auth, params=params).json() == []
    assert client.get("/api/timeline", headers=member_auth, params=params).json() == []
    assert permission(client, auth, account, member["caregiver_id"], "Coordination tasks").status_code == 200
    assert len(client.get("/api/timeline", headers=member_auth, params=params).json()) == 15
    assert permission(client, auth, account, member["caregiver_id"], "Approved care updates", False).status_code == 200
    assert client.get("/api/timeline", headers=member_auth, params=params).status_code == 403


def test_timeline_cannot_reveal_another_recipients_handoffs(client, patient_workspace):
    auth, account, _, caregiver, _ = patient_workspace
    first_auth, first = caregiver(auth)
    second_auth, second = caregiver(auth)
    for member in [first,second]:
        for category in ["Approved care updates","Care handoffs"]:
            assert permission(client,auth,account,member["caregiver_id"],category).status_code == 200
    handoff = create(client,auth,account,first["caregiver_id"])
    assert transition(client,auth,handoff,"send").status_code == 200
    params={"actor_caregiver_id":account["caregiver_id"],"category":"Handoffs"}
    assert len(client.get("/api/timeline",headers=first_auth,params=params).json())==2
    assert client.get("/api/timeline",headers=second_auth,params=params).json()==[]
    assert client.get("/api/timeline",headers=second_auth,params={**params,"category":"Sharing changes"}).json()==[]


def configure_email(monkeypatch):
    for key, value in {"MAATRUCARE_INVITATION_EMAIL_ENABLED":"true", "RESEND_API_KEY":"isolated-placeholder", "MAATRUCARE_INVITATION_FROM":"Care Circle <invites@verified.example.test>", "MAATRUCARE_PUBLIC_APP_URL":"https://care.example.test"}.items():
        monkeypatch.setenv(key,value)


@pytest.mark.parametrize("provider_status,body,expected", [(202,{"id":"provider-accepted"},"accepted"),(401,{"message":"private provider error"},"failed"),(200,{},"failed"),(200,{"id":None},"failed")])
def test_email_provider_confirmation_and_secure_link_fallback(client, patient_workspace, monkeypatch, db_session, provider_status, body, expected):
    configure_email(monkeypatch)
    sent = []
    class Provider:
        def __init__(self, **kwargs):
            assert kwargs["follow_redirects"] is False and kwargs["timeout"] == 10
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def post(self,url,**kwargs):
            sent.append((url,kwargs))
            return httpx.Response(provider_status,json=body)
    monkeypatch.setattr(mail.httpx,"Client",Provider)
    auth, account, _, _, headers = patient_workspace
    assert client.get("/api/auth/invitation-delivery",headers=auth).json()["email_available"]
    email = f"{uuid4()}@example.test"
    result = client.post("/api/auth/invitations", headers=auth, json={"email":email,"name":"Fictional Invitee","relationship":"Friend","delivery":"email"})
    assert result.status_code == 201,result.text
    assert result.json()["email_status"] == expected
    assert bool(result.json()["email_accepted_at"]) == (expected=="accepted")
    assert "private provider error" not in result.text and "isolated-placeholder" not in result.text
    token = result.json()["token"]
    assert sent[0][0] == "https://api.resend.com/emails"
    payload = sent[0][1]["json"]
    assert payload["to"] == [email] and f"https://care.example.test/onboarding?role=caregiver&invitation={token}" in payload["text"]
    assert account["name"] not in payload["text"]
    row = db_session.scalar(select(CaregiverInvitation).where(CaregiverInvitation.email==email))
    assert row.token_hash != token and bool(row.provider_message_id) == (expected=="accepted")
    assert client.post(f"/api/auth/invitations/{token}/accept",headers=headers("wrong@example.test")).status_code==403
    assert client.post(f"/api/auth/invitations/{token}/accept",headers=headers(email)).status_code==200
    assert client.post(f"/api/auth/invitations/{token}/accept",headers=headers(email)).status_code in {404,409}


def test_email_unconfigured_and_timeout_keep_pending_link(client, patient_workspace, monkeypatch):
    auth, _, _, _, _ = patient_workspace
    monkeypatch.setenv("MAATRUCARE_INVITATION_EMAIL_ENABLED","false")
    assert not client.get("/api/auth/invitation-delivery",headers=auth).json()["email_available"]
    first = client.post("/api/auth/invitations",headers=auth,json={"email":f"{uuid4()}@example.test","delivery":"email"})
    assert first.status_code==201 and first.json()["email_status"]=="unavailable" and first.json()["token"]
    configure_email(monkeypatch)
    class TimeoutProvider:
        def __init__(self,**kwargs):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def post(self,*args,**kwargs):raise httpx.ReadTimeout("provider unavailable")
    monkeypatch.setattr(mail.httpx,"Client",TimeoutProvider)
    second=client.post("/api/auth/invitations",headers=auth,json={"email":f"{uuid4()}@example.test","delivery":"email"})
    assert second.status_code==201 and second.json()["email_status"]=="unavailable" and second.json()["token"]
    assert len(client.get("/api/auth/invitations",headers=auth).json())==2


@pytest.mark.parametrize("key,value",[("MAATRUCARE_INVITATION_FROM","Personal <unverified@gmail.com>"),("MAATRUCARE_PUBLIC_APP_URL","http://public.example.test"),("MAATRUCARE_PUBLIC_APP_URL","https://user:password@example.test"),("MAATRUCARE_PUBLIC_APP_URL","https://example.test/?token=bad")])
def test_email_rejects_unsafe_sender_or_public_origin(monkeypatch,key,value):
    configure_email(monkeypatch)
    monkeypatch.setenv(key,value)
    assert mail.email_settings() is None


def test_core_additive_migration_preserves_existing_history_and_invitations():
    from app.migrations import migrate_schema
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        for statement in [
            "CREATE TABLE accounts (id INTEGER PRIMARY KEY, role TEXT, caregiver_id INTEGER)",
            "CREATE TABLE caregivers (id INTEGER PRIMARY KEY, name TEXT)",
            "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)",
            "CREATE TABLE care_handoffs (id INTEGER PRIMARY KEY, title TEXT)",
            "CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, action TEXT)",
            "CREATE TABLE caregiver_invitations (id INTEGER PRIMARY KEY, token_hash TEXT)",
            "INSERT INTO audit_logs (id,action) VALUES (1,'handoff_acknowledged_simulated')",
            "INSERT INTO caregiver_invitations (id,token_hash) VALUES (1,'preserved-token-hash')",
            "INSERT INTO care_handoffs (id,title) VALUES (1,'Preserved responsibility')",
        ]:
            connection.execute(text(statement))
    migrate_schema(engine)
    migrate_schema(engine)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT title,archived_at,cancelled_at FROM care_handoffs WHERE id=1")).one() == ("Preserved responsibility",None,None)
        assert connection.execute(text("SELECT token_hash,email_status FROM caregiver_invitations WHERE id=1")).one() == ("preserved-token-hash","not_requested")
        assert connection.execute(text("SELECT action,simulated,actor_account_id FROM audit_logs WHERE id=1")).one() == ("handoff_acknowledged_simulated",1,None)
    engine.dispose()

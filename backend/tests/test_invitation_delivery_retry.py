import logging
import httpx
from sqlalchemy import select,func
from app.models import AuditLog,CaregiverInvitation
from app.routers import auth as router
from app.services import invitation_email_service as delivery
from app.services.safe_access_logging import InvitationPathFilter
from test_functional_repairs import patient_workspace


def invitation(client,auth):
    result=client.post("/api/auth/invitations",headers=auth,json={"email":"controlled-fictional@example.test","name":"Fictional Recipient","delivery":"link"})
    assert result.status_code==201
    return result.json()


def test_retry_preserves_token_recipient_and_provider_idempotency(client,patient_workspace,monkeypatch,db_session):
    auth,account,_,_,_=patient_workspace;inv=invitation(client,auth)
    before=db_session.get(CaregiverInvitation,inv["id"]).token_hash;calls=[]
    monkeypatch.setattr(delivery,"email_settings",lambda:("fake-provider-key","Care Circle <invite@fictional.example>","https://fictional.example"))
    class FakeClient:
        def __init__(self,**kwargs):pass
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def post(self,url,headers,json):
            calls.append((headers["Idempotency-Key"],json["to"]))
            if len(calls)==1:raise httpx.ReadTimeout("Synthetic timeout")
            return httpx.Response(202,json={"id":"fictional-provider-message"})
    monkeypatch.setattr(delivery.httpx,"Client",FakeClient)
    path=f'/api/auth/invitations/{inv["id"]}/retry-email';body={"token":inv["token"]}
    first=client.post(path,headers=auth,json=body);assert first.status_code==200 and first.json()["email_status"]=="unavailable"
    second=client.post(path,headers=auth,json=body);assert second.status_code==200 and second.json()["email_status"]=="accepted"
    assert client.post(path,headers=auth,json=body).json()["email_status"]=="accepted"
    assert len(calls)==2 and calls[0]==calls[1] and calls[0][1]==[inv["email"]]
    db_session.expire_all();record=db_session.get(CaregiverInvitation,inv["id"])
    assert record.token_hash==before and record.accepted_at is None


def test_retry_is_controller_scoped_and_cannot_send_revoked_or_wrong_tokens(client,patient_workspace,monkeypatch):
    auth,account,other,_,_=patient_workspace;inv=invitation(client,auth);foreign,_=other("Fictional other owner")
    calls=[];monkeypatch.setattr(router,"delivery_capability",lambda:{"email_available":True});monkeypatch.setattr(router,"send_invitation_email",lambda *args:calls.append(True) or "fictional-id")
    path=f'/api/auth/invitations/{inv["id"]}/retry-email'
    assert client.post(path,headers=foreign,json={"token":inv["token"]}).status_code==404
    assert client.post(path,headers=auth,json={"token":"incorrect-token-value"}).status_code==404
    assert client.post(f'/api/auth/invitations/{inv["id"]}/withdraw',headers=auth).status_code==200
    assert client.post(path,headers=auth,json={"token":inv["token"]}).status_code==409
    assert calls==[]


def test_failed_retries_have_a_persistent_limit_without_fake_delivery(client,patient_workspace,monkeypatch,db_session):
    auth,account,_,_,_=patient_workspace;inv=invitation(client,auth);calls=[]
    monkeypatch.setattr(router,"delivery_capability",lambda:{"email_available":True})
    def unavailable(*args):calls.append(True);raise delivery.InvitationEmailError("unavailable")
    monkeypatch.setattr(router,"send_invitation_email",unavailable)
    path=f'/api/auth/invitations/{inv["id"]}/retry-email'
    for _ in range(10):
        response=client.post(path,headers=auth,json={"token":inv["token"]});assert response.status_code==200 and response.json()["email_status"]=="unavailable"
    assert client.post(path,headers=auth,json={"token":inv["token"]}).status_code==429
    assert len(calls)==10
    assert db_session.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.actor_account_id==account["id"],AuditLog.action=="invitation_email_retry"))==10


def test_access_logs_redact_invitation_capabilities():
    for operation in ("accept","decline","preview"):
        token="fictional-secret-invitation-capability"
        record=logging.LogRecord("uvicorn.access",logging.INFO,"",0,'%s - "%s %s HTTP/%s" %d',("127.0.0.1","POST",f"/api/auth/invitations/{token}/{operation}?source=test","1.1",200),None)
        assert InvitationPathFilter().filter(record)
        assert token not in record.getMessage() and "[redacted]" in record.getMessage()

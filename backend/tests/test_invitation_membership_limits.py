"""Diagnose the current single-Circle contract; do not claim multi-membership works.

All accounts/records are synthetic and use conftest's disposable database. These
tests protect existing access while the separate membership architecture is reviewed.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select

from app.models import Account, Caregiver, CaregiverInvitation, Permission
from app.services.auth_service import hash_invitation
from test_functional_repairs import patient_workspace, permission


def invite(client, owner_auth, email):
    response = client.post("/api/auth/invitations", headers=owner_auth, json={"email": email, "name": "Fictional Recipient", "relationship": "Friend"})
    assert response.status_code == 201, response.text
    return response.json()["token"]


def pending(client, owner_auth, token, db):
    invitation = db.scalar(select(CaregiverInvitation).where(CaregiverInvitation.token_hash == hash_invitation(token)))
    db.refresh(invitation)
    records = client.get("/api/auth/invitations", headers=owner_auth).json()
    return next(item for item in records if item["id"] == invitation.id)


def test_existing_caregiver_cannot_join_second_circle_and_keeps_original_access(client, patient_workspace, db_session):
    owner_a, circle_a, mother, caregiver, _ = patient_workspace
    owner_b, circle_b = mother("Fictional Circle B")
    recipient_auth, recipient = caregiver(owner_a)
    permission(client, owner_a, circle_a, recipient["caregiver_id"], "Coordination tasks")
    token = invite(client, owner_b, recipient["email"])
    before_members = db_session.scalar(select(func.count()).select_from(Caregiver).where(Caregiver.patient_id == circle_b["patient_id"]))
    result = client.post(f"/api/auth/invitations/{token}/accept", headers=recipient_auth)
    assert result.status_code == 409 and result.json()["detail"] == "Account is already linked"
    assert pending(client, owner_b, token, db_session)["status"] == "Pending"
    assert db_session.scalar(select(func.count()).select_from(Caregiver).where(Caregiver.patient_id == circle_b["patient_id"])) == before_members
    restored = client.get("/api/auth/me", headers=recipient_auth).json()
    assert restored["subject"] == recipient["subject"] and restored["patient_id"] == circle_a["patient_id"]
    assert restored["caregiver_id"] == recipient["caregiver_id"]
    assert client.get("/api/tasks", headers=recipient_auth, params={"actor_caregiver_id": recipient["caregiver_id"]}).status_code == 200
    assert client.get("/api/analytics/facts", headers=recipient_auth, params={"patient_id": circle_b["patient_id"], "actor_caregiver_id": circle_b["caregiver_id"]}).status_code == 403
    # Current onboarding returns the existing binding without consuming the link.
    bootstrap = client.post("/api/auth/bootstrap", headers=recipient_auth, json={"role": "caregiver", "name": "Fictional Recipient", "invitation_token": token})
    assert bootstrap.status_code == 201 and bootstrap.json()["patient_id"] == circle_a["patient_id"]
    assert pending(client, owner_b, token, db_session)["status"] == "Pending"
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.subject == recipient["subject"])) == 1


def test_existing_owner_is_not_rebound_or_downgraded_by_another_circle_invitation(client, patient_workspace, db_session):
    owner_a, circle_a, mother, _, _ = patient_workspace
    owner_b, _ = mother("Fictional Other Circle")
    token = invite(client, owner_b, circle_a["email"])
    assert client.post(f"/api/auth/invitations/{token}/accept", headers=owner_a).status_code == 409
    current = client.get("/api/auth/me", headers=owner_a).json()
    assert current["role"] == "patient" and current["patient_id"] == circle_a["patient_id"]
    assert current["caregiver_id"] == circle_a["caregiver_id"]
    assert pending(client, owner_b, token, db_session)["status"] == "Pending"


def test_new_recipient_accepts_without_inheriting_other_caregiver_permissions(client, patient_workspace, db_session):
    auth, owner, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"
    token = invite(client, auth, email.upper())
    recipient_auth = headers(email)
    result = client.post(f"/api/auth/invitations/{token}/accept", headers=recipient_auth)
    assert result.status_code == 200, result.text
    member = result.json()
    assert member["patient_id"] == owner["patient_id"] and member["role"] == "caregiver"
    assert pending(client, auth, token, db_session)["status"] == "Accepted"
    grants = db_session.scalars(select(Permission).where(Permission.caregiver_id == member["caregiver_id"])).all()
    assert len(grants) == 5 and all(not item.enabled for item in grants)
    assert client.get("/api/tasks", headers=recipient_auth, params={"actor_caregiver_id": member["caregiver_id"]}).status_code == 403
    assert client.get("/api/auth/me", headers=recipient_auth).json()["caregiver_id"] == member["caregiver_id"]
    assert client.post("/api/auth/invitations", headers=auth, json={"email": email}).status_code == 409
    # Reuse is rejected rather than acknowledged idempotently in the current API.
    assert client.post(f"/api/auth/invitations/{token}/accept", headers=recipient_auth).status_code == 404
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.subject == member["subject"])) == 1


def test_invalid_expired_withdrawn_and_wrong_recipient_tokens_do_not_grant_access(client, patient_workspace, db_session):
    auth, owner, _, _, headers = patient_workspace
    for scenario in ["invalid", "expired", "withdrawn", "wrong_email"]:
        email = f"{uuid4()}@example.test"
        token = invite(client, auth, email)
        row = db_session.scalar(select(CaregiverInvitation).where(CaregiverInvitation.token_hash == hash_invitation(token)))
        if scenario == "expired": row.created_at = datetime.utcnow() - timedelta(days=8); db_session.commit()
        if scenario == "withdrawn": assert client.post(f"/api/auth/invitations/{row.id}/withdraw", headers=auth).status_code == 200
        recipient = headers(f"{uuid4()}@example.test" if scenario == "wrong_email" else email)
        result = client.post(f"/api/auth/invitations/{'invalid-token' if scenario == 'invalid' else token}/accept", headers=recipient)
        assert result.status_code == {"invalid": 404, "expired": 410, "withdrawn": 404, "wrong_email": 403}[scenario]
        db_session.refresh(row)
        assert row.accepted_at is None
        assert db_session.scalar(select(func.count()).select_from(Caregiver).where(Caregiver.patient_id == owner["patient_id"], Caregiver.email == email)) == 0


def test_concurrent_new_recipient_acceptance_creates_exactly_one_account_and_relationship(client, patient_workspace, db_session):
    auth, owner, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"; token = invite(client, auth, email); recipient = headers(email)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(f"/api/auth/invitations/{token}/accept", headers=recipient), range(2)))
    assert sum(response.status_code == 200 for response in responses) == 1
    assert all(response.status_code in {200, 404, 409} for response in responses)
    assert db_session.scalar(select(func.count()).select_from(Account).where(Account.email == email)) == 1
    assert db_session.scalar(select(func.count()).select_from(Caregiver).where(Caregiver.patient_id == owner["patient_id"], Caregiver.email == email)) == 1
    assert pending(client, auth, token, db_session)["status"] == "Accepted"

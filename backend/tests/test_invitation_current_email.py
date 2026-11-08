"""A stored profile address must never override the current signed identity."""
import time
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import select

from app.models import Account, CaregiverInvitation
from test_functional_repairs import patient_workspace


@pytest.mark.parametrize("claims", [
    {"email": "different@example.test"},
    {},
    {"email": "invited@example.test", "email_verified": False},
    {"email": "invited@example.test", "user_metadata": {"email_verified": False}},
])
def test_current_signed_email_controls_invitation_redemption(client, patient_workspace, db_session, claims):
    owner, _, _, _, _ = patient_workspace
    created = client.post("/api/auth/invitations", headers=owner, json={"email": "invited@example.test"}).json()
    subject = str(uuid4())
    # An existing account can have a stale profile address; it is not proof of
    # ownership of that mailbox, even if it matches the invitation.
    db_session.add(Account(subject=subject, role="caregiver", name="Fictional stale profile", email="invited@example.test"))
    db_session.commit()
    token = jwt.encode({"sub": subject, "aud": "authenticated", "exp": time.time() + 3600, **claims}, "test-secret", algorithm="HS256")
    response = client.post(f"/api/auth/invitations/{created['token']}/accept", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    db_session.expire_all()
    assert db_session.scalar(select(CaregiverInvitation).where(CaregiverInvitation.id == created["id"])).accepted_at is None


def test_matching_signed_email_still_accepts_new_account(client, patient_workspace):
    owner, _, _, _, headers = patient_workspace
    email = f"{uuid4()}@example.test"
    created = client.post("/api/auth/invitations", headers=owner, json={"email": email}).json()
    assert client.post(f"/api/auth/invitations/{created['token']}/accept", headers=headers(email)).status_code == 200

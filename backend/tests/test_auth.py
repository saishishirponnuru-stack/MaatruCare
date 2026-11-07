import base64
import hashlib
import hmac
import json
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.services import auth_service


def _token(subject: str, email: str = "auth@example.test") -> str:
	header = {"alg": "HS256", "typ": "JWT"}
	payload = {"sub": subject, "aud": "authenticated", "email": email, "exp": time.time() + 3600}
	encode = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")
	encoded_header, encoded_payload = encode(header), encode(payload)
	signature = hmac.new(b"test-secret", f"{encoded_header}.{encoded_payload}".encode(), hashlib.sha256).digest()
	return f"{encoded_header}.{encoded_payload}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"


def test_es256_jwks_token_is_verified(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
	monkeypatch.setenv("SUPABASE_JWKS_URL", "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/.well-known/jwks.json")
	monkeypatch.setenv("SUPABASE_ISSUER", "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1")
	monkeypatch.setenv("SUPABASE_AUDIENCE", "authenticated")
	private_key = ec.generate_private_key(ec.SECP256R1())
	kid = "04cab3db-a36c-4be2-bf22-b2bf10ad7207"
	public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key())
	public_jwk = json.loads(public_jwk)
	public_jwk.update({"kid": kid, "alg": "ES256", "use": "sig"})
	token = jwt.encode(
		{
			"sub": "es256-subject",
			"aud": "authenticated",
			"iss": "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1",
			"exp": time.time() + 300,
		},
		private_key,
		algorithm="ES256",
		headers={"kid": kid},
	)
	with patch.object(auth_service, "_jwks_cache", {"url": "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/.well-known/jwks.json", "keys": [public_jwk]}):
		claims = auth_service.verify_supabase_jwt(token)
	assert claims["sub"] == "es256-subject"


def test_es256_token_with_small_clock_skew_is_verified(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
	monkeypatch.setenv("SUPABASE_JWKS_URL", "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/.well-known/jwks.json")
	monkeypatch.setenv("SUPABASE_ISSUER", "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1")
	monkeypatch.setenv("SUPABASE_AUDIENCE", "authenticated")
	private_key = ec.generate_private_key(ec.SECP256R1())
	kid = "04cab3db-a36c-4be2-bf22-b2bf10ad7207"
	public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
	public_jwk.update({"kid": kid, "alg": "ES256", "use": "sig"})
	token = jwt.encode(
		{
			"sub": "clock-skew-subject",
			"aud": "authenticated",
			"iss": "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1",
			"iat": time.time() + 2,
			"exp": time.time() + 300,
		},
		private_key,
		algorithm="ES256",
		headers={"kid": kid},
	)
	with patch.object(auth_service, "_jwks_cache", {"url": "https://qvbwpcnjshkrwvdcecmc.supabase.co/auth/v1/.well-known/jwks.json", "keys": [public_jwk]}):
		claims = auth_service.verify_supabase_jwt(token)
	assert claims["sub"] == "clock-skew-subject"


def test_unauthenticated_requests_are_rejected(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	response = client.get("/api/patients?actor_caregiver_id=1")
	assert response.status_code == 401


def test_bootstrap_creates_stable_account_mapping(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	headers = {"Authorization": f"Bearer {_token('bootstrap-patient', 'new@example.test')}"}
	response = client.post("/api/auth/bootstrap", headers=headers, json={"role": "patient", "name": "New Patient"})
	assert response.status_code == 201
	body = response.json()
	assert body["role"] == "patient"
	assert body["patient_id"] is not None
	assert client.get("/api/auth/me", headers=headers).json()["subject"] == "bootstrap-patient"


def test_unlinked_authenticated_user_is_sent_to_onboarding(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	headers = {"Authorization": f"Bearer {_token('unlinked-user', 'new@example.test')}"}
	response = client.get("/api/auth/me", headers=headers)
	assert response.status_code == 404


def test_authenticated_account_cannot_cross_patient_boundary(client: TestClient, db_session, monkeypatch) -> None:
	from app.models import Account, Patient

	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	other = Patient(name="Other boundary fixture", current_phase="Pregnancy")
	db_session.add(other)
	db_session.flush()
	db_session.add(Account(subject="cross-patient", role="caregiver", name="Rahul Rao", caregiver_id=1, patient_id=other.id))
	db_session.commit()
	response = client.get(
		"/api/tasks?actor_caregiver_id=1",
		headers={"Authorization": f"Bearer {_token('cross-patient')}"},
	)
	assert response.status_code == 403


def test_authenticated_actor_cannot_impersonate_handoff_recipient(client: TestClient, db_session, monkeypatch) -> None:
	from app.models import Account

	permission = client.put("/api/permissions", json={"patient_id": 1, "caregiver_id": 2, "permission_name": "Care handoffs", "enabled": True, "actor_caregiver_id": 1})
	assert permission.status_code in {200, 409}
	created = client.post("/api/handoffs", json={"patient_id": 1, "title": "Identity test", "from_caregiver_id": 1, "to_caregiver_id": 2, "reason": "Fictional handoff", "actor_caregiver_id": 1})
	assert created.status_code == 201
	handoff_id = created.json()["id"]
	assert client.post(f"/api/handoffs/{handoff_id}/send", json={"actor_caregiver_id": 1}).status_code == 200

	db_session.add(Account(subject="bound-handoff-sender", role="caregiver", name="Authenticated Sender", patient_id=1, caregiver_id=1))
	db_session.commit()
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	response = client.post(
		f"/api/handoffs/{handoff_id}/acknowledge",
		headers={"Authorization": f"Bearer {_token('bound-handoff-sender')}"},
		json={"actor_caregiver_id": 2},
	)
	assert response.status_code == 403
	assert response.json()["detail"] == "Only the intended recipient can acknowledge this handoff"


def test_controller_can_create_and_caregiver_can_accept_invitation(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	patient_headers = {"Authorization": f"Bearer {_token('invite-controller', 'rahul.rao@example.test')}"}
	bootstrap = client.post("/api/auth/bootstrap", headers=patient_headers, json={"role": "patient", "name": "Rahul Rao"})
	assert bootstrap.status_code == 201
	invitation = client.post("/api/auth/invitations", headers=patient_headers, json={"email": "join@example.test", "name": "Joining caregiver", "relationship": "Support caregiver"})
	assert invitation.status_code == 201
	caregiver_headers = {"Authorization": f"Bearer {_token('invite-caregiver', 'join@example.test')}"}
	accepted = client.post(f"/api/auth/invitations/{invitation.json()['token']}/accept", headers=caregiver_headers)
	assert accepted.status_code == 200
	assert accepted.json()["role"] == "caregiver"
	assert accepted.json()["caregiver"]["relationship"] == "Support caregiver"


def test_pending_invitation_is_listed_without_active_access(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	headers = {"Authorization": f"Bearer {_token('pending-controller', 'pending@example.test')}"}
	assert client.post("/api/auth/bootstrap", headers=headers, json={"role": "patient", "name": "Pending Patient"}).status_code == 201
	created = client.post("/api/auth/invitations", headers=headers, json={"email": "pending-caregiver@example.test", "name": "Pending Caregiver", "relationship": "Family caregiver"})
	assert created.status_code == 201
	listed = client.get("/api/auth/invitations", headers=headers)
	assert listed.status_code == 200
	assert listed.json()[0]["status"] == "Pending"
	assert listed.json()[0]["name"] == "Pending Caregiver"
	assert listed.json()[0]["relationship"] == "Family caregiver"


def test_profile_name_updates_account_and_patient(client: TestClient, monkeypatch) -> None:
	monkeypatch.delenv("MAATRUCARE_TEST_AUTH_COMPAT", raising=False)
	monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
	headers = {"Authorization": f"Bearer {_token('profile-user', 'profile@example.test')}"}
	assert client.post("/api/auth/bootstrap", headers=headers, json={"role": "patient", "name": "Initial Name"}).status_code == 201
	updated = client.put("/api/auth/profile", headers=headers, json={"name": "Updated Name"})
	assert updated.status_code == 200
	assert updated.json()["name"] == "Updated Name"
	assert updated.json()["patient"]["name"] == "Updated Name"
	assert client.get("/api/auth/me", headers=headers).json()["name"] == "Updated Name"


def test_demo_caregiver_requires_flag_and_is_scoped(client: TestClient, monkeypatch) -> None:
	monkeypatch.setenv("MAATRUCARE_TEST_AUTH_COMPAT", "true")
	monkeypatch.delenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", raising=False)
	disabled = client.post(
		"/api/caregivers/demo",
		json={
			"patient_id": 1,
			"name": "Demo Partner",
			"relationship": "Partner",
			"role": "Primary caregiver",
			"actor_caregiver_id": 1,
		},
	)
	assert disabled.status_code == 404

	monkeypatch.setenv("MAATRUCARE_DEMO_CAREGIVERS_ENABLED", "true")
	created = client.post(
		"/api/caregivers/demo",
		json={
			"patient_id": 1,
			"name": "Demo Partner",
			"relationship": "Partner",
			"role": "Primary caregiver",
			"email": "demo.partner@example.test",
			"actor_caregiver_id": 1,
		},
	)
	assert created.status_code == 201
	assert created.json()["is_demo"] is True
	assert created.json()["relationship"] == "Partner"
	assert created.json()["role"] == "Primary caregiver"
	duplicate = client.post(
		"/api/caregivers/demo",
		json={
			"patient_id": 1,
			"name": "Demo Partner",
			"relationship": "Partner",
			"role": "Primary caregiver",
			"actor_caregiver_id": 1,
		},
	)
	assert duplicate.status_code == 409
	assert client.post(
		"/api/caregivers/demo",
		json={
			"patient_id": 1,
			"name": "Wrong patient",
			"relationship": "Mother",
			"role": "Family caregiver",
			"actor_caregiver_id": 2,
		},
	).status_code == 403

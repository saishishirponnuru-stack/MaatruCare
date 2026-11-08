"""Synchronous JWT/key discovery must not stall ASGI; identity stays per request."""
import asyncio

import httpx

from test_functional_repairs import patient_workspace
from app import dependencies
from app.main import app


def test_auth_verification_runs_off_event_loop_without_losing_identity(client, patient_workspace, monkeypatch):
    auth, owner, *_ = patient_workspace
    original = dependencies.verify_supabase_jwt
    ran_on_loop = []
    def observe(token):
        try:
            asyncio.get_running_loop()
            ran_on_loop.append(True)
        except RuntimeError:
            ran_on_loop.append(False)
        return original(token)
    monkeypatch.setattr(dependencies, "verify_supabase_jwt", observe)
    response = client.get("/api/auth/me", headers=auth)
    assert response.status_code == 200
    assert response.json()["subject"] == owner["subject"]
    assert ran_on_loop == [False]


def test_concurrent_auth_requests_never_share_account_context(client, patient_workspace):
    first_auth, first, create_owner, *_ = patient_workspace
    second_auth, second = create_owner("Separate Fictional Owner")
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
            callers = [(first_auth, first), (second_auth, second)] * 6
            responses = await asyncio.gather(*(api.get("/api/auth/me", headers=auth) for auth, _ in callers))
            for response, (_, account) in zip(responses, callers):
                assert response.status_code == 200
                assert response.json()["subject"] == account["subject"]
                assert response.json()["patient_id"] == account["patient_id"]
            assert (await api.get("/api/auth/me")).status_code == 401
            assert (await api.get("/api/health")).status_code == 200
    asyncio.run(check())

import os
import secrets
import threading
from time import monotonic
import urllib.request
import json
import hashlib
from contextvars import ContextVar
from typing import Any

from fastapi import HTTPException, Request, status
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account

_current_account: ContextVar[Account | None] = ContextVar("current_account", default=None)


def test_auth_compat_enabled() -> bool:
	return os.getenv("MAATRUCARE_TEST_AUTH_COMPAT", "").lower() == "true" and os.getenv("MAATRUCARE_ENV", "local").lower() != "production" and os.getenv("RENDER", "").lower() != "true"


_jwks_cache: dict[str, Any] | None = None
_jwks_lock = threading.Lock()


def _load_jwks(jwks_url: str, force: bool = False, expected=None) -> dict[str, Any]:
	global _jwks_cache
	with _jwks_lock:
		expired = _jwks_cache is None or monotonic() - _jwks_cache.get("loaded_at", float("-inf")) >= 300
		if expired or _jwks_cache.get("url") != jwks_url or (force and (expected is None or _jwks_cache is expected)):
			try:
				with urllib.request.urlopen(jwks_url, timeout=5) as response:
					_jwks_cache = {"url": jwks_url, "keys": json.load(response)["keys"], "loaded_at": monotonic()}
			except Exception as exc:
				raise HTTPException(status_code=503, detail="JWT key discovery is unavailable") from exc
		return _jwks_cache


def _jwks_key(token: str) -> tuple[Any, list[str]]:
	jwks_url = os.getenv("SUPABASE_JWKS_URL")
	if not jwks_url:
		raise HTTPException(status_code=503, detail="JWT verification is not configured")
	header = jwt.get_unverified_header(token)
	kid = header.get("kid")
	if not kid:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")
	jwks = _load_jwks(jwks_url)
	key = next((item for item in jwks["keys"] if item.get("kid") == kid), None)
	if key is None:
		jwks = _load_jwks(jwks_url, force=True, expected=jwks)
		key = next((item for item in jwks["keys"] if item.get("kid") == kid), None)
	if key is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")
	algorithm = header.get("alg")
	if algorithm == "RS256" and key.get("kty") == "RSA":
		return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key)), ["RS256"]
	if algorithm == "ES256" and key.get("kty") == "EC":
		return jwt.algorithms.ECAlgorithm.from_jwk(json.dumps(key)), ["ES256"]
	raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported bearer token algorithm")


def verify_supabase_jwt(token: str) -> dict[str, Any]:
	secret = os.getenv("SUPABASE_JWT_SECRET")
	expected_audience = os.getenv("SUPABASE_AUDIENCE", "authenticated")
	expected_issuer = os.getenv("SUPABASE_ISSUER")
	try:
		if secret:
			key, algorithms = secret, ["HS256"]
		else:
			key, algorithms = _jwks_key(token)
		options = {"require": ["exp", "sub", "aud"]}
		decode_options: dict[str, Any] = {
			"key": key,
			"algorithms": algorithms,
			"audience": expected_audience,
			"options": options,
			"leeway": 5,
		}
		if expected_issuer:
			decode_options["issuer"] = expected_issuer
		return jwt.decode(
			token,
			**decode_options,
		)
	except (jwt.InvalidTokenError, ValueError, KeyError, TypeError) as exc:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from exc


def account_for_claims(db: Session, claims: dict[str, Any]) -> Account:
	account = db.scalar(select(Account).where(Account.subject == str(claims["sub"])))
	if account is None:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not linked to MaatruCare")
	return account


def set_current_account(account: Account | None) -> None:
	_current_account.set(account)


def get_current_account() -> Account | None:
	return _current_account.get()


def verified_account_email(account) -> str | None:
	if getattr(account, "_email_unverified", False):
		return None
	return getattr(account, "_verified_email", account.email)


def require_current_account(request: Request) -> Account:
	account = get_current_account()
	if account is None:
		if test_auth_compat_enabled():
			return Account(id=0, subject="test-compat", role="caregiver", name="Test caregiver", caregiver_id=1)
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
	return account


def require_actor_account(db: Session, caregiver_id: int) -> Account | None:
	account = get_current_account()
	if account is None and test_auth_compat_enabled():
		return None
	if account is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
	if account.caregiver_id is not None:
		# Legacy actor IDs are intentionally ignored once a JWT is linked to a
		# caregiver; the route must use this account's relationship below.
		return account
	raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not linked to a caregiver")


def effective_caregiver_id(account: Account | None, requested_id: int) -> int:
	return account.caregiver_id if account and account.caregiver_id is not None else requested_id


def hash_invitation(token: str) -> str:
	return hashlib.sha256(token.encode()).hexdigest()


def new_invitation_token() -> str:
	return secrets.token_urlsafe(32)

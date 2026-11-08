from fastapi import HTTPException, Request, status
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from .database import SessionLocal
from .models import Account
from .services.auth_service import set_current_account, verify_supabase_jwt, test_auth_compat_enabled


async def authenticate_request(request: Request) -> None:
	if request.url.path == "/api/health" or not request.url.path.startswith("/api/"):
		return
	if test_auth_compat_enabled():
		return
	header = request.headers.get("authorization", "")
	if not header.lower().startswith("bearer "):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
	# JWKS discovery and SQLAlchemy are synchronous. Keep them off the ASGI
	# loop, then bind the result here: worker ContextVar changes do not flow back.
	account = await run_in_threadpool(_authenticated_account, header[7:].strip())
	set_current_account(account)


def _authenticated_account(token: str) -> Account:
	claims = verify_supabase_jwt(token)
	with SessionLocal() as db:
		account = db.scalar(select(Account).where(Account.subject == str(claims["sub"])))
		if account is None:
			metadata = claims.get("user_metadata") or {}
			account = Account(
				id=0,
				subject=str(claims["sub"]),
				role="unlinked",
				name=str(metadata.get("name") or claims.get("email") or "MaatruCare user"),
				email=claims.get("email"),
			)
		return account

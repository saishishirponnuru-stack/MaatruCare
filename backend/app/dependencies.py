import os

from fastapi import HTTPException, Request, status
from sqlalchemy import select

from .database import get_db
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
	claims = verify_supabase_jwt(header[7:].strip())
	db = next(get_db())
	try:
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
		set_current_account(account)
	finally:
		db.close()

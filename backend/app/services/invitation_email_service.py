"""Optional transactional invitations. No clinical or workspace records are emailed."""
import os
from email.utils import parseaddr
from urllib.parse import urlencode, urlparse

import httpx


class InvitationEmailError(Exception):
    pass


def email_settings():
    enabled = os.getenv("MAATRUCARE_INVITATION_EMAIL_ENABLED", "false").lower() == "true"
    key = os.getenv("RESEND_API_KEY", "")
    sender = os.getenv("MAATRUCARE_INVITATION_FROM", "")
    address = parseaddr(sender)[1]
    domain = address.rsplit("@", 1)[-1].lower() if "@" in address else ""
    public_mail = {"gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "proton.me"}
    origin = os.getenv("MAATRUCARE_PUBLIC_APP_URL", "").rstrip("/")
    parsed = urlparse(origin)
    local = parsed.hostname in {"localhost", "127.0.0.1"} and os.getenv("MAATRUCARE_ENV", "local").lower() in {"local", "test", "demo"} and os.getenv("RENDER", "").lower() != "true"
    valid_url = bool(parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment and (parsed.scheme == "https" or parsed.scheme == "http" and local))
    return (key, sender, origin) if enabled and key and domain and domain not in public_mail and "\n" not in sender and "\r" not in sender and valid_url else None


def delivery_capability():
    available = email_settings() is not None
    return {"email_available": available, "explanation": "Invitation emails are available." if available else "Email delivery is unavailable here. Create and securely share an invitation link instead."}


def send_invitation_email(invitation, token):
    settings = email_settings()
    if settings is None:
        raise InvitationEmailError("unavailable")
    key, sender, origin = settings
    link = f"{origin}/onboarding?{urlencode({'role': 'caregiver', 'invitation': token})}"
    text = ("You have been invited to join a MaatruCare Care Circle.\n\n"
            f"Sign in using this email address and accept your invitation:\n{link}\n\n"
            "This link expires seven days after it was created and stops working if withdrawn. "
            "The Care Circle owner chooses what to share after you join. "
            "If you were not expecting this invitation, you can ignore it.")
    try:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}", "Idempotency-Key": f"maatrucare-invitation-{invitation.id}"}, json={"from": sender, "to": [invitation.email], "subject": "Your invitation to a MaatruCare Care Circle", "text": text})
            if response.status_code not in {200, 201, 202}:
                raise InvitationEmailError("rejected")
            message_id = response.json().get("id")
            if not isinstance(message_id, str) or not message_id.strip() or len(message_id) > 255:
                raise InvitationEmailError("unconfirmed")
            return message_id
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        # Never return provider responses, tokens, addresses or credentials in errors.
        raise InvitationEmailError("unavailable") from None

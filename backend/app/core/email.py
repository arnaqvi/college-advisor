"""Password-reset email delivery.

No SMTP credentials are configured yet (see app/core/config.py's
smtp_host/etc. docstring) — until Ahsan sets them via `/set-app-env`, this
logs the reset link at INFO level instead of emailing it, same
not-configured-fallback pattern used elsewhere in this app (Google OAuth,
Stripe, Azure Blob, College Scorecard).
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Nothing in this app calls logging.basicConfig() — uvicorn only wires up
    # handlers for its own uvicorn.* loggers, so a plain module-level
    # getLogger(__name__).info() call here would silently go nowhere (root
    # has no handler and defaults to WARNING). Attach directly to this
    # logger rather than touching global logging config, since the reset
    # link is the only way to recover an account until real SMTP is set.
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(_handler)


def _reset_link(token: str) -> str:
    return f"{get_settings().frontend_base_url}/reset-password?token={token}"


def send_password_reset_email(to_email: str, token: str) -> None:
    settings = get_settings()
    link = _reset_link(token)

    if not settings.smtp_host:
        logger.info("Password reset requested for %s — SMTP not configured, reset link: %s", to_email, link)
        return

    message = EmailMessage()
    message["Subject"] = "Reset your College Advisor password"
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(
        "We received a request to reset your College Advisor password.\n\n"
        f"Reset it here: {link}\n\n"
        f"This link expires in {settings.password_reset_token_max_age_minutes} minutes. "
        "If you didn't request this, you can ignore this email."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

"""Real email/password + Google OAuth login (backend/docs/user-stories.md story 1).

Replaces the old `X-User-Email` dev-auth placeholder. See app/core/security.py
for password hashing / session-cookie signing and app/core/auth.py for how
every other router resolves `current_user` from the cookie this router sets.
"""

import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Annotated

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.email import send_password_reset_email
from app.core.security import (
    SESSION_COOKIE_NAME,
    create_session_token,
    hash_password,
    verify_password,
)
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.routers.billing import reconcile_expired_cancellation, upsert_subscription_for_user
from app.schemas.auth import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, UserOut

router = APIRouter()

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password",
)


def _user_out(user: User) -> UserOut:
    return UserOut(email=user.email, name=user.name, role=user.role, tier=user.tier)


def _set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(user.id),
        max_age=settings.session_max_age_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.environment != "local",
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=UserOut)
async def register(
    payload: RegisterIn,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    normalized_email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=normalized_email,
        name=payload.name.strip(),
        role=payload.role,
        tier="free",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    # Always grant `free` here regardless of `payload.plan` — same guard as
    # `POST /subscribe` (see billing.py's module docstring). A paid plan must
    # come from real Stripe payment via `POST /checkout` + `GET
    # /checkout/verify`, never from a client-supplied field at signup time.
    # The frontend sends the user straight to checkout after registration if
    # they picked a paid plan here.
    await upsert_subscription_for_user(db, user, "free")

    _set_session_cookie(response, user)
    return _user_out(user)


@router.post("/login", response_model=UserOut)
async def login(
    payload: LoginIn,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    normalized_email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    # Same generic error whether the account doesn't exist, has no password
    # set (e.g. Google-only account), or the password is wrong — never reveal
    # which case it was (backend/docs/user-stories.md story 1's own
    # anti-enumeration requirement).
    if user is None or user.password_hash is None:
        raise _INVALID_CREDENTIALS
    if not verify_password(payload.password, user.password_hash):
        raise _INVALID_CREDENTIALS

    _set_session_cookie(response, user)
    return _user_out(user)


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, bool]:
    """Always returns the same generic response, whether or not the account
    exists — same anti-enumeration principle as login() above. Covers the
    2026-08-06 real-auth migration cohort: accounts created under the old
    X-User-Email placeholder have no password_hash and could not previously
    recover access at all (register() 409s on the existing email, and the
    frontend's ForgotPassword page had nothing to call).
    """
    normalized_email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if user is not None:
        settings = get_settings()
        raw_token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
                expires_at=datetime.utcnow() + timedelta(minutes=settings.password_reset_token_max_age_minutes),
            )
        )
        await db.commit()
        # smtplib is blocking — offload so it can't stall the event loop.
        await asyncio.to_thread(send_password_reset_email, user.email, raw_token)

    return {"ok": True}


@router.post("/reset-password", response_model=UserOut)
async def reset_password(
    payload: ResetPasswordIn,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    invalid_link = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired. Request a new one.",
    )

    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    result = await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    reset_token = result.scalar_one_or_none()
    if reset_token is None or reset_token.used_at is not None or reset_token.expires_at < datetime.utcnow():
        raise invalid_link

    result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise invalid_link

    user.password_hash = hash_password(payload.password)
    reset_token.used_at = datetime.utcnow()
    await db.commit()

    # Sign the user straight in — they just proved control of the account.
    _set_session_cookie(response, user)
    return _user_out(user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    # Self-heals a scheduled cancellation into an actual tier downgrade once
    # its paid period has passed — see reconcile_expired_cancellation()'s
    # docstring in billing.py for why this has to happen lazily, on read.
    await reconcile_expired_cancellation(db, current_user)
    return _user_out(current_user)


@router.get("/config")
async def auth_config() -> dict[str, bool]:
    """Public — lets the frontend show/hide the Google login button instead
    of linking to an endpoint that'll respond with raw "not configured" JSON.
    """
    settings = get_settings()
    return {"google_enabled": bool(settings.google_client_id and settings.google_client_secret)}


def _google_oauth() -> OAuth | None:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        return None
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth


@router.get("/google/login")
async def google_login(request: Request, role: str = "student", plan: str = "free"):
    oauth = _google_oauth()
    if oauth is None:
        return {"status": "not_configured", "message": "Google login isn't set up yet."}
    settings = get_settings()
    return await oauth.google.authorize_redirect(
        request, settings.google_redirect_url, state=f"{role}:{plan}"
    )


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    oauth = _google_oauth()
    if oauth is None:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google login isn't set up yet.")

    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or {}
    google_sub = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name")
    if not google_sub or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google did not return an email.")

    role, _, plan = (request.query_params.get("state") or "student:free").partition(":")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()
    if user is None:
        # Not linked by sub yet — fall back to email (first-time Google login
        # on an account that may already exist from password signup).
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()

    if user is None:
        user = User(
            email=email.lower(),
            name=name,
            role=role or "student",
            tier="free",
            google_sub=google_sub,
        )
        db.add(user)
        await db.flush()
        # Same guard as password registration above — never grant a paid
        # plan from a client-supplied value with no real payment behind it.
        await upsert_subscription_for_user(db, user, "free")
    elif user.google_sub is None:
        user.google_sub = google_sub
        await db.commit()

    settings = get_settings()
    redirect = RedirectResponse(url=f"{settings.frontend_base_url}/dashboard")
    _set_session_cookie(redirect, user)
    return redirect

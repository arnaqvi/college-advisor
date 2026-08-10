"""Real auth dependency — resolves the current user from a signed session cookie.

Replaces the old dev-only `X-User-Email` header trust. Every other router in
this app already depends on `get_current_user` via `Depends(get_current_user)`
and only cares that it gets back a `User` — none of them needed to change for
this rewrite (confirmed: billing.py, profile.py, colleges.py, every
onboarding/* router use this exact pattern).

See app/core/security.py for the cookie signing itself and
app/routers/auth.py for where the cookie actually gets set (register/login/
google callback) and cleared (logout).
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import SESSION_COOKIE_NAME, read_session_token
from app.models.user import User


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Resolve the current user from the signed session cookie, or 401."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    user_id = read_session_token(token) if token else None
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


async def get_current_user_optional(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Same as get_current_user, but returns None instead of 401 when there's no session."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    user_id = read_session_token(token) if token else None
    if user_id is None:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

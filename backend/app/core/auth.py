"""Temporary development auth dependency.

*** TEMPORARY / PLACEHOLDER — DO NOT MISTAKE THIS FOR REAL AUTH ***

There is no real backend authentication yet. OAuth (Google/Microsoft) and
password login are Phase 2/3 work (see docs/user-stories.md, "Login Page").
Today the frontend only sets a client-side role flag in localStorage /
sessionStorage (see frontend/src/context/AuthContext.jsx) — it never proves
identity to this backend at all.

`get_current_user` below is a stand-in so the onboarding API (every table of
which FKs to `users.id`) can be built and exercised now, ahead of real auth.
It trusts a plain `X-User-Email` request header and looks up — or
auto-creates, with role="student"/tier="free" — a matching `users` row.

THIS MUST BE REPLACED before this app is exposed to real users:
  - anyone can act as any user by setting the header to any email
  - there is no password/token/session verification of any kind
  - it does not honor `users.google_sub` / `users.microsoft_sub` at all

When real Phase 2/3 auth ships, replace the body of `get_current_user` with
real session/JWT verification and delete the header-trust logic below. Every
onboarding router depends on this function — grep for `get_current_user` to
find every call site that needs to keep working unchanged.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_user_email: Annotated[str | None, Header()] = None,
) -> User:
    """Resolve the current user from the (temporary, dev-only) auth header."""
    if not x_user_email or not x_user_email.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Email header (temporary dev auth placeholder)",
        )

    normalized_email = x_user_email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(email=normalized_email, role="student", tier="free")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

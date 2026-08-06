"""User model.

Minimal stand-in for the full Phase 2 `users` table described in
`docs/user-stories.md` (role, tier, password_hash, google_sub, microsoft_sub).
It's created now, ahead of Phase 2, only because the onboarding tables in
`app/models/onboarding.py` FK to `users.id` and need a real table to point at.

Real auth (Google/Microsoft OAuth, password login) has NOT been built yet.
See `app/core/auth.py` for the TEMPORARY dev auth dependency that creates/
looks up rows in this table from a request header.
"""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class User(Base):
    """A registered user (student, parent, or counsellor)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20), default="student")
    tier: Mapped[str] = mapped_column(String(20), default="free")
    # Nullable — only set for accounts created via the future Email + Password
    # tab. Never populated or read by the dev auth placeholder.
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    microsoft_sub: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

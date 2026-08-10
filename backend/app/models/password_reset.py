"""Password reset tokens.

A brand-new table (not a column added to the existing `users` table) so it
picks up automatically via `Base.metadata.create_all` in `app/main.py`'s
lifespan — no manual `ALTER TABLE` step needed, unlike `users.name` (see
`_ensure_user_name_column`). Only a SHA-256 hash of the token is stored,
never the raw value — same reasoning as `users.password_hash`, except the
raw token here is a high-entropy `secrets.token_urlsafe` value rather than a
user-chosen password, so a fast deterministic hash (not argon2) is enough
for the lookup-by-hash pattern in `app/routers/auth.py`.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

"""Student profile table — GET/PUT /api/profile.

One row per user, storing the flat frontend profile object (GPA, test scores,
target colleges, essays, documents, etc. — see frontend/src/context/
AppContext.jsx's EMPTY_PROFILE) as a single JSON-in-Text blob, same convention
as OnboardingProgress.completed_steps / AcademicRecord.rigor_courses in
app/models/onboarding.py. Deliberately opaque to the backend — the frontend
shape can evolve without a migration here.

This replaces the previous behavior of storing the profile only in the
browser's localStorage under one unscoped key, which caused every login on
the same browser to inherit whatever profile was last saved there regardless
of which user was logged in.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Profile(Base):
    """A user's flat student-profile blob (one row per user)."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    data: Mapped[str] = mapped_column(Text)  # JSON-encoded flat profile blob
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

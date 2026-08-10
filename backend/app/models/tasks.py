"""Timeline task tracking — see frontend/src/pages/Timeline.jsx.

Two tables, deliberately not one polymorphic "tasks" table:

- `TaskCompletion` only tracks completion state for the frontend's own
  computed task list (the static month skeleton in data/timeline.js, plus
  per-college hard deadlines derived from tier classification). The backend
  doesn't know or need to know a task's title — the frontend already
  computes that deterministically from the profile + college list, so
  duplicating that logic in Python would just be a second implementation to
  keep in sync. `slug` is the frontend-computed stable identity (see
  lib/engine/taskSlugs.js); the backend only ever stores "this slug, for
  this user, is done."
- `CustomTask` is fully backend-owned content (title/category/due date) for
  items the student adds themselves that have no client-computable identity.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class TaskCompletion(Base):
    __tablename__ = "task_completions"
    __table_args__ = (UniqueConstraint("user_id", "slug", name="uq_task_completions_user_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    slug: Mapped[str] = mapped_column(String(255), index=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CustomTask(Base):
    __tablename__ = "custom_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(20))  # "student" | "parent"
    month: Mapped[str | None] = mapped_column(String(20), default=None)
    due_date: Mapped[date | None] = mapped_column(Date, default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

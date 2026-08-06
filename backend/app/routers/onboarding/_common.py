"""Shared helpers for onboarding CRUD routers.

Kept tiny and non-generic on purpose — each resource router still owns its
explicit route handlers (readable, mypy-strict-friendly), this module only
factors out the one bit of literal repetition: "fetch a row by id, scoped to
the current user, or 404."
"""

from typing import Protocol, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class _OwnedRow(Protocol):
    id: int
    user_id: int


RowT = TypeVar("RowT", bound=_OwnedRow)


async def get_owned_or_404(
    db: AsyncSession,
    model: type[RowT],
    record_id: int,
    user_id: int,
    not_found_detail: str,
) -> RowT:
    """Fetch a row by id, scoped to `user_id`, or raise 404.

    Scoping the WHERE clause to `user_id` (rather than fetching by id alone
    and checking ownership after) means a user can never even detect another
    user's row exists via a 403-vs-404 timing/response difference.
    """
    result = await db.execute(
        select(model).where(model.id == record_id, model.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=not_found_detail)
    return record

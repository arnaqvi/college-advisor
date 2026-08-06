"""GET/PUT /api/profile — one-per-user upsert of the flat student profile blob.

Same shape/pattern as app/routers/onboarding/academic_record.py, applied to
the frontend's flat profile object instead of a normalized onboarding table.
"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileIn, ProfileOut

router = APIRouter()


@router.get("", response_model=ProfileOut | None)
async def get_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut | None:
    result = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return ProfileOut(data=json.loads(row.data), updated_at=row.updated_at)


@router.put("", response_model=ProfileOut)
async def upsert_profile(
    payload: ProfileIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    result = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    row = result.scalar_one_or_none()

    encoded = json.dumps(payload.data)
    if row is None:
        row = Profile(user_id=current_user.id, data=encoded)
        db.add(row)
    else:
        row.data = encoded

    await db.commit()
    await db.refresh(row)
    return ProfileOut(data=json.loads(row.data), updated_at=row.updated_at)

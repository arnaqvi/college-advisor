"""GET/PATCH /api/onboarding/progress — docs/onboarding-flow-design.md §5."""

import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import OnboardingProgress
from app.models.user import User
from app.schemas.onboarding import OnboardingProgressOut, OnboardingProgressUpdate

router = APIRouter()


async def _get_or_create_progress(db: AsyncSession, user_id: int) -> OnboardingProgress:
    result = await db.execute(
        select(OnboardingProgress).where(OnboardingProgress.user_id == user_id)
    )
    progress = result.scalar_one_or_none()
    if progress is not None:
        return progress

    progress = OnboardingProgress(user_id=user_id)
    db.add(progress)
    await db.commit()
    await db.refresh(progress)
    return progress


@router.get("", response_model=OnboardingProgressOut)
async def get_progress(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OnboardingProgress:
    return await _get_or_create_progress(db, current_user.id)


@router.patch("", response_model=OnboardingProgressOut)
async def update_progress(
    payload: OnboardingProgressUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OnboardingProgress:
    progress = await _get_or_create_progress(db, current_user.id)

    completed = set(json.loads(progress.completed_steps or "[]"))
    completed.add(progress.current_step)
    progress.completed_steps = json.dumps(sorted(completed))
    progress.current_step = payload.current_step
    progress.last_active_at = datetime.utcnow()

    await db.commit()
    await db.refresh(progress)
    return progress

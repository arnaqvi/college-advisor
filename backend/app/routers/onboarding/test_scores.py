"""CRUD for /api/onboarding/test-scores — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import TestScore
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import TestScoreIn, TestScoreOut, TestScoreUpdate

router = APIRouter()


@router.get("", response_model=list[TestScoreOut])
async def list_test_scores(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TestScore]:
    result = await db.execute(select(TestScore).where(TestScore.user_id == current_user.id))
    return list(result.scalars().all())


@router.post("", response_model=TestScoreOut, status_code=status.HTTP_201_CREATED)
async def create_test_score(
    payload: TestScoreIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestScore:
    record = TestScore(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{score_id}", response_model=TestScoreOut)
async def update_test_score(
    score_id: int,
    payload: TestScoreUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestScore:
    record = await get_owned_or_404(db, TestScore, score_id, current_user.id, "Test score not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_score(
    score_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(db, TestScore, score_id, current_user.id, "Test score not found")
    await db.delete(record)
    await db.commit()

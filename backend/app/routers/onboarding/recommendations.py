"""CRUD for /api/onboarding/recommendations — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import Recommendation
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import RecommendationIn, RecommendationOut, RecommendationUpdate

router = APIRouter()


@router.get("", response_model=list[RecommendationOut])
async def list_recommendations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Recommendation]:
    result = await db.execute(
        select(Recommendation).where(Recommendation.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("", response_model=RecommendationOut, status_code=status.HTTP_201_CREATED)
async def create_recommendation(
    payload: RecommendationIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Recommendation:
    record = Recommendation(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{recommendation_id}", response_model=RecommendationOut)
async def update_recommendation(
    recommendation_id: int,
    payload: RecommendationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Recommendation:
    record = await get_owned_or_404(
        db, Recommendation, recommendation_id, current_user.id, "Recommendation not found"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recommendation(
    recommendation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(
        db, Recommendation, recommendation_id, current_user.id, "Recommendation not found"
    )
    await db.delete(record)
    await db.commit()

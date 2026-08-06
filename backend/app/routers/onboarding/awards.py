"""CRUD for /api/onboarding/awards — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import Award
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import AwardIn, AwardOut, AwardUpdate

router = APIRouter()


@router.get("", response_model=list[AwardOut])
async def list_awards(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Award]:
    result = await db.execute(select(Award).where(Award.user_id == current_user.id))
    return list(result.scalars().all())


@router.post("", response_model=AwardOut, status_code=status.HTTP_201_CREATED)
async def create_award(
    payload: AwardIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Award:
    record = Award(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{award_id}", response_model=AwardOut)
async def update_award(
    award_id: int,
    payload: AwardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Award:
    record = await get_owned_or_404(db, Award, award_id, current_user.id, "Award not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{award_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_award(
    award_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(db, Award, award_id, current_user.id, "Award not found")
    await db.delete(record)
    await db.commit()

"""CRUD for /api/onboarding/volunteer-experiences — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import VolunteerExperience
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import (
    VolunteerExperienceIn,
    VolunteerExperienceOut,
    VolunteerExperienceUpdate,
)

router = APIRouter()


@router.get("", response_model=list[VolunteerExperienceOut])
async def list_volunteer_experiences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[VolunteerExperience]:
    result = await db.execute(
        select(VolunteerExperience).where(VolunteerExperience.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("", response_model=VolunteerExperienceOut, status_code=status.HTTP_201_CREATED)
async def create_volunteer_experience(
    payload: VolunteerExperienceIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VolunteerExperience:
    record = VolunteerExperience(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{experience_id}", response_model=VolunteerExperienceOut)
async def update_volunteer_experience(
    experience_id: int,
    payload: VolunteerExperienceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> VolunteerExperience:
    record = await get_owned_or_404(
        db, VolunteerExperience, experience_id, current_user.id, "Volunteer experience not found"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_volunteer_experience(
    experience_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(
        db, VolunteerExperience, experience_id, current_user.id, "Volunteer experience not found"
    )
    await db.delete(record)
    await db.commit()

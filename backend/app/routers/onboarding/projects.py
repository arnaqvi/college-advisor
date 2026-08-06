"""CRUD for /api/onboarding/projects (personal projects) — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import PersonalProject
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import PersonalProjectIn, PersonalProjectOut, PersonalProjectUpdate

router = APIRouter()


@router.get("", response_model=list[PersonalProjectOut])
async def list_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PersonalProject]:
    result = await db.execute(
        select(PersonalProject).where(PersonalProject.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("", response_model=PersonalProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: PersonalProjectIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PersonalProject:
    record = PersonalProject(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{project_id}", response_model=PersonalProjectOut)
async def update_project(
    project_id: int,
    payload: PersonalProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PersonalProject:
    record = await get_owned_or_404(
        db, PersonalProject, project_id, current_user.id, "Project not found"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(
        db, PersonalProject, project_id, current_user.id, "Project not found"
    )
    await db.delete(record)
    await db.commit()

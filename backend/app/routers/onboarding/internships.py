"""CRUD for /api/onboarding/internships — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import Internship
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import InternshipIn, InternshipOut, InternshipUpdate

router = APIRouter()


@router.get("", response_model=list[InternshipOut])
async def list_internships(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Internship]:
    result = await db.execute(select(Internship).where(Internship.user_id == current_user.id))
    return list(result.scalars().all())


@router.post("", response_model=InternshipOut, status_code=status.HTTP_201_CREATED)
async def create_internship(
    payload: InternshipIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Internship:
    record = Internship(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{internship_id}", response_model=InternshipOut)
async def update_internship(
    internship_id: int,
    payload: InternshipUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Internship:
    record = await get_owned_or_404(
        db, Internship, internship_id, current_user.id, "Internship not found"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{internship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_internship(
    internship_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(
        db, Internship, internship_id, current_user.id, "Internship not found"
    )
    await db.delete(record)
    await db.commit()

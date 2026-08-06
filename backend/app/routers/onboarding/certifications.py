"""CRUD for /api/onboarding/certifications — §5."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import Certification
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import CertificationIn, CertificationOut, CertificationUpdate

router = APIRouter()


@router.get("", response_model=list[CertificationOut])
async def list_certifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Certification]:
    result = await db.execute(
        select(Certification).where(Certification.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("", response_model=CertificationOut, status_code=status.HTTP_201_CREATED)
async def create_certification(
    payload: CertificationIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Certification:
    record = Certification(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{certification_id}", response_model=CertificationOut)
async def update_certification(
    certification_id: int,
    payload: CertificationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Certification:
    record = await get_owned_or_404(
        db, Certification, certification_id, current_user.id, "Certification not found"
    )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{certification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certification(
    certification_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(
        db, Certification, certification_id, current_user.id, "Certification not found"
    )
    await db.delete(record)
    await db.commit()

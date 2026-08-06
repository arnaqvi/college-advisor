"""GET/PUT /api/onboarding/academic-record — one-per-user upsert, §5."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import AcademicRecord
from app.models.user import User
from app.schemas.onboarding import AcademicRecordIn, AcademicRecordOut

router = APIRouter()


@router.get("", response_model=AcademicRecordOut | None)
async def get_academic_record(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AcademicRecord | None:
    result = await db.execute(
        select(AcademicRecord).where(AcademicRecord.user_id == current_user.id)
    )
    return result.scalar_one_or_none()


@router.put("", response_model=AcademicRecordOut)
async def upsert_academic_record(
    payload: AcademicRecordIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AcademicRecord:
    result = await db.execute(
        select(AcademicRecord).where(AcademicRecord.user_id == current_user.id)
    )
    record = result.scalar_one_or_none()

    data = payload.model_dump(exclude={"rigor_courses"})
    rigor_courses_json = json.dumps(payload.rigor_courses) if payload.rigor_courses is not None else None

    if record is None:
        record = AcademicRecord(user_id=current_user.id, rigor_courses=rigor_courses_json, **data)
        db.add(record)
    else:
        for field, value in data.items():
            setattr(record, field, value)
        record.rigor_courses = rigor_courses_json

    await db.commit()
    await db.refresh(record)
    return record

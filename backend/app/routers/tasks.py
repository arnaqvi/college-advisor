"""GET/PUT /api/tasks/completions/{slug}, CRUD /api/tasks/custom — see app/models/tasks.py."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.tasks import CustomTask, TaskCompletion
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.tasks import CompletionIn, CompletionsOut, CustomTaskIn, CustomTaskOut, CustomTaskUpdate

router = APIRouter()


async def _completions_out(db: AsyncSession, user_id: int) -> CompletionsOut:
    result = await db.execute(select(TaskCompletion.slug).where(TaskCompletion.user_id == user_id))
    return CompletionsOut(completed_slugs=list(result.scalars().all()))


@router.get("/completions", response_model=CompletionsOut)
async def list_completions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompletionsOut:
    return await _completions_out(db, current_user.id)


@router.put("/completions/{slug}", response_model=CompletionsOut)
async def set_completion(
    slug: str,
    payload: CompletionIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompletionsOut:
    result = await db.execute(
        select(TaskCompletion).where(TaskCompletion.user_id == current_user.id, TaskCompletion.slug == slug)
    )
    row = result.scalar_one_or_none()

    if payload.completed and row is None:
        db.add(TaskCompletion(user_id=current_user.id, slug=slug, completed_at=datetime.utcnow()))
    elif not payload.completed and row is not None:
        await db.delete(row)
    await db.commit()

    return await _completions_out(db, current_user.id)


@router.get("/custom", response_model=list[CustomTaskOut])
async def list_custom_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CustomTask]:
    result = await db.execute(select(CustomTask).where(CustomTask.user_id == current_user.id))
    return list(result.scalars().all())


@router.post("/custom", response_model=CustomTaskOut, status_code=status.HTTP_201_CREATED)
async def create_custom_task(
    payload: CustomTaskIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CustomTask:
    record = CustomTask(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/custom/{task_id}", response_model=CustomTaskOut)
async def update_custom_task(
    task_id: int,
    payload: CustomTaskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CustomTask:
    record = await get_owned_or_404(db, CustomTask, task_id, current_user.id, "Task not found")
    data = payload.model_dump(exclude_unset=True)
    if "completed" in data:
        completed = data.pop("completed")
        record.completed_at = datetime.utcnow() if completed else None
    for field, value in data.items():
        setattr(record, field, value)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/custom/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_task(
    task_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(db, CustomTask, task_id, current_user.id, "Task not found")
    await db.delete(record)
    await db.commit()

"""Pydantic v2 request/response models for /api/tasks — see app/models/tasks.py."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class CompletionsOut(BaseModel):
    completed_slugs: list[str]


class CompletionIn(BaseModel):
    completed: bool


class CustomTaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    category: Literal["student", "parent"]
    month: str | None = None
    due_date: date | None = None


class CustomTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    completed: bool | None = None
    due_date: date | None = None


class CustomTaskOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    category: str
    month: str | None
    due_date: date | None
    completed_at: datetime | None
    created_at: datetime

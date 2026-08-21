"""Pydantic v2 request model for /api/feedback."""

from pydantic import BaseModel, Field


class FeedbackIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=1, max_length=320)
    message: str = Field(min_length=1, max_length=5000)

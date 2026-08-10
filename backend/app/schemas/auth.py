"""Pydantic v2 request/response models for /api/auth/*."""

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["student", "parent", "counselor"]
Plan = Literal["free", "individual", "family", "counselor"]


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str
    role: Role
    plan: Plan = "free"


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    email: str
    name: str | None
    role: str
    tier: str


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8)

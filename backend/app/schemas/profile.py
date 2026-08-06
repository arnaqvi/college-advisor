"""Pydantic v2 request/response models for GET/PUT /api/profile.

Deliberately opaque (`data: dict`, no per-field validation) — the frontend's
flat profile shape (see frontend/src/context/AppContext.jsx's EMPTY_PROFILE)
is a frontend concern that should be able to evolve without a backend schema
change here.
"""

from datetime import datetime

from pydantic import BaseModel


class ProfileIn(BaseModel):
    data: dict


class ProfileOut(BaseModel):
    data: dict
    updated_at: datetime

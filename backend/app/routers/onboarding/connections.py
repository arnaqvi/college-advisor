"""GET /api/onboarding/connections + POST .../connect — §5, §9.

`ExternalConnectionAdapter` (the `Protocol` in §9) isn't implemented yet —
no provider adapters exist. `connect` intentionally returns
501 Not Implemented per the doc ("Phase future").
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import ExternalConnection
from app.models.user import User
from app.schemas.onboarding import ExternalConnectionOut

router = APIRouter()


@router.get("", response_model=list[ExternalConnectionOut])
async def list_connections(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ExternalConnection]:
    result = await db.execute(
        select(ExternalConnection).where(ExternalConnection.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("/{provider}/connect", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def connect_provider(
    provider: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"'{provider}' integration is not implemented yet — coming in a future phase",
    )

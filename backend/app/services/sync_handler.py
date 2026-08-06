"""Sync event handler — subscribes to profile events and triggers sync.

This handler is attached to the EventBus at app startup and processes
every profile create/update event.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.database import get_db
from app.services.event_service import ProfileEvent, event_bus
from app.services.sync_service import ProfileSyncService

logger = logging.getLogger(__name__)


async def handle_profile_sync_event(event: ProfileEvent) -> None:
    """Sync handler — called when a profile.created or profile.updated event fires.

    This is the main integration point: whenever a profile changes, this runs
    the full sync pipeline (validation → roadmap → scoring → persistence).
    """
    logger.info(f"Handling profile sync event for user {event.user_id}: {event.event_type}")

    # Get a fresh DB session for this event
    async_db = get_settings().get_async_engine()
    async_session = sessionmaker(
        async_db, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )

    async with async_session() as db:
        sync_service = ProfileSyncService(db)
        result = await sync_service.sync_profile(event)

        if result["success"]:
            logger.info(f"Sync succeeded for user {event.user_id}: {result}")
            # TODO: Emit UI update notification here (websocket push)
        else:
            logger.warning(f"Sync failed for user {event.user_id}: {result}")


def register_sync_handlers() -> None:
    """Register the profile sync handler on app startup.

    Call this from the FastAPI lifespan context manager.
    """
    event_bus.subscribe("profile.created", handle_profile_sync_event)
    event_bus.subscribe("profile.updated", handle_profile_sync_event)
    logger.info("Profile sync handlers registered on EventBus")

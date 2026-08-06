"""Event service — emits and captures profile create/update events.

Every time a profile field changes, this service emits an event that the
sync engine subscribes to. The event includes the user ID, trigger type
(create/update), and which fields changed.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class ProfileEvent:
    """A profile create or update event."""

    event_type: str  # "profile.created" or "profile.updated"
    user_id: int
    trigger_source: str  # "api", "import", "sync"
    timestamp: datetime
    # For updates: which fields changed? (before/after snapshot)
    changed_fields: dict[str, Any] = field(default_factory=dict)
    # Full profile snapshot at time of event
    profile_snapshot: dict[str, Any] = field(default_factory=dict)


class EventBus:
    """Simple in-memory event bus for profile sync events.

    In production, replace with a message queue (Redis, RabbitMQ) so events
    persist and can be replayed if the sync service crashes.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable[[ProfileEvent], None]]] = {}
        self._event_history: list[ProfileEvent] = []

    def subscribe(self, event_type: str, handler: Callable[[ProfileEvent], None]) -> None:
        """Subscribe a handler to an event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.debug(f"Handler subscribed to {event_type}")

    async def emit(self, event: ProfileEvent) -> None:
        """Emit an event to all subscribed handlers.

        Runs handlers sequentially (not in parallel) so that state updates
        propagate in order. In production with a real message queue, this
        would be async and retry on failure.
        """
        self._event_history.append(event)
        logger.info(
            f"Event emitted: {event.event_type} for user {event.user_id}, "
            f"changed_fields={list(event.changed_fields.keys())}"
        )

        handlers = self._subscribers.get(event.event_type, [])
        if not handlers:
            logger.warning(f"No handlers registered for {event.event_type}")
            return

        for handler in handlers:
            try:
                # If handler is async, await it; otherwise call it directly
                result = handler(event)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(
                    f"Error in handler for {event.event_type}: {e}",
                    exc_info=True,
                )
                # Don't re-raise — let other handlers run even if one fails

    def get_event_history(self, user_id: int | None = None) -> list[ProfileEvent]:
        """Get the event history (optionally filtered by user)."""
        if user_id is None:
            return self._event_history
        return [e for e in self._event_history if e.user_id == user_id]


# Global event bus — attach handlers to this at app startup
event_bus = EventBus()


def emit_profile_created_event(user_id: int, profile_snapshot: dict[str, Any]) -> None:
    """Helper to emit a profile.created event.

    Call this from the profile creation endpoint after the profile is saved.
    """
    event = ProfileEvent(
        event_type="profile.created",
        user_id=user_id,
        trigger_source="api",
        timestamp=datetime.utcnow(),
        profile_snapshot=profile_snapshot,
    )
    # We have to use asyncio.run() here if called from sync context,
    # but ideally this is awaited from an async context in the router
    try:
        asyncio.run(event_bus.emit(event))
    except RuntimeError:
        # Event loop already running — just emit without await (will be handled by lifespan task)
        asyncio.create_task(event_bus.emit(event))


def emit_profile_updated_event(
    user_id: int,
    changed_fields: dict[str, Any],
    profile_snapshot: dict[str, Any],
) -> None:
    """Helper to emit a profile.updated event.

    Call this from any profile update endpoint, passing the fields that changed.
    """
    event = ProfileEvent(
        event_type="profile.updated",
        user_id=user_id,
        trigger_source="api",
        timestamp=datetime.utcnow(),
        changed_fields=changed_fields,
        profile_snapshot=profile_snapshot,
    )
    try:
        asyncio.run(event_bus.emit(event))
    except RuntimeError:
        asyncio.create_task(event_bus.emit(event))

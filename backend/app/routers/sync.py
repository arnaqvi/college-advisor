"""API routers for profile sync, roadmap, and readiness features.

These endpoints expose the derived data (roadmap, readiness scores, sync history)
to the frontend dashboard and profile pages.
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.derived import ProfileSyncState, ReadinessScoreSnapshot, RoadmapItem, SpecSyncEvent
from app.services.event_service import emit_profile_updated_event, event_bus
from app.services.sync_service import ProfileSyncService

router = APIRouter(prefix="/api/sync", tags=["Sync"])


@router.post("/trigger")
async def trigger_sync(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Manually trigger a profile sync.

    This is useful for debugging or forcing a re-computation. Normally,
    syncs are triggered automatically by profile update events.
    """
    # Get the user's current profile snapshot
    # (in production, build this from the actual profile tables)
    profile_snapshot = {
        "graduation_year": 2027,  # Placeholder
        "user_id": user_id,
    }

    # Emit a profile.updated event (which the handler will pick up)
    emit_profile_updated_event(
        user_id=user_id,
        changed_fields={"manual_trigger": True},
        profile_snapshot=profile_snapshot,
    )

    return {"status": "sync_triggered", "user_id": user_id}


@router.get("/roadmap/{user_id}")
async def get_roadmap(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get the latest roadmap items for a student.

    Returns items grouped by track (student/parent) and ordered by due month.
    """
    stmt = (
        select(RoadmapItem)
        .where(RoadmapItem.user_id == user_id)
        .order_by(RoadmapItem.due_year, RoadmapItem.due_month)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    if not items:
        raise HTTPException(status_code=404, detail="No roadmap found for this user")

    # Group by track
    student_items = [
        {
            "id": item.id,
            "type": item.item_type,
            "title": item.title,
            "description": item.description,
            "due": f"{item.due_month}/{item.due_year}",
            "is_hard_deadline": item.is_hard_deadline,
            "status": item.status,
        }
        for item in items
        if item.track == "student"
    ]

    parent_items = [
        {
            "id": item.id,
            "type": item.item_type,
            "title": item.title,
            "description": item.description,
            "due": f"{item.due_month}/{item.due_year}",
            "is_hard_deadline": item.is_hard_deadline,
            "status": item.status,
        }
        for item in items
        if item.track == "parent"
    ]

    return {
        "user_id": user_id,
        "student_track": student_items,
        "parent_track": parent_items,
        "total_items": len(items),
    }


@router.get("/readiness/{user_id}")
async def get_readiness_score(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get the latest readiness score snapshot for a student."""
    stmt = (
        select(ReadinessScoreSnapshot)
        .where(ReadinessScoreSnapshot.user_id == user_id)
        .order_by(ReadinessScoreSnapshot.created_at.desc())
        .limit(1)
    )
    snapshot = await db.scalar(stmt)

    if not snapshot:
        raise HTTPException(status_code=404, detail="No readiness score found for this user")

    return {
        "user_id": user_id,
        "overall_score": snapshot.overall_score,
        "status": snapshot.status,
        "component_scores": json.loads(snapshot.component_scores),
        "gaps_identified": json.loads(snapshot.gaps_identified or "[]"),
        "updated_at": snapshot.created_at.isoformat(),
    }


@router.get("/events/{user_id}")
async def get_sync_events(
    user_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get the sync event audit log for a user.

    Shows when profile was last synced, what changed, and any errors.
    """
    stmt = (
        select(SpecSyncEvent)
        .where(SpecSyncEvent.user_id == user_id)
        .order_by(SpecSyncEvent.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    events = result.scalars().all()

    return {
        "user_id": user_id,
        "events": [
            {
                "id": event.id,
                "trigger_type": event.trigger_type,
                "outcome": event.outcome,
                "spec_version": event.spec_version,
                "changed_fields": json.loads(event.changed_fields or "{}"),
                "validation_errors": json.loads(event.validation_errors or "[]"),
                "duration_ms": event.duration_ms,
                "timestamp": event.created_at.isoformat(),
            }
            for event in events
        ],
    }


@router.get("/state/{user_id}")
async def get_sync_state(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get the current sync state (for optimistic locking and debugging)."""
    stmt = select(ProfileSyncState).where(ProfileSyncState.user_id == user_id)
    state = await db.scalar(stmt)

    if not state:
        return {
            "user_id": user_id,
            "sync_version": 0,
            "last_synced_at": None,
            "last_spec_version": "1.0.0",
        }

    return {
        "user_id": user_id,
        "sync_version": state.sync_version,
        "last_synced_at": state.last_synced_at.isoformat(),
        "last_spec_version": state.last_spec_version,
    }

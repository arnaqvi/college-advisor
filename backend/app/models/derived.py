"""Derived data models — Roadmap, Readiness, and Sync events.

These tables store the output of the spec sync engine: roadmap items,
readiness scores, and a complete audit trail of every sync event.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class RoadmapItem(Base):
    """A single milestone in the student's month-by-month roadmap (Section 3.7).

    Regenerated whenever the profile changes (e.g., graduation year, intended major,
    test date). Includes both student and parent tracks.
    """

    __tablename__ = "roadmap_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # When was this roadmap item generated?
    spec_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    sync_event_id: Mapped[int] = mapped_column(
        ForeignKey("spec_sync_events.id"), nullable=True, index=True
    )
    # What type of milestone is this?
    item_type: Mapped[str] = mapped_column(String(50))  # coursework|testing|essay|etc
    # Which track does this belong to?
    track: Mapped[str] = mapped_column(String(20))  # student|parent
    # Human-readable title and description
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # When is this due? (calendar month and year, e.g., "November 2025")
    due_month: Mapped[int] = mapped_column(Integer)
    due_year: Mapped[int] = mapped_column(Integer)
    # Is this a hard deadline (test date, app deadline) or soft (recommended by month)?
    is_hard_deadline: Mapped[bool] = mapped_column(default=False)
    # Status: not_started|in_progress|completed
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    # When was this created/updated?
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class ReadinessScoreSnapshot(Base):
    """A point-in-time snapshot of the student's readiness score (all components).

    Regenerated every time the profile is updated. Each score component is stored
    separately so we can track which areas need attention over time.
    """

    __tablename__ = "readiness_score_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # When was this snapshot taken?
    spec_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    sync_event_id: Mapped[int] = mapped_column(
        ForeignKey("spec_sync_events.id"), nullable=True, index=True
    )
    # Overall readiness score (0.0–1.0)
    overall_score: Mapped[float] = mapped_column(Float)
    # Status: on_track|at_risk|behind
    status: Mapped[str] = mapped_column(String(20))
    # JSON object of component scores (e.g., {"academic_rigor": 0.8, "essays": 0.5, ...})
    component_scores: Mapped[str] = mapped_column(Text)  # JSON
    # What specific gaps were identified? (e.g., "Missing test scores", "No essays started")
    gaps_identified: Mapped[str | None] = mapped_column(Text, default=None)  # JSON list
    # When was this snapshot created?
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SpecSyncEvent(Base):
    """Audit log entry for every profile sync (create/update event).

    Use this to track which spec version produced any given roadmap/score,
    and to debug version mismatches over time.
    """

    __tablename__ = "spec_sync_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # What triggered this sync?
    trigger_type: Mapped[str] = mapped_column(String(20))  # create|update
    # Which fields changed? (JSON object, only for updates)
    changed_fields: Mapped[str | None] = mapped_column(Text, default=None)
    # Which spec version was applied?
    spec_version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    # What was the outcome? (e.g., "roadmap_regenerated", "score_updated", "validation_failed")
    outcome: Mapped[str] = mapped_column(String(100))
    # If validation failed, what was the error?
    validation_errors: Mapped[str | None] = mapped_column(Text, default=None)  # JSON list
    # How long did the sync take (ms)?
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    # When did this event occur?
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    # Optional: what was the previous state before this sync?
    previous_state_snapshot: Mapped[str | None] = mapped_column(Text, default=None)  # JSON


class ProfileSyncState(Base):
    """Optimistic locking state for concurrent profile updates.

    Used to detect concurrent edits and decide on a merge strategy (last-write-wins vs rollback).
    """

    __tablename__ = "profile_sync_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    # Version number of the last successful sync
    sync_version: Mapped[int] = mapped_column(Integer, default=0)
    # Timestamp of last successful sync
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Which spec version was used for the last sync?
    last_spec_version: Mapped[str] = mapped_column(String(20), default="1.0.0")

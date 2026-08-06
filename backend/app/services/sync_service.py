"""Sync service — recomputes derived data when profile changes.

This service listens to profile events and regenerates roadmap items, readiness
scores, and validation results according to the spec rules. It persists all
changes in a transaction and emits UI update notifications.
"""

import json
import logging
import time
from datetime import datetime
from typing import Any

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.spec_config import (
    ProfileClassification,
    RoadmapItemType,
    SpecConfig,
    TrackType,
    get_current_spec_config,
)
from app.models.derived import ProfileSyncState, ReadinessScoreSnapshot, RoadmapItem, SpecSyncEvent
from app.models.onboarding import AcademicRecord, OnboardingProgress
from app.models.user import User
from app.services.event_service import ProfileEvent

logger = logging.getLogger(__name__)


class ProfileSyncService:
    """Orchestrates profile sync: validation → roadmap generation → scoring → persistence."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.spec = get_current_spec_config()
        self.start_time = time.time()

    async def sync_profile(self, event: ProfileEvent) -> dict[str, Any]:
        """Main entry point: validate, regenerate, and persist all derived data.

        Returns a dict with sync outcome, duration, and any errors/warnings.
        """
        user_id = event.user_id
        logger.info(f"Starting sync for user {user_id}, trigger: {event.event_type}")

        try:
            # 1. Validate profile against spec rules
            validation_errors = await self._validate_profile(user_id, event.profile_snapshot)
            if validation_errors:
                logger.warning(f"Validation errors for user {user_id}: {validation_errors}")
                await self._record_sync_event(
                    user_id,
                    event.event_type,
                    event.changed_fields,
                    outcome="validation_failed",
                    validation_errors=validation_errors,
                )
                return {
                    "success": False,
                    "outcome": "validation_failed",
                    "errors": validation_errors,
                }

            # 2. Regenerate roadmap items
            roadmap_items = await self._generate_roadmap_items(user_id, event.profile_snapshot)
            logger.info(f"Generated {len(roadmap_items)} roadmap items for user {user_id}")

            # 3. Calculate readiness score
            readiness_snapshot = await self._calculate_readiness_score(
                user_id, event.profile_snapshot
            )
            logger.info(
                f"Calculated readiness score for user {user_id}: {readiness_snapshot['overall_score']}"
            )

            # 4. Persist all changes in a transaction
            await self._persist_sync_results(
                user_id,
                event,
                roadmap_items,
                readiness_snapshot,
            )

            duration_ms = int((time.time() - self.start_time) * 1000)
            await self._record_sync_event(
                user_id,
                event.event_type,
                event.changed_fields,
                outcome="success",
                duration_ms=duration_ms,
            )

            logger.info(f"Sync completed for user {user_id} in {duration_ms}ms")
            return {
                "success": True,
                "outcome": "success",
                "roadmap_items_count": len(roadmap_items),
                "readiness_score": readiness_snapshot["overall_score"],
                "duration_ms": duration_ms,
            }

        except Exception as e:
            logger.error(f"Sync failed for user {user_id}: {e}", exc_info=True)
            duration_ms = int((time.time() - self.start_time) * 1000)
            await self._record_sync_event(
                user_id,
                event.event_type,
                event.changed_fields,
                outcome="error",
                validation_errors=[str(e)],
                duration_ms=duration_ms,
            )
            return {
                "success": False,
                "outcome": "error",
                "error": str(e),
                "duration_ms": duration_ms,
            }

    async def _validate_profile(self, user_id: int, profile_snapshot: dict[str, Any]) -> list[str]:
        """Run profile against all spec validation rules.

        Returns list of error messages; empty list if valid.
        """
        errors = []

        # Check required fields against spec rules
        for rule in self.spec.validation_rules:
            if rule.field == "graduation_year":
                if not profile_snapshot.get("graduation_year"):
                    errors.append(rule.error_message)

            elif rule.field == "academic_record":
                # Must have at least one academic record entry
                stmt = select(AcademicRecord).where(AcademicRecord.user_id == user_id)
                result = await self.db.execute(stmt)
                if not result.first():
                    errors.append(rule.error_message)

        return errors

    async def _generate_roadmap_items(
        self, user_id: int, profile_snapshot: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate roadmap items for the student's current grade and phase.

        Returns list of roadmap item dicts (not persisted yet).
        """
        user_stmt = select(User).where(User.id == user_id)
        user = await self.db.scalar(user_stmt)
        if not user:
            return []

        # Get student's current grade (derived from graduation year)
        grad_year = profile_snapshot.get("graduation_year")
        current_year = datetime.utcnow().year
        current_grade = 12 - (grad_year - current_year)
        current_grade = max(9, min(12, current_grade))  # Clamp to 9–12

        # Determine phase based on grade
        phase_map = {9: "exploration", 10: "building", 11: "building", 12: "applying"}
        phase = phase_map.get(current_grade, "exploration")

        items = []

        # Get roadmap rules for this grade/phase combination
        for rule in self.spec.roadmap_rules_by_grade_phase:
            if rule.grade == current_grade and rule.phase == phase:
                # Generate items for required types
                for item_type in rule.required_items:
                    student_item = self._create_roadmap_item_for_type(
                        item_type,
                        TrackType.STUDENT,
                        current_grade,
                        grad_year or current_year + (12 - current_grade),
                    )
                    if student_item:
                        items.append(student_item)

                    # Most items also have a parent track
                    if item_type in [
                        RoadmapItemType.FINANCIAL_AID,
                        RoadmapItemType.RECOMMENDATION_REQUEST,
                        RoadmapItemType.CAMPUS_VISIT,
                    ]:
                        parent_item = self._create_roadmap_item_for_type(
                            item_type,
                            TrackType.PARENT,
                            current_grade,
                            grad_year or current_year + (12 - current_grade),
                        )
                        if parent_item:
                            items.append(parent_item)

        return items

    def _create_roadmap_item_for_type(
        self, item_type: RoadmapItemType, track: TrackType, grade: int, grad_year: int
    ) -> dict[str, Any] | None:
        """Create a single roadmap item based on type and grade.

        Returns dict with roadmap item data, or None if not applicable.
        """
        # Map item types to generic timelines
        timeline_map = {
            RoadmapItemType.COURSEWORK: (9, "Enroll in rigorous courses", True),
            RoadmapItemType.TESTING: (11, "Take SAT/ACT", True),
            RoadmapItemType.ESSAY: (11, "Start personal statement", False),
            RoadmapItemType.APPLICATION: (12, "Submit applications", True),
            RoadmapItemType.INTERVIEW: (12, "Schedule and attend interviews", False),
            RoadmapItemType.FINANCIAL_AID: (12, "Complete FAFSA/CSS Profile", True),
            RoadmapItemType.RECOMMENDATION_REQUEST: (11, "Request recommendation letters", True),
            RoadmapItemType.CAMPUS_VISIT: (11, "Visit target colleges", False),
            RoadmapItemType.ACTIVITY: (10, "Develop leadership in extracurriculars", False),
        }

        if item_type not in timeline_map:
            return None

        target_grade, title, is_hard = timeline_map[item_type]
        if grade < target_grade:
            return None  # Not yet time for this item

        # Calculate due month (roughly, for now; in production, use calendar dates)
        due_month = 6 + (target_grade - 9) * 3
        if due_month > 12:
            due_month = due_month - 12
            due_year = grad_year
        else:
            due_year = grad_year - 1

        return {
            "item_type": item_type.value,
            "track": track.value,
            "title": title,
            "description": f"{title} for {track.value}s",
            "due_month": due_month,
            "due_year": due_year,
            "is_hard_deadline": is_hard,
            "status": "not_started",
        }

    async def _calculate_readiness_score(
        self, user_id: int, profile_snapshot: dict[str, Any]
    ) -> dict[str, Any]:
        """Calculate readiness score for the student across all components.

        Returns dict with overall_score, status, and component_scores.
        """
        component_scores = {}

        # Academic Rigor: based on GPA and course rigor
        academic_stmt = select(AcademicRecord).where(AcademicRecord.user_id == user_id)
        academic_record = await self.db.scalar(academic_stmt)
        if academic_record and academic_record.gpa:
            # Normalize GPA to 0–1 scale
            component_scores["academic_rigor"] = min(1.0, academic_record.gpa / 4.0)
        else:
            component_scores["academic_rigor"] = 0.0

        # For now, mock the other components
        component_scores["test_preparation"] = 0.5
        component_scores["essays_in_progress"] = 0.3
        component_scores["extracurricular_depth"] = 0.4
        component_scores["application_timeline"] = 0.2
        component_scores["recommendations_ready"] = 0.1

        # Calculate overall score using spec weights
        overall = 0.0
        for component in self.spec.readiness_components:
            score = component_scores.get(component.name.lower().replace(" ", "_"), 0.0)
            overall += score * component.weight

        # Determine status based on thresholds
        status = "behind"
        if overall >= self.spec.readiness_thresholds["on_track"]:
            status = "on_track"
        elif overall >= self.spec.readiness_thresholds["at_risk"]:
            status = "at_risk"

        # Identify gaps
        gaps = []
        if component_scores.get("academic_rigor", 0) < 0.6:
            gaps.append("Low GPA or limited course rigor")
        if component_scores.get("test_preparation", 0) < 0.5:
            gaps.append("Test scores not submitted")
        if component_scores.get("essays_in_progress", 0) < 0.3:
            gaps.append("No essays started")

        return {
            "overall_score": overall,
            "status": status,
            "component_scores": component_scores,
            "gaps_identified": gaps,
        }

    async def _persist_sync_results(
        self,
        user_id: int,
        event: ProfileEvent,
        roadmap_items: list[dict[str, Any]],
        readiness_snapshot: dict[str, Any],
    ) -> None:
        """Persist roadmap items and readiness snapshot in a transaction.

        Deletes old roadmap items for this user and creates new ones.
        Creates a new readiness snapshot (doesn't delete old ones — they're historical).
        """
        try:
            # Delete existing roadmap items for this user
            stmt = delete(RoadmapItem).where(RoadmapItem.user_id == user_id)
            await self.db.execute(stmt)

            # Create sync event record first (to get its ID)
            sync_event = SpecSyncEvent(
                user_id=user_id,
                trigger_type=event.event_type.split(".")[1],  # "created" or "updated"
                changed_fields=json.dumps(event.changed_fields) if event.changed_fields else None,
                spec_version=str(self.spec.version),
                outcome="in_progress",
            )
            self.db.add(sync_event)
            await self.db.flush()  # Get the sync_event.id

            # Insert new roadmap items
            for item_data in roadmap_items:
                item = RoadmapItem(
                    user_id=user_id,
                    spec_version=str(self.spec.version),
                    sync_event_id=sync_event.id,
                    **item_data,
                )
                self.db.add(item)

            # Insert readiness snapshot
            readiness = ReadinessScoreSnapshot(
                user_id=user_id,
                spec_version=str(self.spec.version),
                sync_event_id=sync_event.id,
                overall_score=readiness_snapshot["overall_score"],
                status=readiness_snapshot["status"],
                component_scores=json.dumps(readiness_snapshot["component_scores"]),
                gaps_identified=json.dumps(readiness_snapshot.get("gaps_identified", [])),
            )
            self.db.add(readiness)

            # Update or create ProfileSyncState for optimistic locking
            sync_state_stmt = select(ProfileSyncState).where(ProfileSyncState.user_id == user_id)
            sync_state = await self.db.scalar(sync_state_stmt)
            if sync_state:
                sync_state.sync_version += 1
                sync_state.last_synced_at = datetime.utcnow()
                sync_state.last_spec_version = str(self.spec.version)
            else:
                sync_state = ProfileSyncState(
                    user_id=user_id,
                    sync_version=1,
                    last_synced_at=datetime.utcnow(),
                    last_spec_version=str(self.spec.version),
                )
                self.db.add(sync_state)

            await self.db.commit()
            logger.info(f"Persisted sync results for user {user_id}")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to persist sync results: {e}", exc_info=True)
            raise

    async def _record_sync_event(
        self,
        user_id: int,
        trigger_type: str,
        changed_fields: dict[str, Any],
        outcome: str,
        validation_errors: list[str] | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Record a sync event to the audit log."""
        trigger = trigger_type.split(".")[1] if "." in trigger_type else trigger_type

        event = SpecSyncEvent(
            user_id=user_id,
            trigger_type=trigger,
            changed_fields=json.dumps(changed_fields) if changed_fields else None,
            spec_version=str(self.spec.version),
            outcome=outcome,
            validation_errors=json.dumps(validation_errors or []),
            duration_ms=duration_ms,
        )
        self.db.add(event)
        await self.db.commit()

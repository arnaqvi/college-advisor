"""Structured configuration derived from collegepath-master-prompt-spec.md.

This module converts the markdown spec into runtime-accessible, versioned config.
The markdown file is the human-readable source of truth; this file is the
machine-readable, typed representation used by the sync engine.

Updated whenever collegepath-master-prompt-spec.md changes — keep this in sync
with the spec's Section 3 (Module Logic) and Section 4 (Output Contract).
"""

from datetime import datetime
from enum import Enum
from typing import TypeAlias

from pydantic import BaseModel, Field


class SpecVersion(BaseModel):
    """Version identifier for this spec config."""

    major: int = 1
    minor: int = 0
    patch: int = 0
    updated_at: datetime
    md_file_sha256: str = Field(
        description="SHA256 hash of collegepath-master-prompt-spec.md at time of last update"
    )

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


class ProfileClassification(str, Enum):
    """Classification level for Reach/Target/Safety."""

    REACH = "reach"
    TARGET = "target"
    SAFETY = "safety"


class InstitutionType(str, Enum):
    """Public vs. Private institution type."""

    PUBLIC = "public"
    PRIVATE = "private"


class RoadmapItemType(str, Enum):
    """Types of roadmap milestones (Section 3.7 timeline categories)."""

    COURSEWORK = "coursework"
    TESTING = "testing"
    ESSAY = "essay"
    ACTIVITY = "activity"
    APPLICATION = "application"
    INTERVIEW = "interview"
    FINANCIAL_AID = "financial_aid"
    CAMPUS_VISIT = "campus_visit"
    RECOMMENDATION_REQUEST = "recommendation_request"


class TrackType(str, Enum):
    """Which track this roadmap item belongs to."""

    STUDENT = "student"
    PARENT = "parent"


class ReadinessScoreComponent(BaseModel):
    """One dimension of the readiness score calculation."""

    name: str
    weight: float = Field(
        ge=0.0, le=1.0, description="0.0 to 1.0, should sum to 1.0 across all components"
    )
    category: str = Field(
        description="e.g., 'academics', 'essays', 'activities', 'planning', 'milestones'"
    )


class RoadmapRequirements(BaseModel):
    """Roadmap generation rules indexed by grade level and timeline phase."""

    grade: int = Field(description="High school grade level (9–12)")
    phase: str = Field(
        description="one of: 'exploration', 'building', 'applying', 'deciding', 'enrolled'"
    )
    required_items: list[RoadmapItemType] = Field(
        description="Roadmap items that MUST be generated for this grade+phase combo"
    )
    recommended_items: list[RoadmapItemType] = Field(
        description="Optional items recommended for this grade+phase combo"
    )
    milestone_example: str = Field(description="Human-readable example milestone text for docs")


class ValidationRule(BaseModel):
    """Profile validation rules (e.g., required fields before roadmap can be generated)."""

    field: str = Field(description="e.g., 'graduation_year', 'academic_record', 'intended_major'")
    required_before_phase: str = Field(
        description="e.g., 'roadmap_generation' — this field must be filled to proceed"
    )
    error_message: str


class SpecConfig(BaseModel):
    """The parsed, typed configuration from collegepath-master-prompt-spec.md."""

    version: SpecVersion
    # Readiness scoring
    readiness_components: list[ReadinessScoreComponent] = Field(
        description="All dimensions that feed into the ReadinessScore, with weights"
    )
    readiness_thresholds: dict[str, float] = Field(
        description="e.g., {'on_track': 0.75, 'at_risk': 0.5, 'behind': 0.0}"
    )
    # Roadmap generation
    roadmap_rules_by_grade_phase: list[RoadmapRequirements]
    # Profile validation
    validation_rules: list[ValidationRule]
    # Classification thresholds (Section 3.1)
    reach_target_safety_rules: dict[str, str] = Field(
        description="Human-readable prose rules for classifying colleges (mapped to backend logic)"
    )
    # Family plan
    family_plan_max_students: int = 3
    # Coverage requirements (Section 3.3)
    coverage_rules: dict[str, str] = Field(
        description="e.g., ensure Ivy League coverage, Canadian expansion rules"
    )
    # Edge case handling
    concurrent_update_strategy: str = Field(
        default="last_write_wins",
        description="How to handle profile edits while a sync is in flight: 'last_write_wins' or 'optimistic_lock'",
    )
    spec_version_migration: str = Field(
        default="flag_for_review",
        description="When a profile was generated under an older spec, 'auto_migrate' or 'flag_for_review'",
    )


def get_current_spec_config() -> SpecConfig:
    """Load the current spec configuration.

    In production, this would load from a database-backed rule table or a
    JSON file versioned in the repo. For now, it returns a hardcoded v1.0
    config that matches collegepath-master-prompt-spec.md at SHA256 TBD.
    """
    return SpecConfig(
        version=SpecVersion(
            major=1,
            minor=0,
            patch=0,
            updated_at=datetime.utcnow(),
            md_file_sha256="placeholder-sha256",
        ),
        readiness_components=[
            ReadinessScoreComponent(
                name="Academic Rigor",
                weight=0.25,
                category="academics",
            ),
            ReadinessScoreComponent(
                name="Test Preparation",
                weight=0.20,
                category="academics",
            ),
            ReadinessScoreComponent(
                name="Essays In Progress",
                weight=0.20,
                category="essays",
            ),
            ReadinessScoreComponent(
                name="Extracurricular Depth",
                weight=0.15,
                category="activities",
            ),
            ReadinessScoreComponent(
                name="Application Timeline",
                weight=0.10,
                category="milestones",
            ),
            ReadinessScoreComponent(
                name="Recommendations Ready",
                weight=0.10,
                category="milestones",
            ),
        ],
        readiness_thresholds={
            "on_track": 0.75,
            "at_risk": 0.50,
            "behind": 0.0,
        },
        roadmap_rules_by_grade_phase=[
            RoadmapRequirements(
                grade=9,
                phase="exploration",
                required_items=[RoadmapItemType.COURSEWORK],
                recommended_items=[
                    RoadmapItemType.ACTIVITY,
                    RoadmapItemType.CAMPUS_VISIT,
                ],
                milestone_example="Sep: Enroll in rigorous 9th-grade courses (honors if available)",
            ),
            RoadmapRequirements(
                grade=10,
                phase="building",
                required_items=[RoadmapItemType.COURSEWORK, RoadmapItemType.ACTIVITY],
                recommended_items=[
                    RoadmapItemType.TESTING,
                    RoadmapItemType.CAMPUS_VISIT,
                ],
                milestone_example="Jun: Take PSAT; identify leadership opportunity for 11th grade",
            ),
            RoadmapRequirements(
                grade=11,
                phase="building",
                required_items=[
                    RoadmapItemType.COURSEWORK,
                    RoadmapItemType.TESTING,
                    RoadmapItemType.ACTIVITY,
                ],
                recommended_items=[
                    RoadmapItemType.ESSAY,
                    RoadmapItemType.CAMPUS_VISIT,
                ],
                milestone_example="Aug: Take SAT/ACT; Sep: Submit fall application deadlines",
            ),
            RoadmapRequirements(
                grade=12,
                phase="applying",
                required_items=[
                    RoadmapItemType.APPLICATION,
                    RoadmapItemType.ESSAY,
                    RoadmapItemType.RECOMMENDATION_REQUEST,
                ],
                recommended_items=[
                    RoadmapItemType.INTERVIEW,
                    RoadmapItemType.FINANCIAL_AID,
                ],
                milestone_example="Nov: Early Decision/Action deadline; Dec: Regular Decision deadline",
            ),
        ],
        validation_rules=[
            ValidationRule(
                field="graduation_year",
                required_before_phase="roadmap_generation",
                error_message="Graduation year is required to generate your timeline",
            ),
            ValidationRule(
                field="academic_record",
                required_before_phase="readiness_scoring",
                error_message="Add at least one course or GPA to assess academic readiness",
            ),
            ValidationRule(
                field="intended_major",
                required_before_phase="program_alignment",
                error_message="Tell us your intended major(s) so we can align college programs",
            ),
        ],
        reach_target_safety_rules={
            "reach": "Stats below college's 25th percentile OR admit rate <15% OR highly competitive program",
            "target": "Stats within 25th–75th percentile band for that program",
            "safety": "Stats above 75th percentile AND admit rate >50%",
        },
        family_plan_max_students=3,
        coverage_rules={
            "include_ivy_league": "All 8 Ivy League institutions included by default in US database",
            "expand_canada": "Include U15 Canadian research universities and specialized schools beyond just U of T/UBC/McGill",
            "state_coverage": "Ensure at least 1–3 top-ranked colleges per state/province represented in recommendations",
        },
        concurrent_update_strategy="last_write_wins",
        spec_version_migration="flag_for_review",
    )

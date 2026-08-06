"""Pydantic v2 request/response models for the onboarding API.

Mirrors `docs/onboarding-flow-design.md` §4 (schema) and §8 (validation
rules) 1:1, and is meant to mirror the frontend's
`frontend/.../types/onboarding.ts` the same way. Every validator referenced
in the design doc lives here.
"""

import json
import re
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Standard email regex (doc §8: "Standard email regex" — not pydantic's
# EmailStr, to avoid adding the `email-validator` dependency for a format
# check only).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_GPA_SCALES: dict[str, float] = {"4.0": 4.0, "4.5": 4.5, "5.0": 5.0}


def _validate_email(value: str | None) -> str | None:
    if value is not None and not _EMAIL_RE.match(value):
        raise ValueError("must be a valid email address")
    return value


def _validate_url(value: str | None) -> str | None:
    """Valid URL scheme if provided (doc §8) — format only, never fetched."""
    if value is not None and not re.match(r"^https?://", value, re.IGNORECASE):
        raise ValueError("must be a valid http(s) URL")
    return value


def _parse_json_list(value: Any) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return list(parsed) if isinstance(parsed, list) else []
    return list(value)


# --------------------------------------------------------------------------
# Onboarding progress
# --------------------------------------------------------------------------


class OnboardingProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    current_step: str
    completed_steps: list[str]
    last_active_at: datetime
    streak_days: int

    @field_validator("completed_steps", mode="before")
    @classmethod
    def parse_completed_steps(cls, v: Any) -> list[str]:
        return _parse_json_list(v) or []


class OnboardingProgressUpdate(BaseModel):
    current_step: str = Field(min_length=1, max_length=50)


# --------------------------------------------------------------------------
# Academic record (one-per-user upsert)
# --------------------------------------------------------------------------


class AcademicRecordIn(BaseModel):
    high_school_name: str = Field(min_length=1, max_length=255)
    graduation_year: int
    gpa: float | None = None
    gpa_scale: Literal["4.0", "4.5", "5.0"] = "4.0"
    class_rank: str | None = None
    rigor_courses: list[str] | None = None

    @field_validator("graduation_year")
    @classmethod
    def graduation_year_in_range(cls, v: int) -> int:
        current_year = date.today().year
        if not (current_year <= v <= current_year + 6):
            raise ValueError(f"graduation_year must be between {current_year} and {current_year + 6}")
        return v

    @model_validator(mode="after")
    def gpa_within_scale(self) -> "AcademicRecordIn":
        if self.gpa is not None:
            scale = _GPA_SCALES[self.gpa_scale]
            if not (0 <= self.gpa <= scale):
                raise ValueError(f"gpa must be between 0 and {scale} for scale {self.gpa_scale}")
        return self


class AcademicRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    high_school_name: str
    graduation_year: int
    gpa: float | None
    gpa_scale: str
    class_rank: str | None
    rigor_courses: list[str] | None

    @field_validator("rigor_courses", mode="before")
    @classmethod
    def parse_rigor_courses(cls, v: Any) -> list[str] | None:
        return _parse_json_list(v)


# --------------------------------------------------------------------------
# Test scores
# --------------------------------------------------------------------------


class TestScoreIn(BaseModel):
    test_type: Literal["sat", "act", "psat"]
    test_date: date | None = None
    reading_score: int | None = None
    writing_score: int | None = None
    math_score: int | None = None
    total_score: int | None = None

    @field_validator("test_date")
    @classmethod
    def not_in_future(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("test_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def score_ranges(self) -> "TestScoreIn":
        _validate_test_scores(
            self.test_type,
            self.reading_score,
            self.writing_score,
            self.math_score,
            self.total_score,
        )
        return self


class TestScoreUpdate(BaseModel):
    """Partial update — PATCH /api/onboarding/test-scores/{id}."""

    test_type: Literal["sat", "act", "psat"] | None = None
    test_date: date | None = None
    reading_score: int | None = None
    writing_score: int | None = None
    math_score: int | None = None
    total_score: int | None = None

    @field_validator("test_date")
    @classmethod
    def not_in_future(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("test_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def score_ranges(self) -> "TestScoreUpdate":
        # Only cross-validated when the whole set is present in this PATCH —
        # a partial patch (e.g. just `test_date`) can't fully re-derive the
        # persisted row's test_type here, so range checks apply best-effort.
        if self.test_type is not None:
            _validate_test_scores(
                self.test_type,
                self.reading_score,
                self.writing_score,
                self.math_score,
                self.total_score,
            )
        return self


def _validate_test_scores(
    test_type: str,
    reading_score: int | None,
    writing_score: int | None,
    math_score: int | None,
    total_score: int | None,
) -> None:
    if test_type == "sat":
        if total_score is not None and not (400 <= total_score <= 1600):
            raise ValueError("SAT total_score must be between 400 and 1600")
        for name, value in (("reading_score", reading_score), ("math_score", math_score)):
            if value is not None and not (200 <= value <= 800):
                raise ValueError(f"SAT {name} must be between 200 and 800")
        if (
            reading_score is not None
            and math_score is not None
            and total_score is not None
            and reading_score + math_score != total_score
        ):
            raise ValueError("SAT section scores must sum exactly to total_score")
    elif test_type == "act":
        for name, value in (
            ("total_score", total_score),
            ("reading_score", reading_score),
            ("writing_score", writing_score),
            ("math_score", math_score),
        ):
            if value is not None and not (1 <= value <= 36):
                raise ValueError(f"ACT {name} must be between 1 and 36")


class TestScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    test_type: str
    test_date: date | None
    reading_score: int | None
    writing_score: int | None
    math_score: int | None
    total_score: int | None
    source: str


# --------------------------------------------------------------------------
# Volunteer experiences
# --------------------------------------------------------------------------


class VolunteerExperienceIn(BaseModel):
    organization: str = Field(min_length=1, max_length=255)
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    hours: int | None = Field(default=None, ge=0)
    description: str | None = None
    skills_learned: str | None = None
    reflection: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date | None, info: Any) -> date | None:
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v

    # Note (§8): hours > 2000 is a soft-cap "typo" warning, not a hard block —
    # intentionally not raised here. Surfacing it is a UI concern; this
    # validator only enforces the hard rule (non-negative, via Field(ge=0)).


class VolunteerExperienceUpdate(BaseModel):
    organization: str | None = None
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    hours: int | None = Field(default=None, ge=0)
    description: str | None = None
    skills_learned: str | None = None
    reflection: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date | None, info: Any) -> date | None:
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


class VolunteerExperienceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    organization: str
    role: str | None
    start_date: date | None
    end_date: date | None
    hours: int | None
    description: str | None
    skills_learned: str | None
    reflection: str | None


# --------------------------------------------------------------------------
# Internships
# --------------------------------------------------------------------------


class InternshipIn(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    supervisor_name: str | None = None
    responsibilities: str | None = None
    skills: str | None = None
    achievements: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date | None, info: Any) -> date | None:
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


class InternshipUpdate(BaseModel):
    company: str | None = None
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    supervisor_name: str | None = None
    responsibilities: str | None = None
    skills: str | None = None
    achievements: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date | None, info: Any) -> date | None:
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


class InternshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    company: str
    role: str | None
    start_date: date | None
    end_date: date | None
    supervisor_name: str | None
    responsibilities: str | None
    skills: str | None
    achievements: str | None


# --------------------------------------------------------------------------
# Personal projects
# --------------------------------------------------------------------------


class PersonalProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    technologies: str | None = None
    github_url: str | None = None
    website_url: str | None = None
    video_url: str | None = None

    @field_validator("github_url", "website_url", "video_url")
    @classmethod
    def validate_urls(cls, v: str | None) -> str | None:
        return _validate_url(v)


class PersonalProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    technologies: str | None = None
    github_url: str | None = None
    website_url: str | None = None
    video_url: str | None = None

    @field_validator("github_url", "website_url", "video_url")
    @classmethod
    def validate_urls(cls, v: str | None) -> str | None:
        return _validate_url(v)


class PersonalProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    description: str | None
    technologies: str | None
    github_url: str | None
    website_url: str | None
    video_url: str | None


# --------------------------------------------------------------------------
# Awards
# --------------------------------------------------------------------------

AwardLevel = Literal["school", "district", "state", "national", "international"]


class AwardIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    organization: str | None = None
    award_date: date | None = None
    level: AwardLevel
    description: str | None = None


class AwardUpdate(BaseModel):
    name: str | None = None
    organization: str | None = None
    award_date: date | None = None
    level: AwardLevel | None = None
    description: str | None = None


class AwardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    organization: str | None
    award_date: date | None
    level: str
    description: str | None


# --------------------------------------------------------------------------
# Recommendations
# --------------------------------------------------------------------------

RecommenderRelationship = Literal["teacher", "coach", "counselor", "mentor", "professor"]
RecommendationStatus = Literal["not_requested", "requested", "received"]


class RecommendationIn(BaseModel):
    recommender_name: str = Field(min_length=1, max_length=255)
    position: str | None = None
    school_or_org: str | None = None
    email: str | None = None
    phone: str | None = None
    relationship: RecommenderRelationship
    status: RecommendationStatus = "not_requested"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        return _validate_email(v)


class RecommendationUpdate(BaseModel):
    recommender_name: str | None = None
    position: str | None = None
    school_or_org: str | None = None
    email: str | None = None
    phone: str | None = None
    relationship: RecommenderRelationship | None = None
    status: RecommendationStatus | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        return _validate_email(v)


class RecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    recommender_name: str
    position: str | None
    school_or_org: str | None
    email: str | None
    phone: str | None
    relationship: str
    status: str


# --------------------------------------------------------------------------
# Certifications
# --------------------------------------------------------------------------


class CertificationIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    provider: str = Field(min_length=1, max_length=100)
    completion_date: date | None = None
    expiration_date: date | None = None
    credential_id: str | None = None
    credential_url: str | None = None

    @field_validator("credential_url")
    @classmethod
    def validate_credential_url(cls, v: str | None) -> str | None:
        return _validate_url(v)


class CertificationUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    completion_date: date | None = None
    expiration_date: date | None = None
    credential_id: str | None = None
    credential_url: str | None = None

    @field_validator("credential_url")
    @classmethod
    def validate_credential_url(cls, v: str | None) -> str | None:
        return _validate_url(v)


class CertificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    provider: str
    completion_date: date | None
    expiration_date: date | None
    credential_id: str | None
    credential_url: str | None


# --------------------------------------------------------------------------
# Files (§6)
# --------------------------------------------------------------------------

ALLOWED_UPLOAD_CONTENT_TYPES = frozenset(
    {"application/pdf", "image/jpeg", "image/png", "image/heic"}
)
MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024  # 15MB, doc §6


class FileCreateIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    size_bytes: int = Field(gt=0)
    owner_type: str = Field(min_length=1, max_length=30)
    owner_id: int | None = None

    @field_validator("content_type")
    @classmethod
    def content_type_allowed(cls, v: str) -> str:
        if v not in ALLOWED_UPLOAD_CONTENT_TYPES:
            allowed = ", ".join(sorted(ALLOWED_UPLOAD_CONTENT_TYPES))
            raise ValueError(f"content_type must be one of: {allowed}")
        return v

    @field_validator("size_bytes")
    @classmethod
    def size_within_cap(cls, v: int) -> int:
        if v > MAX_UPLOAD_SIZE_BYTES:
            raise ValueError(f"size_bytes exceeds the {MAX_UPLOAD_SIZE_BYTES} byte (15MB) cap")
        return v


class FileCreateOut(BaseModel):
    """Response to POST /api/onboarding/files — the "presigned upload" flow."""

    id: int
    storage_key: str
    upload_url: str
    upload_method: Literal["PUT"] = "PUT"
    status: str


class FileCompleteIn(BaseModel):
    """PATCH /api/onboarding/files/{id} body (§6 step 4)."""

    status: Literal["complete"]


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    owner_type: str
    owner_id: int | None
    file_name: str
    content_type: str
    size_bytes: int
    storage_key: str
    status: str
    uploaded_at: datetime


# --------------------------------------------------------------------------
# External connections (§9)
# --------------------------------------------------------------------------


class ExternalConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    provider: str
    status: str
    connected_at: datetime | None
    # access_token_encrypted intentionally omitted — never serialized out.


# --------------------------------------------------------------------------
# Completion summary (§1)
# --------------------------------------------------------------------------


class SectionCompletion(BaseModel):
    basic_info: float
    academic: float
    tests: float
    volunteer: float
    internships_projects: float
    awards: float
    recommendations: float
    certifications: float


class RecommendationStatusSummary(BaseModel):
    not_requested: int
    requested: int
    received: int


class CompletionSummaryOut(BaseModel):
    profile_completion_pct: float
    section_completion: SectionCompletion
    academic_strength: float
    volunteer_impact_hours: int
    volunteer_impact_org_count: int
    leadership_score: float
    project_portfolio_count: int
    project_portfolio_external_link_ratio: float
    recommendation_status: RecommendationStatusSummary
    certification_count: int
    certification_provider_diversity: int
    college_readiness_score: float

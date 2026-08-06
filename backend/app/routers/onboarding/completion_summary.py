"""GET /api/onboarding/completion-summary — derived scores, computed
server-side so the scoring logic has one implementation (§1, §5).

The design doc fixes the eight section *weights* (§1) but doesn't spell out
the per-section 0-100% formula, nor the exact sub-meter math — those are
implementation choices made here, called out inline. If product wants a
different curve (e.g. graded-by-count instead of presence/absence), this is
the one place to change it.
"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.onboarding import (
    AcademicRecord,
    Award,
    Certification,
    Internship,
    PersonalProject,
    Recommendation,
    TestScore,
    VolunteerExperience,
)
from app.models.user import User
from app.schemas.onboarding import CompletionSummaryOut, RecommendationStatusSummary, SectionCompletion

router = APIRouter()

# §1 weights — must sum to 100.
_WEIGHTS = {
    "basic_info": 15.0,
    "academic": 20.0,
    "tests": 15.0,
    "volunteer": 10.0,
    "internships_projects": 15.0,
    "awards": 10.0,
    "recommendations": 10.0,
    "certifications": 5.0,
}

_LEADERSHIP_KEYWORDS = (
    "president",
    "captain",
    "founder",
    "lead",
    "chief",
    "director",
    "chair",
    "officer",
)


@router.get("", response_model=CompletionSummaryOut)
async def get_completion_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CompletionSummaryOut:
    user_id = current_user.id

    academic_record = (
        await db.execute(select(AcademicRecord).where(AcademicRecord.user_id == user_id))
    ).scalar_one_or_none()
    test_scores = list(
        (await db.execute(select(TestScore).where(TestScore.user_id == user_id))).scalars().all()
    )
    volunteer_experiences = list(
        (
            await db.execute(
                select(VolunteerExperience).where(VolunteerExperience.user_id == user_id)
            )
        )
        .scalars()
        .all()
    )
    internships = list(
        (await db.execute(select(Internship).where(Internship.user_id == user_id))).scalars().all()
    )
    projects = list(
        (
            await db.execute(select(PersonalProject).where(PersonalProject.user_id == user_id))
        )
        .scalars()
        .all()
    )
    awards = list(
        (await db.execute(select(Award).where(Award.user_id == user_id))).scalars().all()
    )
    recommendations = list(
        (
            await db.execute(select(Recommendation).where(Recommendation.user_id == user_id))
        )
        .scalars()
        .all()
    )
    certifications = list(
        (
            await db.execute(select(Certification).where(Certification.user_id == user_id))
        )
        .scalars()
        .all()
    )

    section = _compute_section_completion(
        academic_record, test_scores, volunteer_experiences, internships, projects, awards,
        recommendations, certifications,
    )
    profile_completion_pct = sum(
        getattr(section, key) * weight / 100.0 for key, weight in _WEIGHTS.items()
    )

    academic_strength = _academic_strength(academic_record)
    volunteer_hours, volunteer_org_count = _volunteer_impact(volunteer_experiences)
    leadership_score = _leadership_score(volunteer_experiences, internships, projects)
    project_count, project_link_ratio = _project_portfolio(projects)
    recommendation_status = _recommendation_status(recommendations)
    certification_count = len(certifications)
    certification_provider_diversity = len({c.provider for c in certifications})

    college_readiness_score = _college_readiness_score(
        profile_completion_pct=profile_completion_pct,
        academic_strength=academic_strength,
        leadership_score=leadership_score,
        volunteer_hours=volunteer_hours,
        project_count=project_count,
        recommendation_status=recommendation_status,
        certification_count=certification_count,
    )

    return CompletionSummaryOut(
        profile_completion_pct=round(profile_completion_pct, 1),
        section_completion=section,
        academic_strength=round(academic_strength, 1),
        volunteer_impact_hours=volunteer_hours,
        volunteer_impact_org_count=volunteer_org_count,
        leadership_score=round(leadership_score, 1),
        project_portfolio_count=project_count,
        project_portfolio_external_link_ratio=round(project_link_ratio, 2),
        recommendation_status=recommendation_status,
        certification_count=certification_count,
        certification_provider_diversity=certification_provider_diversity,
        college_readiness_score=round(college_readiness_score, 1),
    )


def _compute_section_completion(
    academic_record: AcademicRecord | None,
    test_scores: list[TestScore],
    volunteer_experiences: list[VolunteerExperience],
    internships: list[Internship],
    projects: list[PersonalProject],
    awards: list[Award],
    recommendations: list[Recommendation],
    certifications: list[Certification],
) -> SectionCompletion:
    # Basic Info: graduation_year is the one true blocker field (§1/§8) and
    # lives on `academic_records` (no dedicated Basic Info table in §4) — its
    # presence is used as the Basic Info completion signal.
    basic_info = 100.0 if academic_record is not None else 0.0

    # Academic: required fields (high_school_name, graduation_year) are a
    # 50% baseline once the record exists; the two optional fields (gpa,
    # class_rank) split the remaining 50%.
    if academic_record is None:
        academic = 0.0
    else:
        optional_filled = sum(
            (academic_record.gpa is not None, academic_record.class_rank is not None)
        )
        academic = 50.0 + 25.0 * optional_filled

    # Everything else: presence-based (any entry -> 100%) — every field is
    # optional at the DB level (§1), so "has at least started this section"
    # is the completion signal rather than a fixed target count.
    tests = 100.0 if test_scores else 0.0
    volunteer = 100.0 if volunteer_experiences else 0.0
    internships_projects = 100.0 if (internships or projects) else 0.0
    awards_pct = 100.0 if awards else 0.0
    recommendations_pct = 100.0 if recommendations else 0.0
    certifications_pct = 100.0 if certifications else 0.0

    return SectionCompletion(
        basic_info=basic_info,
        academic=academic,
        tests=tests,
        volunteer=volunteer,
        internships_projects=internships_projects,
        awards=awards_pct,
        recommendations=recommendations_pct,
        certifications=certifications_pct,
    )


def _academic_strength(academic_record: AcademicRecord | None) -> float:
    if academic_record is None:
        return 0.0
    gpa_component = 0.0
    if academic_record.gpa is not None:
        scale = float(academic_record.gpa_scale) if academic_record.gpa_scale else 4.0
        gpa_component = (float(academic_record.gpa) / scale) * 100.0 if scale else 0.0
    rigor_courses: list[str] = []
    if academic_record.rigor_courses:
        try:
            rigor_courses = json.loads(academic_record.rigor_courses)
        except json.JSONDecodeError:
            rigor_courses = []
    rigor_component = min(20.0, len(rigor_courses) * 5.0)
    return min(100.0, gpa_component * 0.8 + rigor_component)


def _volunteer_impact(volunteer_experiences: list[VolunteerExperience]) -> tuple[int, int]:
    total_hours = sum(v.hours or 0 for v in volunteer_experiences)
    org_count = len({v.organization for v in volunteer_experiences})
    return total_hours, org_count


def _leadership_score(
    volunteer_experiences: list[VolunteerExperience],
    internships: list[Internship],
    projects: list[PersonalProject],
) -> float:
    """v1 keyword heuristic (§1: "v2 candidate for an LLM classifier")."""
    texts: list[str] = []
    texts.extend(v.role or "" for v in volunteer_experiences)
    texts.extend(i.role or "" for i in internships)
    texts.extend(p.name or "" for p in projects)
    texts.extend(p.description or "" for p in projects)

    matches = sum(
        1 for text in texts if text and any(keyword in text.lower() for keyword in _LEADERSHIP_KEYWORDS)
    )
    return min(100.0, matches * 25.0)


def _project_portfolio(projects: list[PersonalProject]) -> tuple[int, float]:
    count = len(projects)
    if count == 0:
        return 0, 0.0
    with_link = sum(1 for p in projects if p.github_url or p.website_url or p.video_url)
    return count, with_link / count


def _recommendation_status(recommendations: list[Recommendation]) -> RecommendationStatusSummary:
    return RecommendationStatusSummary(
        not_requested=sum(1 for r in recommendations if r.status == "not_requested"),
        requested=sum(1 for r in recommendations if r.status == "requested"),
        received=sum(1 for r in recommendations if r.status == "received"),
    )


def _college_readiness_score(
    *,
    profile_completion_pct: float,
    academic_strength: float,
    leadership_score: float,
    volunteer_hours: int,
    project_count: int,
    recommendation_status: RecommendationStatusSummary,
    certification_count: int,
) -> float:
    """Single weighted composite, 0-100 (§1).

    Weights here are our own reasonable choice — the doc names the inputs
    ("single weighted composite of the above") without fixing coefficients.
    """
    volunteer_norm = min(100.0, (volunteer_hours / 50.0) * 100.0)
    project_norm = min(100.0, (project_count / 3.0) * 100.0)
    recommendation_norm = 100.0 if recommendation_status.received else (
        50.0 if recommendation_status.requested else 0.0
    )
    certification_norm = min(100.0, (certification_count / 2.0) * 100.0)

    return (
        profile_completion_pct * 0.30
        + academic_strength * 0.25
        + leadership_score * 0.15
        + volunteer_norm * 0.10
        + project_norm * 0.10
        + recommendation_norm * 0.05
        + certification_norm * 0.05
    )

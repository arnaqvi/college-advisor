"""`/api/colleges` — the real backend replacement for the frontend's old
`frontend/src/data/colleges.js` static fixture.

`GET /api/colleges` is unauthenticated/public read (no `X-User-Email`
dependency) — the directory itself isn't user-specific data, matching how
the static fixture was previously bundled into the public frontend build.
`POST /api/colleges/sync` (admin/manual trigger for the College Scorecard
ETL) is gated behind the same temporary dev-auth dependency the rest of the
backend uses (see app/core/auth.py) purely for consistency with the rest of
this codebase — it is not real authorization, same caveat as everywhere else
`get_current_user` is used.
"""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.college import College, DeadlineOverride, Program
from app.models.user import User
from app.schemas.college import DeadlineOverrideIn, DeadlineOverrideOut, GemProfile, GpaBand, ProgramOut, ScoreBand

router = APIRouter(prefix="/api/colleges", tags=["Colleges"])


def _json_or_none(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    parsed: dict[str, Any] = json.loads(raw)
    return parsed


def _json_list_or_none(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    parsed: list[str] = json.loads(raw)
    return parsed


def serialize_program(program: Program, college: College) -> ProgramOut:
    """Build one API row from a `Program` + its parent `College`.

    Program-level `admit_rate`/`sat_band`/`act_band` win when set (manual
    curation is more specific than a university-wide Scorecard figure);
    otherwise fall back to the college's synced university-wide value. See
    app/models/college.py's module docstring — `gpa_band` has no such
    fallback because it is Program-only and manual-only by design.
    """
    admit_rate = program.admit_rate if program.admit_rate is not None else college.admit_rate_overall
    sat_band_raw = _json_or_none(program.sat_band) or _json_or_none(college.sat_band)
    act_band_raw = _json_or_none(program.act_band) or _json_or_none(college.act_band)
    gpa_band_raw = _json_or_none(program.gpa_band)
    recommended_courses_raw = _json_list_or_none(program.recommended_courses)
    gem_profile_raw = _json_or_none(program.gem_profile)
    deadlines_raw = _json_or_none(college.deadlines)

    location = None
    if college.city and college.state:
        location = f"{college.city}, {college.state}"
    elif college.city:
        location = college.city

    return ProgramOut(
        id=program.slug,
        name=college.name,
        state=college.state,
        location=location,
        type=college.type,
        size=college.size,
        setting=college.setting,
        country=college.country,
        dept=program.dept,
        category=program.category,
        ranking=program.ranking,
        admit_rate=admit_rate,
        college_admit_rate_overall=college.admit_rate_overall,
        gpa_band=GpaBand.model_validate(gpa_band_raw) if gpa_band_raw else None,
        sat_band=ScoreBand.model_validate(sat_band_raw) if sat_band_raw else None,
        act_band=ScoreBand.model_validate(act_band_raw) if act_band_raw else None,
        recommended_courses=list(recommended_courses_raw) if recommended_courses_raw else [],
        gem_profile=GemProfile.model_validate(gem_profile_raw) if gem_profile_raw else None,
        application_platform=college.application_platform,
        deadlines=deadlines_raw,
        tuition_in_state=college.tuition_in_state,
        tuition_out_of_state=college.tuition_out_of_state,
        tuition_international=college.tuition_international,
        data_source=program.data_source,
        last_synced_at=college.last_synced_at.isoformat() if college.last_synced_at else None,
    )


@router.get("", response_model=list[ProgramOut])
async def list_colleges(
    db: Annotated[AsyncSession, Depends(get_db)],
    state: str | None = Query(default=None, description="Filter by 2-letter state/province code"),
    category: str | None = Query(default=None, description="Filter by program category"),
    dept: str | None = Query(default=None, description="Filter by department/major"),
    q: str | None = Query(default=None, description="Case-insensitive search over college name"),
) -> list[ProgramOut]:
    """List every tracked program-at-a-university row.

    No pagination yet — coverage is currently O(dozens) of rows (spec 3.9's
    "comprehensive coverage" goal is aspirational future work, see this
    session's report), so a single unpaginated list is still reasonable.
    Revisit once the catalog grows into the hundreds.
    """
    stmt = select(Program).options(selectinload(Program.college)).join(College)
    if state:
        stmt = stmt.where(College.state == state.upper())
    if category:
        stmt = stmt.where(Program.category == category)
    if dept:
        stmt = stmt.where(Program.dept == dept)
    if q:
        stmt = stmt.where(College.name.ilike(f"%{q}%"))

    result = await db.execute(stmt)
    programs = result.scalars().all()
    return [serialize_program(p, p.college) for p in programs]


@router.post("/sync")
async def trigger_scorecard_sync(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    """Manually trigger the College Scorecard sync job (US schools only —
    see app/services/scorecard_sync.py's module docstring).

    Returns a 4xx-shaped error payload (not a raised HTTPException) when
    `COLLEGE_SCORECARD_API_KEY` isn't configured, so callers get a clear,
    structured reason rather than a generic 500.
    """
    from app.services.scorecard_sync import sync_from_scorecard

    return await sync_from_scorecard(db, requested_by=current_user.email)


@router.post("/import")
async def import_colleges(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    states: str | None = Query(
        default=None,
        description="Optional comma-separated 2-letter state codes to focus the import (e.g. 'CA,NY,TX'). Omit for a nationwide batch.",
    ),
    limit: int = Query(default=100, ge=1, le=500, description="Max new schools to discover+insert this run."),
) -> dict[str, Any]:
    """DISCOVER and INSERT new US colleges from College Scorecard — the path
    that makes the directory dynamic instead of a fixed hand-seed.

    Idempotent (skips schools already present) and honest (real Scorecard
    fields only, no fabricated GPA band). Returns a structured "not configured"
    payload when `COLLEGE_SCORECARD_API_KEY` isn't set rather than a 500.
    """
    from app.services.scorecard_sync import import_colleges_from_scorecard

    state_list = [s.strip() for s in states.split(",") if s.strip()] if states else None
    return await import_colleges_from_scorecard(
        db, states=state_list, limit=limit, requested_by=current_user.email
    )


@router.get("/deadline-overrides", response_model=list[DeadlineOverrideOut])
async def list_deadline_overrides(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DeadlineOverride]:
    """A student's own saved deadlines for programs with no verified, shared
    date yet — see app/models/college.py's `DeadlineOverride` docstring for
    why this is per-user rather than a write to `College.deadlines`."""
    result = await db.execute(select(DeadlineOverride).where(DeadlineOverride.user_id == current_user.id))
    return list(result.scalars().all())


@router.put("/deadline-overrides/{program_slug}", response_model=DeadlineOverrideOut)
async def set_deadline_override(
    program_slug: str,
    payload: DeadlineOverrideIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeadlineOverride:
    program_result = await db.execute(select(Program.id).where(Program.slug == program_slug))
    if program_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    result = await db.execute(
        select(DeadlineOverride).where(
            DeadlineOverride.user_id == current_user.id, DeadlineOverride.program_slug == program_slug
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        record = DeadlineOverride(user_id=current_user.id, program_slug=program_slug)
        db.add(record)
    for field, value in payload.model_dump().items():
        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/deadline-overrides/{program_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline_override(
    program_slug: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(DeadlineOverride).where(
            DeadlineOverride.user_id == current_user.id, DeadlineOverride.program_slug == program_slug
        )
    )
    record = result.scalar_one_or_none()
    if record is not None:
        await db.delete(record)
        await db.commit()

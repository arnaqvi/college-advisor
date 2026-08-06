"""Tests for /api/colleges and the College Scorecard field mapping.

Uses its own isolated in-memory SQLite engine (via FastAPI dependency
override) rather than the shared `app.core.database.engine` — keeps this
test file self-contained and independent of `tests/test_sync.py`'s existing,
separately-broken `db` fixture (missing conftest.py; out of scope here, see
this session's investigation report — that file belongs to the unrelated
profile-sync feature, not the college directory).

`test_map_scorecard_result_*` exercises `_map_scorecard_result` against a
*synthetic* Scorecard-shaped payload — this is the only verification this
session could do without a live `COLLEGE_SCORECARD_API_KEY` (none is
configured anywhere in this workspace). Treat these as "the field-mapping
logic behaves as coded", not "confirmed against real Scorecard data".
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.college import College, Program
from app.services.scorecard_sync import _map_scorecard_result


@pytest.fixture
async def test_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with session_maker() as session:
            yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.fixture
async def seeded_college(test_session: AsyncSession) -> Program:
    college = College(
        name="Stanford University",
        state="CA",
        city="Stanford",
        country="US",
        type="Private",
        size="Large",
        admit_rate_overall=0.04,
        data_source="seed",
    )
    test_session.add(college)
    await test_session.flush()

    program = Program(
        slug="stanford",
        college_id=college.id,
        dept="Computer Science",
        category="STEM",
        ranking=3,
        admit_rate=0.04,
        gpa_band=json.dumps({"p25": 3.9, "p75": 4.0, "scale": 4.0}),
        sat_band=json.dumps({"p25": 1500, "p75": 1580}),
        act_band=json.dumps({"p25": 34, "p75": 36}),
        recommended_courses=json.dumps(["AP Calculus BC"]),
        gem_profile=None,
        data_source="seed",
    )
    test_session.add(program)
    await test_session.commit()
    return program


@pytest.mark.asyncio
async def test_list_colleges_returns_seeded_row(seeded_college: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/colleges")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    row = body[0]
    # camelCase keys, matching the old static frontend/src/data/colleges.js shape.
    assert row["id"] == "stanford"
    assert row["name"] == "Stanford University"
    assert row["state"] == "CA"
    assert row["location"] == "Stanford, CA"
    assert row["dept"] == "Computer Science"
    assert row["admitRate"] == 0.04
    assert row["gpaBand"] == {"p25": 3.9, "p75": 4.0, "scale": 4.0, "weighted": None, "unweighted": None}
    assert row["satBand"] == {"p25": 1500, "p75": 1580}


@pytest.mark.asyncio
async def test_list_colleges_filters_by_state(seeded_college: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        match = await client.get("/api/colleges", params={"state": "CA"})
        no_match = await client.get("/api/colleges", params={"state": "TX"})

    assert len(match.json()) == 1
    assert no_match.json() == []


@pytest.mark.asyncio
async def test_program_level_override_wins_over_college_level(test_session: AsyncSession) -> None:
    """admit_rate/sat_band set on Program should win over the College's
    university-wide figure — see app/routers/colleges.py's serialize_program.
    """
    college = College(
        name="University of Texas at Austin",
        state="TX",
        city="Austin",
        country="US",
        type="Public",
        size="Large",
        admit_rate_overall=0.29,  # coarse, diluted university-wide figure
        data_source="scorecard",
    )
    test_session.add(college)
    await test_session.flush()

    cs = Program(
        slug="ut-austin-computer-science",
        college_id=college.id,
        dept="Computer Science",
        category="STEM",
        admit_rate=0.11,  # program-specific, more accurate
        gpa_band=json.dumps({"p25": 3.9, "p75": 4.0, "scale": 4.0}),
        data_source="seed",
    )
    test_session.add(cs)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/colleges")

    row = response.json()[0]
    assert row["admitRate"] == 0.11  # program override, not the 0.29 college-level figure


@pytest.mark.asyncio
async def test_sync_endpoint_reports_not_configured_without_api_key(seeded_college: Program) -> None:
    """Without COLLEGE_SCORECARD_API_KEY set, the sync endpoint must not
    attempt a network call — it should report a structured "not configured"
    response instead. This is the state of this workspace today; see this
    session's report.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/colleges/sync", headers={"X-User-Email": "test@college-advisor.app"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "not_configured"
    assert body["synced"] == 0


def test_map_scorecard_result_composes_sat_from_reading_and_math() -> None:
    """Scorecard splits SAT into 'critical_reading' (its legacy field name
    for the Evidence-Based Reading & Writing section) + 'math' sub-scores;
    composite SAT is their sum. See scorecard_sync.py's module docstring.
    """
    raw = {
        "id": 243744,
        "school.name": "Stanford University",
        "school.city": "Stanford",
        "school.state": "CA",
        "school.ownership": 2,
        "school.locale": 13,
        "latest.student.size": 7645,
        "latest.admissions.admission_rate.overall": 0.037,
        "latest.admissions.sat_scores.25th_percentile.critical_reading": 720,
        "latest.admissions.sat_scores.75th_percentile.critical_reading": 780,
        "latest.admissions.sat_scores.25th_percentile.math": 750,
        "latest.admissions.sat_scores.75th_percentile.math": 800,
        "latest.admissions.act_scores.25th_percentile.cumulative": 33,
        "latest.admissions.act_scores.75th_percentile.cumulative": 35,
        "latest.cost.tuition.in_state": 56169,
        "latest.cost.tuition.out_of_state": 56169,
    }

    mapped = _map_scorecard_result(raw)

    assert mapped["scorecard_unitid"] == "243744"
    assert mapped["name"] == "Stanford University"
    assert mapped["type"] == "Private"
    assert mapped["setting"] == "Urban"  # locale 13 -> first digit "1"
    assert mapped["size"] == "Medium"  # 7645 falls in the 3,000–15,000 bucket
    assert mapped["admit_rate_overall"] == 0.037
    assert mapped["sat_band"] == {"p25": 1470, "p75": 1580}
    assert mapped["act_band"] == {"p25": 33, "p75": 35}
    assert mapped["tuition_international"] == 56169  # documented proxy = out-of-state


def test_map_scorecard_result_handles_missing_fields_gracefully() -> None:
    """A school with a null/missing field (e.g. test-optional, no SAT data
    published for this cycle) must not crash the mapper or fabricate a band —
    same "don't fabricate" rule as spec 3.9.
    """
    raw = {
        "id": 999999,
        "school.name": "Example College",
        "school.ownership": 1,
        "latest.admissions.sat_scores.25th_percentile.critical_reading": None,
        "latest.admissions.sat_scores.75th_percentile.critical_reading": None,
        "latest.admissions.sat_scores.25th_percentile.math": None,
        "latest.admissions.sat_scores.75th_percentile.math": None,
    }

    mapped = _map_scorecard_result(raw)

    assert mapped["type"] == "Public"
    assert mapped["sat_band"] is None
    assert mapped["act_band"] is None

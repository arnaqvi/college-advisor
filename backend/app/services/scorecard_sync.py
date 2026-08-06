"""College Scorecard ETL — enriches `College` rows with real, sourced data.

**Not executed against the live API in this session** — `COLLEGE_SCORECARD_API_KEY`
is not configured anywhere in this workspace (checked env, `.env`, and the BFF;
none found). This module was written and unit-tested against a *synthetic*
Scorecard-shaped response (`tests/test_colleges.py`), not a real one. Before
relying on this in production: obtain a key from https://api.data.gov/signup/
(free, arrives in seconds, no approval wait), set
`COLLEGE_SCORECARD_API_KEY` in the backend's environment, run a sync, and spot
-check a handful of the resulting rows against Scorecard's own site
(https://collegescorecard.ed.gov) to confirm the field mapping below still
matches the live schema (Dept of Education APIs occasionally rename fields
between data releases).

## Scope: US schools only

College Scorecard is a US Department of Education dataset — it has no
Canadian (or any other non-US) institutions. Spec 3.9 explicitly wants
"expanded Canadian set beyond the big three" — that coverage **cannot** come
from this sync and must stay on manual curation indefinitely (or a different,
Canada-specific source decided later). `sync_from_scorecard()` only ever
touches `College` rows where `country == "US"`; it silently skips anything
else rather than trying and failing against an API that doesn't have the data.

## What this sync does / does not populate

Populates (per school, from Scorecard's `latest.*` fields): overall admit
rate, university-wide SAT/ACT 25th–75th percentile bands, in-state/
out-of-state tuition, enrollment-bucketed size, city, ownership (Public/
Private), and a best-effort urban/suburban/rural/town `setting` from
Scorecard's NCES locale code.

Does **not** populate: `Program.gpa_band` (see app/models/college.py's module
docstring — Scorecard doesn't publish GPA percentiles, so this field is
manual-only, forever), `Program.admit_rate`/`sat_band`/`act_band` (Scorecard
has no program-level breakdown — those stay manual overrides), tuition
-international (Scorecard doesn't distinguish it from out-of-state; see
`_map_scorecard_result` below for the documented proxy), `application_platform`,
`deadlines`, or `ranking` (none of these exist in the Scorecard dataset at all).

## Matching / upsert strategy

Matches an existing `College` row by `scorecard_unitid` if already synced
once, otherwise by case-insensitive exact name match against `school_names`
(the sync target list — defaults to every US college already in the DB, see
`_default_target_names`). Schools with no matching row are logged and
skipped, not auto-created — creating a bare `College` with zero `Program`
rows would sync fine but never appear in `GET /api/colleges` (which joins
from `Program`), so auto-creating rows here would silently produce dead,
unreachable data. Adding a genuinely new college needs at least one manually
-curated `Program` (with its `gpa_band`) first; this sync then enriches it.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.college import College, Program

logger = logging.getLogger(__name__)

# NCES locale codes -> coarse setting bucket. See
# https://nces.ed.gov/programs/edge/Geographic/LocaleBoundaries for the code
# reference — first digit is the 11/city, 21/suburban, 31/town, 41/rural
# grouping used here.
_LOCALE_BUCKETS: dict[str, str] = {
    "1": "Urban",
    "2": "Suburban",
    "3": "Town",
    "4": "Rural",
}


class ScorecardClient:
    """Thin async wrapper over the College Scorecard `/schools` endpoint."""

    def __init__(self, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url

    async def fetch_school(self, name: str) -> dict[str, Any] | None:
        """Look up one school by name. Returns the first (best) match, or
        None if Scorecard has no result for it.

        Fields requested via `fields=` match the mapping in
        `_map_scorecard_result` below — keep the two in sync.
        """
        fields = ",".join(
            [
                "id",
                "school.name",
                "school.city",
                "school.state",
                "school.ownership",
                "school.locale",
                "latest.student.size",
                "latest.admissions.admission_rate.overall",
                "latest.admissions.sat_scores.25th_percentile.critical_reading",
                "latest.admissions.sat_scores.75th_percentile.critical_reading",
                "latest.admissions.sat_scores.25th_percentile.math",
                "latest.admissions.sat_scores.75th_percentile.math",
                "latest.admissions.act_scores.25th_percentile.cumulative",
                "latest.admissions.act_scores.75th_percentile.cumulative",
                "latest.cost.tuition.in_state",
                "latest.cost.tuition.out_of_state",
            ]
        )
        params: dict[str, str | int] = {
            "api_key": self._api_key,
            "school.name": name,
            "fields": fields,
            "per_page": 1,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(self._base_url, params=params)
            response.raise_for_status()
            payload = response.json()
        results = payload.get("results") or []
        return results[0] if results else None

    async def discover_schools(
        self, states: list[str] | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Discover MANY schools for bulk import (vs. `fetch_school`'s one-by-one
        enrichment). Filters to currently-operating, predominantly-bachelor's
        US institutions and pages up to `limit` results.

        Returns the raw Scorecard result dicts (same shape `_map_scorecard_result`
        consumes) — the caller decides which are new and inserts them.
        """
        fields = ",".join(
            [
                "id",
                "school.name",
                "school.city",
                "school.state",
                "school.ownership",
                "school.locale",
                "latest.student.size",
                "latest.admissions.admission_rate.overall",
                "latest.admissions.sat_scores.25th_percentile.critical_reading",
                "latest.admissions.sat_scores.75th_percentile.critical_reading",
                "latest.admissions.sat_scores.25th_percentile.math",
                "latest.admissions.sat_scores.75th_percentile.math",
                "latest.admissions.act_scores.25th_percentile.cumulative",
                "latest.admissions.act_scores.75th_percentile.cumulative",
                "latest.cost.tuition.in_state",
                "latest.cost.tuition.out_of_state",
            ]
        )
        per_page = min(100, max(1, limit))
        base_params: dict[str, str | int] = {
            "api_key": self._api_key,
            "fields": fields,
            "per_page": per_page,
            # Currently operating, predominantly bachelor's-degree institutions —
            # the population a college-advisor list cares about.
            "school.operating": 1,
            "school.degrees_awarded.predominant": 3,
            # ONLY schools that actually publish an admit rate — otherwise the
            # imported rows have no signal to tier/rank on (the first cut pulled
            # 150 non-reporting small schools, all "Limited data"). This filter
            # narrows Scorecard's 6.3k schools to the ~1.6k that report admissions.
            "latest.admissions.admission_rate.overall__range": "0..1",
            # Largest enrollments first — surfaces recognizable universities
            # (ASU, Texas A&M, Ohio State, ...) rather than an alphabetical tail.
            "sort": "latest.student.size:desc",
        }
        if states:
            base_params["school.state"] = ",".join(s.upper() for s in states)

        collected: list[dict[str, Any]] = []
        page = 0
        async with httpx.AsyncClient(timeout=20.0) as client:
            while len(collected) < limit:
                params = dict(base_params, page=page)
                response = await client.get(self._base_url, params=params)
                response.raise_for_status()
                payload = response.json()
                batch = payload.get("results") or []
                if not batch:
                    break
                collected.extend(batch)
                page += 1
                if len(batch) < per_page:
                    break
        return collected[:limit]


def _bucket_size(enrollment: int | None) -> str | None:
    """Same three buckets the original hand-authored seed used (Small/
    Medium/Large) — thresholds are a reasonable heuristic, not a published
    standard; documented here so a future reviewer can adjust them.
    """
    if enrollment is None:
        return None
    if enrollment < 3000:
        return "Small"
    if enrollment <= 15000:
        return "Medium"
    return "Large"


def _map_ownership(ownership: int | None) -> str | None:
    # Scorecard: 1 = public, 2 = private nonprofit, 3 = private for-profit.
    if ownership == 1:
        return "Public"
    if ownership in (2, 3):
        return "Private"
    return None


def _map_locale(locale: int | str | None) -> str | None:
    if locale is None:
        return None
    return _LOCALE_BUCKETS.get(str(locale)[0])


def _band(p25: float | None, p75: float | None) -> dict[str, float | None] | None:
    if p25 is None and p75 is None:
        return None
    return {"p25": p25, "p75": p75}


def _map_scorecard_result(result: dict[str, Any]) -> dict[str, Any]:
    """Pure field-mapping — kept separate from the HTTP call and the DB
    upsert so it can be unit-tested against a synthetic payload without a
    network call or a real API key (see tests/test_colleges.py).
    """
    sat_p25 = None
    sat_p75 = None
    read_p25 = result.get("latest.admissions.sat_scores.25th_percentile.critical_reading")
    read_p75 = result.get("latest.admissions.sat_scores.75th_percentile.critical_reading")
    math_p25 = result.get("latest.admissions.sat_scores.25th_percentile.math")
    math_p75 = result.get("latest.admissions.sat_scores.75th_percentile.math")
    # Composite SAT = reading/writing sub-score + math sub-score. Scorecard's
    # field name ("critical_reading") is a holdover from the pre-2016 SAT
    # format; it is Scorecard's field for the modern Evidence-Based Reading &
    # Writing section, not a separate/extra section.
    if read_p25 is not None and math_p25 is not None:
        sat_p25 = read_p25 + math_p25
    if read_p75 is not None and math_p75 is not None:
        sat_p75 = read_p75 + math_p75

    out_of_state_tuition = result.get("latest.cost.tuition.out_of_state")

    return {
        "scorecard_unitid": str(result["id"]) if result.get("id") is not None else None,
        "name": result.get("school.name"),
        "city": result.get("school.city"),
        "state": result.get("school.state"),
        "type": _map_ownership(result.get("school.ownership")),
        "setting": _map_locale(result.get("school.locale")),
        "size": _bucket_size(result.get("latest.student.size")),
        "admit_rate_overall": result.get("latest.admissions.admission_rate.overall"),
        "sat_band": _band(sat_p25, sat_p75),
        "act_band": _band(
            result.get("latest.admissions.act_scores.25th_percentile.cumulative"),
            result.get("latest.admissions.act_scores.75th_percentile.cumulative"),
        ),
        "tuition_in_state": result.get("latest.cost.tuition.in_state"),
        "tuition_out_of_state": out_of_state_tuition,
        # Documented proxy, not fabricated new data — see module docstring.
        "tuition_international": out_of_state_tuition,
    }


def _default_target_names(existing: list[College]) -> list[str]:
    return sorted({c.name for c in existing if c.country == "US"})


async def sync_from_scorecard(
    db: AsyncSession,
    requested_by: str | None = None,
    school_names: list[str] | None = None,
) -> dict[str, Any]:
    """Enrich existing US `College` rows from College Scorecard.

    Returns a JSON-serializable summary dict rather than raising, so
    `POST /api/colleges/sync` can surface partial-failure detail (e.g. "8 of
    11 schools matched") instead of an opaque 500.
    """
    settings = get_settings()
    if not settings.college_scorecard_api_key:
        logger.warning("Scorecard sync requested but COLLEGE_SCORECARD_API_KEY is not set")
        return {
            "status": "not_configured",
            "message": (
                "COLLEGE_SCORECARD_API_KEY is not set. Get a free key at "
                "https://api.data.gov/signup/ and set it in the backend's "
                "environment, then retry."
            ),
            "synced": 0,
            "skipped": 0,
        }

    result = await db.execute(select(College))
    existing = list(result.scalars().all())
    by_unitid = {c.scorecard_unitid: c for c in existing if c.scorecard_unitid}
    by_name = {c.name.lower(): c for c in existing}

    targets = school_names if school_names is not None else _default_target_names(existing)

    client = ScorecardClient(settings.college_scorecard_api_key, settings.college_scorecard_base_url)

    synced: list[str] = []
    skipped: list[str] = []
    errors: list[dict[str, str]] = []

    for name in targets:
        college = by_name.get(name.lower())
        if college is None:
            skipped.append(name)
            continue
        if college.country != "US":
            skipped.append(name)  # non-US — see module docstring
            continue

        try:
            raw = await client.fetch_school(name)
        except httpx.HTTPError as exc:
            errors.append({"school": name, "error": str(exc)})
            continue

        if raw is None:
            skipped.append(name)
            continue

        mapped = _map_scorecard_result(raw)
        # Re-resolve by unitid in case this school was already synced under a
        # slightly different name than the current DB row.
        if mapped["scorecard_unitid"] and mapped["scorecard_unitid"] in by_unitid:
            college = by_unitid[mapped["scorecard_unitid"]]

        for field in (
            "city",
            "state",
            "type",
            "setting",
            "size",
            "admit_rate_overall",
            "tuition_in_state",
            "tuition_out_of_state",
            "tuition_international",
        ):
            value = mapped[field]
            if value is not None:
                setattr(college, field, value)
        # sat_band/act_band stored as JSON text — see app/models/college.py.
        if mapped["sat_band"] is not None:
            college.sat_band = json.dumps(mapped["sat_band"])
        if mapped["act_band"] is not None:
            college.act_band = json.dumps(mapped["act_band"])
        if mapped["scorecard_unitid"]:
            college.scorecard_unitid = mapped["scorecard_unitid"]

        college.data_source = "scorecard"
        college.last_synced_at = datetime.utcnow()
        synced.append(name)

    await db.commit()

    return {
        "status": "ok" if not errors else "partial",
        "requested_by": requested_by,
        "synced": len(synced),
        "synced_schools": synced,
        "skipped": len(skipped),
        "skipped_schools": skipped,
        "errors": errors,
    }


async def import_colleges_from_scorecard(
    db: AsyncSession,
    states: list[str] | None = None,
    limit: int = 100,
    requested_by: str | None = None,
) -> dict[str, Any]:
    """DISCOVER and INSERT new US colleges from College Scorecard.

    This is the "make the directory dynamic instead of a hand-seed" path — it
    grows the catalog beyond the manually-curated seed, which `sync_from_scorecard`
    (enrich-only) deliberately never did. Each newly-inserted `College` gets ONE
    directory-level `Program` so it appears in `GET /api/colleges` (which joins
    from `Program`).

    Honesty rules preserved from the module docstring:
      - Real Scorecard fields only (admit rate, university-wide SAT/ACT bands,
        tuition, size, setting). NO fabricated GPA band — the Program's
        `gpa_band` stays NULL, and the frontend classifier (classification.js)
        classifies these rows on test scores / admit rate instead.
      - US-only (Scorecard has no non-US schools).
      - Idempotent: a school already present (by `scorecard_unitid` or name) is
        skipped, so re-running never duplicates.
    """
    settings = get_settings()
    if not settings.college_scorecard_api_key:
        logger.warning("Scorecard import requested but COLLEGE_SCORECARD_API_KEY is not set")
        return {
            "status": "not_configured",
            "message": (
                "COLLEGE_SCORECARD_API_KEY is not set. Get a free key at "
                "https://api.data.gov/signup/ (or use DEMO_KEY for a rate-limited "
                "trial), set it via /set-app-env, then retry."
            ),
            "imported": 0,
            "skipped": 0,
        }

    client = ScorecardClient(settings.college_scorecard_api_key, settings.college_scorecard_base_url)
    try:
        raws = await client.discover_schools(states=states, limit=limit)
    except httpx.HTTPError as exc:
        return {"status": "error", "message": str(exc), "imported": 0, "skipped": 0}

    result = await db.execute(select(College))
    existing = list(result.scalars().all())
    have_unitid = {c.scorecard_unitid for c in existing if c.scorecard_unitid}
    have_name = {c.name.lower() for c in existing if c.name}

    imported: list[str] = []
    skipped = 0
    for raw in raws:
        mapped = _map_scorecard_result(raw)
        uid = mapped["scorecard_unitid"]
        name = mapped["name"]
        if not uid or not name:
            skipped += 1
            continue
        if uid in have_unitid or name.lower() in have_name:
            skipped += 1  # already have it (seed or a prior import) — idempotent
            continue

        college = College(
            name=name,
            city=mapped["city"],
            state=mapped["state"],
            country="US",
            type=mapped["type"],
            size=mapped["size"],
            setting=mapped["setting"],
            admit_rate_overall=mapped["admit_rate_overall"],
            sat_band=json.dumps(mapped["sat_band"]) if mapped["sat_band"] else None,
            act_band=json.dumps(mapped["act_band"]) if mapped["act_band"] else None,
            tuition_in_state=mapped["tuition_in_state"],
            tuition_out_of_state=mapped["tuition_out_of_state"],
            tuition_international=mapped["tuition_international"],
            scorecard_unitid=uid,
            data_source="scorecard",
            last_synced_at=datetime.utcnow(),
        )
        db.add(college)
        await db.flush()  # assign college.id for the Program FK

        # One directory-level Program so the school is reachable via
        # GET /api/colleges. University-wide admit rate + SAT band flow through
        # the serializer's college-level fallback; program-level overrides and
        # gpa_band stay NULL (never fabricated — see module docstring).
        db.add(
            Program(
                slug=f"scorecard-{uid}",
                college_id=college.id,
                dept="General Admission",
                category="University",
                ranking=None,
                admit_rate=None,
                sat_band=None,
                act_band=None,
                gpa_band=None,
                data_source="scorecard",
            )
        )
        have_unitid.add(uid)
        have_name.add(name.lower())
        imported.append(name)

    await db.commit()

    return {
        "status": "ok",
        "requested_by": requested_by,
        "requested_states": states,
        "discovered": len(raws),
        "imported": len(imported),
        "imported_schools": imported[:50],
        "skipped": skipped,
    }

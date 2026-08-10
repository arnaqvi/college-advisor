"""API response shapes for `/api/colleges`.

Deliberately mirrors the exact camelCase keys the frontend already expected
from the old static `frontend/src/data/colleges.js` fixture (id, name,
state, location, type, size, dept, category, ranking, admitRate, gpaBand,
satBand, actBand, recommendedCourses, gemProfile) — see
`app/routers/colleges.py`'s serializer, which builds one `ProgramOut` per
`Program` row, falling back to the parent `College`'s university-wide
figures for `admitRate`/`satBand`/`actBand` when a program doesn't carry its
own override (see app/models/college.py's module docstring for why).
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ScoreBand(CamelModel):
    p25: float | None = None
    p75: float | None = None


class GpaBand(CamelModel):
    p25: float | None = None
    p75: float | None = None
    scale: float | None = None
    # Only populated if a future record distinguishes weighted/unweighted —
    # see CollegeDirectory.jsx's formatGpaRange(), which already handles this
    # optional shape and was written before the backend existed.
    weighted: ScoreBand | None = None
    unweighted: ScoreBand | None = None


class GemProfile(CamelModel):
    overlooked_reason: str | None = None
    angle: str | None = None


class ProgramOut(CamelModel):
    """One row = one program-at-a-university, matching the pre-existing
    frontend shape exactly so `classification.js`/`segmentation.js`/
    `CollegeDirectory.jsx` need no field-name changes, only a new data
    source.
    """

    id: str  # Program.slug, not the numeric PK — see model docstring.
    name: str
    state: str | None = None
    location: str | None = None
    type: str | None = None
    size: str | None = None
    setting: str | None = None
    country: str = "US"
    dept: str
    category: str
    ranking: int | None = None
    admit_rate: float | None = None
    # Raw `College.admit_rate_overall` — deliberately NOT the same value as
    # `admit_rate` above once a program has its own manual override. Added
    # for spec 3.5's Hidden Gems "niche program at a selective college"
    # pathway (frontend/src/lib/engine/hiddenGems.js), which needs to compare
    # a program's own admit rate against its college's UNMERGED university
    # -wide figure to detect "this specific major is a comparatively easy way
    # into an otherwise selective school" — `admit_rate` above already has
    # the College fallback baked in (see serialize_program docstring), so it
    # can't be used for that comparison once a program-level override exists.
    # Null whenever the parent College has never been Scorecard-synced (most
    # manually-curated seed colleges today) — callers must treat null here as
    # "no basis for the comparison," not "0% admit rate."
    college_admit_rate_overall: float | None = None
    gpa_band: GpaBand | None = None
    sat_band: ScoreBand | None = None
    act_band: ScoreBand | None = None
    recommended_courses: list[str] = []
    gem_profile: GemProfile | None = None
    application_platform: str | None = None
    deadlines: dict[str, Any] | None = None
    tuition_in_state: float | None = None
    tuition_out_of_state: float | None = None
    tuition_international: float | None = None
    # Transparency fields — not in the original static fixture, additive
    # only (the frontend ignores unknown keys), so they can't break existing
    # rendering. Lets the UI (or a future admin view) show provenance.
    data_source: str | None = None
    last_synced_at: str | None = None


class DeadlineOverrideIn(CamelModel):
    """See app/models/college.py's `DeadlineOverride` docstring for why this
    is per-user rather than a write to `College.deadlines`.

    First schema in this file used as a request body rather than only a
    response — validating a `date | None` field here triggers a benign
    Pydantic `UnsupportedFieldAttributeWarning` (an internal quirk of
    alias_generator + Optional fields on the *validation* path specifically;
    response-only schemas above never hit it). Confirmed harmless: aliasing
    still round-trips correctly, see tests/test_deadline_overrides.py."""

    ed_date: date | None = None
    ea_date: date | None = None
    rd_date: date | None = None
    rolling: bool = False
    note: str | None = None


class DeadlineOverrideOut(CamelModel):
    # Not a subclass of DeadlineOverrideIn — re-applying CamelModel's
    # alias_generator to already-aliased inherited fields trips a Pydantic
    # UnsupportedFieldAttributeWarning (confirmed: only appears once this
    # class inherits rather than redeclaring the fields directly).
    program_slug: str
    ed_date: date | None = None
    ea_date: date | None = None
    rd_date: date | None = None
    rolling: bool = False
    note: str | None = None
    updated_at: datetime

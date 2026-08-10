"""College directory — the real backend store for `/api/colleges`.

Replaces the frontend's static `frontend/src/data/colleges.js` fixture as the
runtime source of truth for the Classification Engine (spec 3.1) and the
College List / Program Directory pages. The original 13-school fixture is
preserved as this store's *initial seed*, not thrown away — see
`app/migrations/seed_colleges.py`.

Two tables, matching how the spec (and the pre-existing frontend fixture)
actually models the domain: classification happens **per program at a
university** (spec 3.1/3.4), not per university as a whole, so a university
with three tracked majors is three `Program` rows sharing one `College` row.

## Where each field comes from (why `gpa_band` lives apart from the rest)

`College` carries the fields the free US Dept of Education **College
Scorecard API** can plausibly answer (name/location/ownership/size, overall
admit rate, university-wide SAT/ACT percentile bands, tuition) — see
`app/services/scorecard_sync.py`. Those columns are safe for the sync job to
overwrite on every run; Scorecard is the more current/authoritative source
for them once configured.

`Program.gpa_band` is **not** one of those fields — Scorecard does not
publish GPA percentiles at all (see spec 3.9's own "don't fabricate a range
the source doesn't publish" rule), so it is only ever populated/edited by
manual curation (the seed migration today, an admin UI later). The sync job
in `scorecard_sync.py` never touches `gpa_band` — that is the entire
mechanism keeping manually-curated GPA data from being clobbered by a
re-sync. It's simply a column the sync code has no knowledge of.

`Program.admit_rate` / `Program.sat_band` / `Program.act_band` are
*program-level overrides*, nullable, and manually curated (Scorecard has no
concept of a program-specific admit rate or score band). When a program row
doesn't have its own override, callers fall back to the parent `College`'s
university-wide figure — see `app/schemas/college.py`'s serializer. This
lets the existing seed data (which already differentiates, e.g., UT Austin
CS admits ~11% vs UT Austin McCombs Business ~19%) keep taking precedence
over a coarser university-wide Scorecard number, without losing the ability
to sync the university-wide baseline for every other program that doesn't
have its own override yet.

JSON-shaped fields (`gpa_band`, `sat_band`, `act_band`, `recommended_courses`,
`gem_profile`, `deadlines`) are stored as JSON-encoded `Text`, matching the
convention already used elsewhere in this codebase (see
`OnboardingProgress.completed_steps`, `AcademicRecord.rigor_courses`) — a
SQLite-compatible stand-in for real Postgres `JSONB` later.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class College(Base):
    """A university/institution — the parent row for one or more `Program`s.

    University-wide fields only. Program-specific admit rate / test bands /
    GPA bands live on `Program`, not here — see module docstring.
    """

    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    city: Mapped[str | None] = mapped_column(String(120), default=None)
    state: Mapped[str | None] = mapped_column(String(10), default=None, index=True)
    # ISO-ish country code. Scorecard sync only ever writes "US" — see
    # app/services/scorecard_sync.py's module docstring for why non-US
    # schools (e.g. Canadian universities from spec 3.9) stay manual-only.
    country: Mapped[str] = mapped_column(String(10), default="US")
    # "Public" | "Private" — matches the frontend's pre-existing `type` field
    # name so the API serializer needs no renaming.
    type: Mapped[str | None] = mapped_column(String(20), default=None)
    # "Small" | "Medium" | "Large" — bucketed from Scorecard's raw enrollment
    # count by scorecard_sync.py (see its `bucket_size()`), or set manually.
    size: Mapped[str | None] = mapped_column(String(20), default=None)
    # "Urban" | "Suburban" | "Rural" | "Town" — derived from Scorecard's NCES
    # locale code where available (spec 3.9); manual otherwise. Not yet
    # rendered by the frontend table, but modeled now per spec coverage.
    setting: Mapped[str | None] = mapped_column(String(20), default=None)

    admit_rate_overall: Mapped[float | None] = mapped_column(Float, default=None)
    sat_band: Mapped[str | None] = mapped_column(Text, default=None)  # JSON {p25,p75}
    act_band: Mapped[str | None] = mapped_column(Text, default=None)  # JSON {p25,p75}

    tuition_in_state: Mapped[float | None] = mapped_column(Float, default=None)
    tuition_out_of_state: Mapped[float | None] = mapped_column(Float, default=None)
    # Scorecard does not publish a separate international rate; scorecard_sync.py
    # documents at the call site whenever it uses out-of-state tuition as a
    # best-available proxy rather than fabricating a distinct figure.
    tuition_international: Mapped[float | None] = mapped_column(Float, default=None)

    # Manual-only (Scorecard has neither of these):
    application_platform: Mapped[str | None] = mapped_column(String(50), default=None)
    deadlines: Mapped[str | None] = mapped_column(Text, default=None)  # JSON

    # Sync bookkeeping.
    scorecard_unitid: Mapped[str | None] = mapped_column(
        String(20), unique=True, index=True, default=None
    )
    # "seed" | "manual" | "scorecard" — the most recent source that touched
    # this row's Scorecard-owned fields (not gpa_band, which is always
    # "manual" at the Program level regardless of this flag).
    data_source: Mapped[str] = mapped_column(String(20), default="manual")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    programs: Mapped[list["Program"]] = relationship(
        "Program", back_populates="college", cascade="all, delete-orphan"
    )


class Program(Base):
    """One major/department tracked at one `College` — the Classification
    Engine's actual unit of classification (spec 3.1/3.4).

    `slug` preserves the exact string ids the original static fixture used
    (e.g. "ut-austin-computer-science") so any already-serialized frontend
    state (e.g. EssayTracker's `essay.collegeId`) keeps resolving after the
    migration to a real backend id space — see the seed migration.
    """

    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    college_id: Mapped[int] = mapped_column(ForeignKey("colleges.id"), index=True)

    dept: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(50))
    # Program-level prestige rank used to sort Hidden Gems (spec 3.5) — always
    # manual, Scorecard has no ranking concept.
    ranking: Mapped[int | None] = mapped_column(Integer, default=None)

    # Program-level overrides — nullable. Fall back to the parent College's
    # university-wide figure in the API serializer when unset. See module
    # docstring for why this differs from gpa_band.
    admit_rate: Mapped[float | None] = mapped_column(Float, default=None)
    sat_band: Mapped[str | None] = mapped_column(Text, default=None)  # JSON {p25,p75}
    act_band: Mapped[str | None] = mapped_column(Text, default=None)  # JSON {p25,p75}

    # MANUAL ONLY — never written by scorecard_sync.py. See module docstring.
    gpa_band: Mapped[str | None] = mapped_column(Text, default=None)  # JSON {p25,p75,scale}

    recommended_courses: Mapped[str | None] = mapped_column(Text, default=None)  # JSON list
    # JSON {overlookedReason, angle} | null — spec 3.5 Hidden Gem Discovery.
    gem_profile: Mapped[str | None] = mapped_column(Text, default=None)

    data_source: Mapped[str] = mapped_column(String(20), default="manual")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    college: Mapped["College"] = relationship("College", back_populates="programs")


class DeadlineOverride(Base):
    """A student's own belief about a program's application deadline.

    Deliberately per-user, not a write to `College.deadlines` — that column
    is reserved for hand-verified, sourced facts (see module docstring,
    same trust level as `gpa_band`) shown to every user. Most of the 230-
    college directory has no real deadline data (College Scorecard doesn't
    publish deadlines at all — see app/services/scorecard_sync.py), so
    letting any signed-in user fill one in is useful, but letting that
    overwrite what every OTHER user sees would mean one wrong or malicious
    entry corrupts a shared fact with no review step. Keyed by `Program.slug`
    (not `college_id`) so it lines up with the id space the frontend already
    uses everywhere (see lib/engine/taskSlugs.js's `deadlineTaskSlug`).
    """

    __tablename__ = "deadline_overrides"
    __table_args__ = (UniqueConstraint("user_id", "program_slug", name="uq_deadline_override_user_program"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    program_slug: Mapped[str] = mapped_column(String(120), index=True)

    ed_date: Mapped[date | None] = mapped_column(Date, default=None)
    ea_date: Mapped[date | None] = mapped_column(Date, default=None)
    rd_date: Mapped[date | None] = mapped_column(Date, default=None)
    rolling: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(String(500), default=None)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

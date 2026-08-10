"""Manually-curated seed for the real `College`/`Program` backend store.

Originally ported the 13-row static fixture that used to live at
`frontend/src/data/colleges.js` (deleted from the frontend — see the
2026-07-28 "remove hardcoded colleges" session). Expanded 2026-07-30 to 35
programs / 34 unique colleges (see the block comment above the newly-added
entries below) because 13 was far short of the app's "30+ colleges" target
and, since the backend's SQLite database has no PVC/persistent volume, every
pod restart/redeploy wipes it and this script is what re-populates it — so
this list, not any live external API, is the actual source of truth for
what shows up in production. See `_seed_colleges_if_empty` in `app/main.py`
for how/when this runs, and `pattern-no-self-service-db-provisioning` in the
platform's lab-apps agent memory for why a durable Postgres isn't wired up
yet (needs a human/infra credential ask, not a code change).

This is the **initial content** of the backend college directory, not a
throwaway migration script — every `gpa_band` in here is the permanent
manual-curation source for these programs (see app/models/college.py's
module docstring: Scorecard sync never touches `gpa_band`, so whatever this
script writes stays authoritative for that field indefinitely, only ever
edited by hand or a future admin UI).

Two data-quality fixes are carried over from the original 13-row fixture:
- University of Tulsa: `state` corrected to "OK" (Tulsa is in Oklahoma, not
  Texas) — this was already fixed in the frontend fixture on 2026-07-28
  before this migration (commit 5e256e5); carried over here unchanged.
- DePauw University: `state` corrected to "IN" (DePauw is in Greencastle,
  **Indiana** — the original fixture had `state: 'IL'` while its own
  `location` field already correctly said "Greencastle, IN", an internal
  inconsistency never caught before now).

Usage:
    poetry run python -m app.migrations.seed_colleges

Idempotent: upserts by `Program.slug`, safe to re-run.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base
from app.models.college import College, Program

logger = logging.getLogger(__name__)

# One entry per program-at-a-university, same shape/order as the original
# frontend/src/data/colleges.js fixture. `college` fields are duplicated
# across an institution's rows (e.g. both UT Austin rows) and deduped by
# name during the upsert below, matching how the College/Program split works.
SEED_PROGRAMS: list[dict[str, Any]] = [
    {
        "slug": "stanford",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-05",
                "note": "Restrictive Early Action, non-binding; no ED offered",
                "source": "https://admission.stanford.edu/apply/deadlines/",
            },
            "name": "Stanford University",
            "state": "CA",
            "city": "Stanford",
            "type": "Private",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 3,
        "admit_rate": 0.04,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1500, "p75": 1580},
        "act_band": {"p25": 34, "p75": 36},
        "recommended_courses": ["AP Calculus BC", "AP Physics C", "AP Computer Science A"],
        "gem_profile": None,
    },
    {
        "slug": "unc-chapel-hill",
        "college": {
            "deadlines": {
                "ea": "2026-10-15",
                "rd": "2027-01-15",
                "source": "https://admissions.unc.edu/apply/types-of-applications/first-year/",
            },
            "name": "UNC Chapel Hill",
            "state": "NC",
            "city": "Chapel Hill",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Biology",
        "category": "Health Sciences",
        "ranking": 22,
        "admit_rate": 0.17,
        "gpa_band": {"p25": 3.7, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1310, "p75": 1480},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP Biology", "AP Chemistry", "Honors Anatomy"],
        "gem_profile": None,
    },
    {
        "slug": "olin-college",
        "college": {
            "deadlines": {
                "rd": "2026-12-15",
                "note": "single unified deadline; no ED/EA offered",
                "source": "https://www.olin.edu/admission/apply/admission-process",
            },
            "name": "Olin College of Engineering",
            "state": "MA",
            "city": "Needham",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 45,
        "admit_rate": 0.16,
        "gpa_band": {"p25": 3.8, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1450, "p75": 1550},
        "act_band": {"p25": 33, "p75": 35},
        "recommended_courses": ["AP Physics C", "AP Calculus BC"],
        "gem_profile": {
            "overlooked_reason": (
                "Small size and an unfamiliar name overshadow an engineering "
                "program with placement outcomes rivaling MIT/Caltech."
            ),
            "angle": "Emphasize hands-on, project-based engineering work and interest in collaborative design.",
        },
    },
    {
        "slug": "university-of-tulsa",
        "college": {
            "name": "University of Tulsa",
            "state": "OK",  # see module docstring — corrected 2026-07-28
            "city": "Tulsa",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 89,
        "admit_rate": 0.42,
        "gpa_band": {"p25": 3.3, "p75": 3.8, "scale": 4.0},
        "sat_band": {"p25": 1180, "p75": 1370},
        "act_band": {"p25": 24, "p75": 30},
        "recommended_courses": ["AP Physics 1", "Pre-Calculus"],
        "gem_profile": {
            "overlooked_reason": (
                "Regional reputation masks strong energy-sector engineering "
                "placement and generous merit aid."
            ),
            "angle": "Highlight interest in energy-sector engineering and access to small-cohort undergrad research.",
        },
    },
    {
        "slug": "babson-college",
        "college": {
            "name": "Babson College",
            "state": "MA",
            "city": "Wellesley",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 60,
        "admit_rate": 0.22,
        "gpa_band": {"p25": 3.5, "p75": 3.8, "scale": 4.0},
        "sat_band": {"p25": 1330, "p75": 1480},
        "act_band": {"p25": 30, "p75": 33},
        "recommended_courses": ["AP Microeconomics", "AP Macroeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "depauw-university",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "ea": "2026-11-01",
                "rd": "2027-02-01",
                "note": "ED II/EA II round also Dec 15",
                "source": "https://www.depauw.edu/admission-aid/apply/",
            },
            "name": "DePauw University",
            "state": "IN",  # see module docstring — corrected this session (was "IL")
            "city": "Greencastle",
            "type": "Private",
            "size": "Small",
        },
        "dept": "English",
        "category": "Liberal Arts",
        "ranking": 75,
        "admit_rate": 0.55,
        "gpa_band": {"p25": 3.3, "p75": 3.8, "scale": 4.0},
        "sat_band": {"p25": 1150, "p75": 1340},
        "act_band": {"p25": 24, "p75": 30},
        "recommended_courses": ["AP English Literature", "AP English Language"],
        "gem_profile": {
            "overlooked_reason": (
                "Overshadowed by larger liberal-arts brands despite strong "
                "writing-focused faculty ratios."
            ),
            "angle": "Emphasize a portfolio of creative/analytical writing and interest in small-seminar discussion.",
        },
    },
    {
        "slug": "university-of-rochester",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "rd": "2027-01-05",
                "note": "ED II also Jan 5, same as RD",
                "source": "https://admissions.rochester.edu/applying/dates-and-deadlines/",
            },
            "name": "University of Rochester",
            "state": "NY",
            "city": "Rochester",
            "type": "Private",
            "size": "Medium",
        },
        "dept": "Psychology",
        "category": "Liberal Arts",
        "ranking": 34,
        "admit_rate": 0.37,
        "gpa_band": {"p25": 3.5, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1330, "p75": 1500},
        "act_band": {"p25": 30, "p75": 34},
        "recommended_courses": ["AP Psychology", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "georgia-tech",
        "college": {
            "deadlines": {
                "ea": "2026-11-02",
                "rd": "2027-01-06",
                "note": "EA is Oct 15 for GA residents, Nov 2 for others",
                "source": "https://admission.gatech.edu/first-year/deadlines",
            },
            "name": "Georgia Institute of Technology",
            "state": "GA",
            "city": "Atlanta",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 8,
        "admit_rate": 0.16,
        "gpa_band": {"p25": 3.8, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1370, "p75": 1530},
        "act_band": {"p25": 31, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "case-western",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "note": "ED II also Jan 15",
                "source": "https://case.edu/admission/apply/dates-deadlines",
            },
            "name": "Case Western Reserve University",
            "state": "OH",
            "city": "Cleveland",
            "type": "Private",
            "size": "Medium",
        },
        "dept": "Nursing",
        "category": "Health Sciences",
        "ranking": 42,
        "admit_rate": 0.32,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1300, "p75": 1470},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP Biology", "AP Chemistry", "Anatomy & Physiology"],
        "gem_profile": {
            "overlooked_reason": (
                "Known primarily for engineering and medicine, so its nursing "
                "program is under-applied relative to its clinical placement quality."
            ),
            "angle": "Highlight direct clinical/volunteer healthcare experience and interest in research-integrated nursing.",
        },
    },
    {
        "slug": "ut-austin-computer-science",
        "college": {
            "deadlines": {
                "ea": "2026-10-15",
                "rd": "2026-12-01",
                "source": "https://admissions.utexas.edu/apply/freshman/",
            },
            "name": "University of Texas at Austin",
            "state": "TX",
            "city": "Austin",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 10,
        "admit_rate": 0.11,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1450, "p75": 1560},
        "act_band": {"p25": 33, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "ut-austin-mccombs-business",
        "college": {
            "deadlines": {
                "ea": "2026-10-15",
                "rd": "2026-12-01",
                "source": "https://admissions.utexas.edu/apply/freshman/",
            },
            "name": "University of Texas at Austin",
            "state": "TX",
            "city": "Austin",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 17,
        "admit_rate": 0.19,
        "gpa_band": {"p25": 3.8, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1380, "p75": 1500},
        "act_band": {"p25": 31, "p75": 34},
        "recommended_courses": ["AP Microeconomics", "AP Macroeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "texas-am-engineering",
        "college": {
            "name": "Texas A&M University",
            "state": "TX",
            "city": "College Station",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 19,
        "admit_rate": 0.63,
        "gpa_band": {"p25": 3.5, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1200, "p75": 1400},
        "act_band": {"p25": 26, "p75": 32},
        "recommended_courses": ["AP Calculus AB", "AP Physics 1", "AP Chemistry"],
        "gem_profile": None,
    },
    {
        "slug": "university-of-puget-sound",
        "college": {
            "name": "University of Puget Sound",
            "state": "WA",
            "city": "Tacoma",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Visual Arts",
        "category": "Fine Arts",
        "ranking": 110,
        "admit_rate": 0.83,
        "gpa_band": {"p25": 3.1, "p75": 3.6, "scale": 4.0},
        "sat_band": {"p25": 1080, "p75": 1280},
        "act_band": {"p25": 22, "p75": 28},
        "recommended_courses": ["AP Studio Art", "AP Art History"],
        "gem_profile": {
            "overlooked_reason": (
                "A high admit rate reads as low prestige, obscuring a "
                "well-resourced studio arts program and small class sizes."
            ),
            "angle": "Emphasize a strong studio portfolio and interest in individualized faculty mentorship.",
        },
    },
    # --- Added 2026-07-30: expanded the manually-curated seed from 13 to 35
    # programs / 12 to 34 unique colleges. Same reason the original 13 exist
    # at all — College Scorecard has no GPA-band data and was never run
    # against the live API in this workspace (no API key configured, see
    # app/core/config.py), so this manual list remains the only source of
    # truth for gpa_band on every program until that changes. Rankings are
    # approximate (rounded from public US News-style bands, not pulled from
    # any live source) and, like every other field here, are meant to be
    # replaced/refined by a future admin UI or Scorecard sync rather than
    # treated as precise. Spans a deliberately wide range of admit rates
    # (competitive to open-access) and states so a real student profile
    # produces a mix of Reach/Target/Safety tiers instead of an all-Reach
    # or all-Safety list.
    {
        "slug": "mit-computer-science",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-04",
                "source": "https://mitadmissions.org/apply/firstyear/deadlines-requirements/",
            },
            "name": "Massachusetts Institute of Technology",
            "state": "MA",
            "city": "Cambridge",
            "type": "Private",
            "size": "Medium",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 2,
        "admit_rate": 0.04,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1520, "p75": 1580},
        "act_band": {"p25": 35, "p75": 36},
        "recommended_courses": ["AP Calculus BC", "AP Physics C", "AP Computer Science A"],
        "gem_profile": None,
    },
    {
        "slug": "harvard-economics",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-01",
                "note": "Restrictive Early Action, non-binding; no ED offered",
                "source": "https://college.harvard.edu/admissions/apply/first-year-applicants",
            },
            "name": "Harvard University",
            "state": "MA",
            "city": "Cambridge",
            "type": "Private",
            "size": "Medium",
        },
        "dept": "Economics",
        "category": "Liberal Arts",
        "ranking": 3,
        "admit_rate": 0.03,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1490, "p75": 1580},
        "act_band": {"p25": 34, "p75": 36},
        "recommended_courses": ["AP Microeconomics", "AP Macroeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "michigan-mechanical-engineering",
        "college": {
            "name": "University of Michigan",
            "state": "MI",
            "city": "Ann Arbor",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 21,
        "admit_rate": 0.18,
        "gpa_band": {"p25": 3.7, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1400, "p75": 1540},
        "act_band": {"p25": 32, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "ucla-psychology",
        "college": {
            "deadlines": {
                "rd": "2026-11-30",
                "note": "UC filing period; no ED/EA offered",
                "source": "https://admission.ucla.edu/apply/first-year",
            },
            "name": "University of California, Los Angeles",
            "state": "CA",
            "city": "Los Angeles",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Psychology",
        "category": "Liberal Arts",
        "ranking": 15,
        "admit_rate": 0.09,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1290, "p75": 1510},
        "act_band": {"p25": 28, "p75": 34},
        "recommended_courses": ["AP Psychology", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "berkeley-eecs",
        "college": {
            "deadlines": {
                "rd": "2026-11-30",
                "note": "UC filing period; no ED/EA offered",
                "source": "https://admissions.berkeley.edu/apply-to-berkeley/dates-deadlines/",
            },
            "name": "University of California, Berkeley",
            "state": "CA",
            "city": "Berkeley",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 20,
        "admit_rate": 0.07,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1440, "p75": 1560},
        "act_band": {"p25": 33, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "uw-computer-science",
        "college": {
            "deadlines": {
                "rd": "2026-11-15",
                "note": "single Autumn deadline; no ED/EA offered",
                "source": "https://admit.washington.edu/apply/first-year/",
            },
            "name": "University of Washington",
            "state": "WA",
            "city": "Seattle",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 25,
        "admit_rate": 0.05,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1440, "p75": 1550},
        "act_band": {"p25": 32, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A"],
        "gem_profile": None,
    },
    {
        "slug": "uiuc-computer-science",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-05",
                "source": "https://www.admissions.illinois.edu/apply/freshman/dates",
            },
            "name": "University of Illinois Urbana-Champaign",
            "state": "IL",
            "city": "Champaign",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 35,
        "admit_rate": 0.07,
        "gpa_band": {"p25": 3.8, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1460, "p75": 1560},
        "act_band": {"p25": 33, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "purdue-engineering",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "source": "https://www.admissions.purdue.edu/deadlines/first-year-college-student/",
            },
            "name": "Purdue University",
            "state": "IN",
            "city": "West Lafayette",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 53,
        "admit_rate": 0.20,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1300, "p75": 1470},
        "act_band": {"p25": 29, "p75": 34},
        "recommended_courses": ["AP Calculus BC", "AP Physics 1", "AP Chemistry"],
        "gem_profile": None,
    },
    {
        "slug": "ohio-state-fisher-business",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "source": "https://undergrad.osu.edu/apply/freshmen-columbus/apply-step-by-step",
            },
            "name": "Ohio State University",
            "state": "OH",
            "city": "Columbus",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 49,
        "admit_rate": 0.14,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1310, "p75": 1470},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP Microeconomics", "AP Macroeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "indiana-kelley-business",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-02-01",
                "source": "https://bloomington.iu.edu/admissions/apply/freshman/deadlines.html",
            },
            "name": "Indiana University Bloomington",
            "state": "IN",
            "city": "Bloomington",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 71,
        "admit_rate": 0.50,
        "gpa_band": {"p25": 3.4, "p75": 3.8, "scale": 4.0},
        "sat_band": {"p25": 1170, "p75": 1380},
        "act_band": {"p25": 25, "p75": 31},
        "recommended_courses": ["AP Microeconomics", "AP Statistics"],
        "gem_profile": {
            "overlooked_reason": (
                "Overshadowed by higher-prestige business brands despite Kelley's "
                "strong undergraduate placement into consulting and finance."
            ),
            "angle": "Highlight leadership in a business-adjacent extracurricular (DECA, investing club, student-run venture).",
        },
    },
    {
        "slug": "wisconsin-engineering",
        "college": {
            "name": "University of Wisconsin-Madison",
            "state": "WI",
            "city": "Madison",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 42,
        "admit_rate": 0.20,
        "gpa_band": {"p25": 3.7, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1350, "p75": 1500},
        "act_band": {"p25": 30, "p75": 34},
        "recommended_courses": ["AP Calculus BC", "AP Physics 1"],
        "gem_profile": None,
    },
    {
        "slug": "uva-mcintire-commerce",
        "college": {
            "deadlines": {
                "ea": "2026-11-01",
                "rd": "2027-01-05",
                "source": "https://admission.virginia.edu/admission/deadlines-instructions",
            },
            "name": "University of Virginia",
            "state": "VA",
            "city": "Charlottesville",
            "type": "Public",
            "size": "Medium",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 24,
        "admit_rate": 0.09,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1400, "p75": 1530},
        "act_band": {"p25": 32, "p75": 35},
        "recommended_courses": ["AP Microeconomics", "AP Macroeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "uf-computer-science",
        "college": {
            "deadlines": {
                "ed": "2026-10-15",
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "source": "https://admissions.ufl.edu/apply/freshman/deadlines",
            },
            "name": "University of Florida",
            "state": "FL",
            "city": "Gainesville",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 28,
        "admit_rate": 0.09,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1350, "p75": 1500},
        "act_band": {"p25": 30, "p75": 34},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A"],
        "gem_profile": None,
    },
    {
        "slug": "fsu-business",
        "college": {
            "deadlines": {
                "ed": "2026-10-15",
                "ea": "2026-10-15",
                "rd": "2026-12-01",
                "source": "https://admissions.fsu.edu/deadlines",
            },
            "name": "Florida State University",
            "state": "FL",
            "city": "Tallahassee",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Business",
        "category": "Business",
        "ranking": 55,
        "admit_rate": 0.28,
        "gpa_band": {"p25": 3.5, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1180, "p75": 1330},
        "act_band": {"p25": 25, "p75": 29},
        "recommended_courses": ["AP Microeconomics", "AP Statistics"],
        "gem_profile": None,
    },
    {
        "slug": "asu-engineering",
        "college": {
            "name": "Arizona State University",
            "state": "AZ",
            "city": "Tempe",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 121,
        "admit_rate": 0.86,
        "gpa_band": {"p25": 3.3, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1120, "p75": 1350},
        "act_band": {"p25": 21, "p75": 28},
        "recommended_courses": ["AP Calculus AB", "AP Physics 1"],
        "gem_profile": {
            "overlooked_reason": (
                "A very high overall admit rate obscures genuinely strong, "
                "well-funded engineering research programs and honors-college options."
            ),
            "angle": "Apply to the Barrett Honors College track and highlight interest in a specific research lab.",
        },
    },
    {
        "slug": "arizona-nursing",
        "college": {
            "name": "University of Arizona",
            "state": "AZ",
            "city": "Tucson",
            "type": "Public",
            "size": "Large",
        },
        "dept": "Nursing",
        "category": "Health Sciences",
        "ranking": 103,
        "admit_rate": 0.85,
        "gpa_band": {"p25": 3.3, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1090, "p75": 1320},
        "act_band": {"p25": 20, "p75": 27},
        "recommended_courses": ["AP Biology", "AP Chemistry", "Anatomy & Physiology"],
        "gem_profile": None,
    },
    {
        "slug": "colorado-college-environmental-studies",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "note": "ED II also Jan 15",
                "source": "https://www.coloradocollege.edu/admission/for-students/admission-requirements/first-year-students/first-year-students.html",
            },
            "name": "Colorado College",
            "state": "CO",
            "city": "Colorado Springs",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Environmental Science",
        "category": "STEM",
        "ranking": 27,
        "admit_rate": 0.14,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1300, "p75": 1480},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP Environmental Science", "AP Biology"],
        "gem_profile": {
            "overlooked_reason": (
                "Its unusual one-course-at-a-time Block Plan is more often seen as a "
                "quirk than the deliberate, outdoors-integrated academic advantage it is."
            ),
            "angle": "Emphasize independent field research or outdoor-education experience and interest in immersive, single-subject study.",
        },
    },
    {
        "slug": "reed-english",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "ea": "2026-11-01",
                "rd": "2027-01-15",
                "note": "ED II also Jan 15",
                "source": "https://www.reed.edu/admission-aid/how-to-apply/first-year.html",
            },
            "name": "Reed College",
            "state": "OR",
            "city": "Portland",
            "type": "Private",
            "size": "Small",
        },
        "dept": "English",
        "category": "Liberal Arts",
        "ranking": 72,
        "admit_rate": 0.34,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1330, "p75": 1500},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP English Literature", "AP English Language"],
        "gem_profile": {
            "overlooked_reason": (
                "A reputation for intensity scares off applicants who'd thrive in its "
                "rigorous, discussion-based, thesis-required curriculum."
            ),
            "angle": "Emphasize independent research/writing projects and comfort with primary-source, seminar-style discussion.",
        },
    },
    {
        "slug": "kenyon-english",
        "college": {
            "deadlines": {
                "ed": "2026-11-15",
                "rd": "2027-01-15",
                "note": "ED II also Jan 15, same as RD",
                "source": "https://www.kenyon.edu/admissions-aid/apply-to-kenyon/deadlines-requirements/",
            },
            "name": "Kenyon College",
            "state": "OH",
            "city": "Gambier",
            "type": "Private",
            "size": "Small",
        },
        "dept": "English",
        "category": "Liberal Arts",
        "ranking": 62,
        "admit_rate": 0.30,
        "gpa_band": {"p25": 3.5, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1310, "p75": 1470},
        "act_band": {"p25": 29, "p75": 33},
        "recommended_courses": ["AP English Literature", "AP English Language"],
        "gem_profile": {
            "overlooked_reason": (
                "A famously strong creative-writing program in a very small, rural "
                "town keeps it under-applied relative to its literary alumni network."
            ),
            "angle": "Submit a writing portfolio/sample and highlight involvement in a literary magazine or writing workshop.",
        },
    },
    {
        "slug": "trinity-tx-engineering-science",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "ea": "2026-11-01",
                "rd": "2027-02-01",
                "source": "https://trinity.edu/admissions-aid/why-trinity/apply-now/application-types",
            },
            "name": "Trinity University",
            "state": "TX",
            "city": "San Antonio",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 63,
        "admit_rate": 0.30,
        "gpa_band": {"p25": 3.6, "p75": 3.9, "scale": 4.0},
        "sat_band": {"p25": 1280, "p75": 1440},
        "act_band": {"p25": 27, "p75": 32},
        "recommended_courses": ["AP Calculus BC", "AP Physics 1"],
        "gem_profile": {
            "overlooked_reason": (
                "Often overlooked in favor of larger Texas flagships despite small "
                "engineering cohorts with direct faculty research access."
            ),
            "angle": "Highlight a hands-on engineering/design project and interest in a small, research-integrated program.",
        },
    },
    {
        "slug": "rice-computer-science",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "rd": "2027-01-04",
                "note": "ED II also Jan 4, same as RD; no EA offered",
                "source": "https://admission.rice.edu/apply/first-year-domestic-applicants",
            },
            "name": "Rice University",
            "state": "TX",
            "city": "Houston",
            "type": "Private",
            "size": "Small",
        },
        "dept": "Computer Science",
        "category": "STEM",
        "ranking": 17,
        "admit_rate": 0.09,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1500, "p75": 1570},
        "act_band": {"p25": 34, "p75": 36},
        "recommended_courses": ["AP Calculus BC", "AP Computer Science A", "AP Physics C"],
        "gem_profile": None,
    },
    {
        "slug": "vanderbilt-engineering",
        "college": {
            "deadlines": {
                "ed": "2026-11-01",
                "rd": "2027-01-01",
                "note": "ED II also Jan 1, same as RD; no EA offered",
                "source": "https://admissions.vanderbilt.edu/apply/",
            },
            "name": "Vanderbilt University",
            "state": "TN",
            "city": "Nashville",
            "type": "Private",
            "size": "Medium",
        },
        "dept": "Engineering",
        "category": "STEM",
        "ranking": 18,
        "admit_rate": 0.07,
        "gpa_band": {"p25": 3.9, "p75": 4.0, "scale": 4.0},
        "sat_band": {"p25": 1470, "p75": 1560},
        "act_band": {"p25": 33, "p75": 35},
        "recommended_courses": ["AP Calculus BC", "AP Physics C"],
        "gem_profile": None,
    },
]


async def seed_colleges() -> dict[str, int]:
    created_colleges = 0
    created_programs = 0
    updated_programs = 0

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for row in SEED_PROGRAMS:
            college_defaults = {k: v for k, v in row["college"].items() if k != "name"}
            # `deadlines` is College-level JSON (Text column) but, unlike the
            # Program-level JSON fields below, has no downstream json.dumps
            # step of its own — encode it here if this row's college dict
            # carries one. Written as a plain dict literal in SEED_PROGRAMS
            # for readability, same as gpa_band/sat_band/etc.
            if "deadlines" in college_defaults:
                college_defaults["deadlines"] = json.dumps(college_defaults["deadlines"])
            result = await session.execute(
                select(College).where(College.name == row["college"]["name"])
            )
            college = result.scalar_one_or_none()
            if college is None:
                college = College(
                    name=row["college"]["name"],
                    country="US",
                    data_source="seed",
                    **college_defaults,
                )
                session.add(college)
                await session.flush()
                created_colleges += 1
            else:
                # Previously create-only — re-running this script against an
                # already-seeded DB silently ignored any college-level field
                # (e.g. a newly-added `deadlines`) despite the module
                # docstring's "idempotent, safe to re-run" claim. Program
                # fields already updated on rerun (see below); this makes
                # College fields do the same. `college_defaults` only ever
                # carries the exact keys present in this row's `college`
                # dict, so a row that doesn't set e.g. `deadlines` never
                # touches it here.
                for field, value in college_defaults.items():
                    setattr(college, field, value)

            result = await session.execute(select(Program).where(Program.slug == row["slug"]))
            program = result.scalar_one_or_none()
            program_fields = dict(
                college_id=college.id,
                dept=row["dept"],
                category=row["category"],
                ranking=row["ranking"],
                admit_rate=row["admit_rate"],
                gpa_band=json.dumps(row["gpa_band"]),
                sat_band=json.dumps(row["sat_band"]),
                act_band=json.dumps(row["act_band"]),
                recommended_courses=json.dumps(row["recommended_courses"]),
                gem_profile=json.dumps(row["gem_profile"]) if row["gem_profile"] else None,
                data_source="seed",
            )
            if program is None:
                session.add(Program(slug=row["slug"], **program_fields))
                created_programs += 1
            else:
                for field, value in program_fields.items():
                    setattr(program, field, value)
                updated_programs += 1

        await session.commit()

    summary = {
        "created_colleges": created_colleges,
        "created_programs": created_programs,
        "updated_programs": updated_programs,
        "total_seed_rows": len(SEED_PROGRAMS),
    }
    logger.info("Seed complete: %s", summary)
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_colleges())

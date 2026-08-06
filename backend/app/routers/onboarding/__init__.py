"""Onboarding API routers — docs/onboarding-flow-design.md §5.

Each module owns one resource's routes. `ROUTERS` lists them with their
sub-path (relative to the `/api/onboarding` prefix `app/main.py` applies)
and an OpenAPI tag, so `main.py` can wire all of them in one loop instead of
one `include_router` call per resource.
"""

from fastapi import APIRouter

from . import (
    academic_record,
    awards,
    certifications,
    completion_summary,
    connections,
    files,
    internships,
    progress,
    projects,
    recommendations,
    test_scores,
    volunteer,
)

ROUTERS: list[tuple[APIRouter, str, str]] = [
    (progress.router, "/progress", "onboarding-progress"),
    (academic_record.router, "/academic-record", "onboarding-academic-record"),
    (test_scores.router, "/test-scores", "onboarding-test-scores"),
    (volunteer.router, "/volunteer-experiences", "onboarding-volunteer"),
    (internships.router, "/internships", "onboarding-internships"),
    (projects.router, "/projects", "onboarding-projects"),
    (awards.router, "/awards", "onboarding-awards"),
    (recommendations.router, "/recommendations", "onboarding-recommendations"),
    (certifications.router, "/certifications", "onboarding-certifications"),
    (files.router, "/files", "onboarding-files"),
    (connections.router, "/connections", "onboarding-connections"),
    (completion_summary.router, "/completion-summary", "onboarding-completion-summary"),
]

__all__ = ["ROUTERS"]

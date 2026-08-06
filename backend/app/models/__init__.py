"""SQLAlchemy models package.

Import every model module here so `Base.metadata` sees all tables — this is
what `app/main.py`'s startup `create_all` call relies on.
"""

from .base import Base
from .onboarding import (
    AcademicRecord,
    Award,
    Certification,
    ExternalConnection,
    Internship,
    OnboardingProgress,
    PersonalProject,
    Recommendation,
    TestScore,
    UploadedFile,
    VolunteerExperience,
)
from .user import User
from .billing import Account, Subscription, StudentProfile
from .derived import ProfileSyncState, ReadinessScoreSnapshot, RoadmapItem, SpecSyncEvent
from .college import College, Program

__all__ = [
    "Base",
    "User",
    "OnboardingProgress",
    "AcademicRecord",
    "TestScore",
    "VolunteerExperience",
    "Internship",
    "PersonalProject",
    "Award",
    "Recommendation",
    "Certification",
    "UploadedFile",
    "ExternalConnection",
    "Account",
    "Subscription",
    "StudentProfile",
    "RoadmapItem",
    "ReadinessScoreSnapshot",
    "SpecSyncEvent",
    "ProfileSyncState",
    "College",
    "Program",
]

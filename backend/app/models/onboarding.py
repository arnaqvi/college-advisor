"""Onboarding flow tables — see docs/onboarding-flow-design.md §4.

SQLAlchemy 2.0 async models, subclassing the existing `Base`. All tables FK
to `users.id` (app/models/user.py).

Deviation from the design doc's literal code block: `AcademicRecord` gets an
extra `rigor_courses` column. §4's prose ("Legacy field mapping") explicitly
says AP/IB/Honors courses "fold into a rigor_courses JSON column on
academic_records", but that column was left out of the doc's own SQLAlchemy
snippet. Added here to make the model match the documented behavior; stored
as JSON-in-Text for the same reason `OnboardingProgress.completed_steps` is
(SQLite scaffold now, real JSONB on Postgres later).
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    current_step: Mapped[str] = mapped_column(String(50), default="welcome")
    completed_steps: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)


class AcademicRecord(Base):
    __tablename__ = "academic_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Non-nullable: per §1/§8, grad year (and a name, tracked on `users`) are the
    # only two true "blocker" fields in the entire onboarding flow.
    high_school_name: Mapped[str] = mapped_column(String(255))
    graduation_year: Mapped[int] = mapped_column(Integer)
    gpa: Mapped[float | None] = mapped_column(Numeric(3, 2), default=None)
    gpa_scale: Mapped[str] = mapped_column(String(10), default="4.0")
    class_rank: Mapped[str | None] = mapped_column(String(50), default=None)  # e.g. "45/320"
    # AP/IB/Honors course list, JSON-encoded (see module docstring).
    rigor_courses: Mapped[str | None] = mapped_column(Text, default=None)


class TestScore(Base):
    __tablename__ = "test_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    test_type: Mapped[str] = mapped_column(String(10))  # sat | act | psat
    test_date: Mapped[date | None] = mapped_column(Date, default=None)
    reading_score: Mapped[int | None] = mapped_column(Integer, default=None)
    writing_score: Mapped[int | None] = mapped_column(Integer, default=None)
    math_score: Mapped[int | None] = mapped_column(Integer, default=None)
    total_score: Mapped[int | None] = mapped_column(Integer, default=None)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual|college_board_sync


class VolunteerExperience(Base):
    __tablename__ = "volunteer_experiences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    organization: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255), default=None)
    start_date: Mapped[date | None] = mapped_column(Date, default=None)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)
    hours: Mapped[int | None] = mapped_column(Integer, default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    skills_learned: Mapped[str | None] = mapped_column(Text, default=None)
    reflection: Mapped[str | None] = mapped_column(Text, default=None)


class Internship(Base):
    __tablename__ = "internships"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    company: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255), default=None)
    start_date: Mapped[date | None] = mapped_column(Date, default=None)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)
    supervisor_name: Mapped[str | None] = mapped_column(String(255), default=None)
    responsibilities: Mapped[str | None] = mapped_column(Text, default=None)
    skills: Mapped[str | None] = mapped_column(Text, default=None)
    achievements: Mapped[str | None] = mapped_column(Text, default=None)


class PersonalProject(Base):
    __tablename__ = "personal_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    technologies: Mapped[str | None] = mapped_column(String(500), default=None)
    github_url: Mapped[str | None] = mapped_column(String(500), default=None)
    website_url: Mapped[str | None] = mapped_column(String(500), default=None)
    video_url: Mapped[str | None] = mapped_column(String(500), default=None)


class Award(Base):
    __tablename__ = "awards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    organization: Mapped[str | None] = mapped_column(String(255), default=None)
    award_date: Mapped[date | None] = mapped_column(Date, default=None)
    level: Mapped[str] = mapped_column(String(20))  # school|district|state|national|international
    description: Mapped[str | None] = mapped_column(Text, default=None)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    recommender_name: Mapped[str] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255), default=None)
    school_or_org: Mapped[str | None] = mapped_column(String(255), default=None)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    phone: Mapped[str | None] = mapped_column(String(50), default=None)
    relationship: Mapped[str] = mapped_column(String(50))  # teacher|coach|counselor|mentor|professor
    status: Mapped[str] = mapped_column(String(20), default="not_requested")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(100))  # google|microsoft|aws|coursera|...
    completion_date: Mapped[date | None] = mapped_column(Date, default=None)
    expiration_date: Mapped[date | None] = mapped_column(Date, default=None)
    credential_id: Mapped[str | None] = mapped_column(String(255), default=None)
    credential_url: Mapped[str | None] = mapped_column(String(500), default=None)


class UploadedFile(Base):
    """Polymorphic attachment — one table for every upload across all sections."""

    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    owner_type: Mapped[str] = mapped_column(String(30))  # transcript|test_score|volunteer|...
    owner_id: Mapped[int | None] = mapped_column(Integer, default=None)  # null: attaches to user
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(500))  # blob path, §6
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|complete
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ExternalConnection(Base):
    """Placeholder rows for future OAuth integrations — College Board, Parchment, Drive, etc."""

    __tablename__ = "external_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="not_connected")
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, default=None)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

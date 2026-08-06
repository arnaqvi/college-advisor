"""Application settings — Pydantic v2 settings management."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "College Advisor"
    environment: str = "local"
    debug: bool = True

    # Database — no schema/tables yet, wired in a later phase.
    # Defaults to a local SQLite file so the app runs without a real DB
    # during this scaffold phase. Point DATABASE_URL at Postgres later, e.g.
    # postgresql+asyncpg://user:password@host:5432/college_advisor
    database_url: str = "sqlite+aiosqlite:///./college_advisor.db"

    # Google OAuth — public self-serve login, added in a later phase.
    google_client_id: str = ""
    google_client_secret: str = ""

    cors_origins: list[str] = ["*"]

    # Onboarding file uploads (docs/onboarding-flow-design.md §6). When unset,
    # POST /api/onboarding/files falls back to a same-origin dev upload
    # endpoint that writes under `backend/uploads/` instead of generating a
    # real Azure Blob SAS URL — see app/core/storage.py.
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "onboarding-uploads"
    uploads_dir: str = "./uploads"

    # College Scorecard sync (app/services/scorecard_sync.py). Free key from
    # https://api.data.gov/signup/ — required for POST /api/colleges/sync to
    # do anything; when unset, the sync endpoint returns a structured
    # "not configured" response instead of hitting the API with no key.
    college_scorecard_api_key: str = ""
    college_scorecard_base_url: str = "https://api.data.gov/ed/collegescorecard/v1/schools"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — import and call this, do not instantiate Settings() directly."""
    return Settings()

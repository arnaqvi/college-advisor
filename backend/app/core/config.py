"""Application settings — Pydantic v2 settings management."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "College Advisor"
    environment: str = "local"
    debug: bool = True

    # Single source of truth for building browser-facing redirect URLs
    # (Stripe Checkout success/cancel, Google OAuth callback, password-reset
    # links). Set via `FRONTEND_BASE_URL` in production — previously each
    # call site branched on `environment == "local"` with its own hardcoded
    # production domain, which went stale after the migration off the
    # EvolveML platform (still pointed at the old
    # college-advisor.labs.evolveml.io instead of collegepath.io) and broke
    # silently whenever ENVIRONMENT itself wasn't set on the pod.
    frontend_base_url: str = "http://localhost:5173"

    # Database — no schema/tables yet, wired in a later phase.
    # Defaults to a local SQLite file so the app runs without a real DB
    # during this scaffold phase. Point DATABASE_URL at Postgres later, e.g.
    # postgresql+asyncpg://user:password@host:5432/college_advisor
    database_url: str = "sqlite+aiosqlite:///./college_advisor.db"

    # Google OAuth — real end-user login (backend/docs/user-stories.md story 1).
    # Self-service: Ahsan creates his own Google Cloud OAuth app and sets these
    # via `/set-app-env`. When either is unset, the Google login endpoints
    # respond with a structured "not configured" status instead of erroring —
    # same pattern as college_scorecard_api_key below — so the frontend can
    # show a disabled button rather than a broken one.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_url: str = "https://college-advisor.labs.evolveml.io/api/auth/google/callback"

    # Signs the session cookie (see app/core/security.py). MUST be set to a
    # stable value via `/set-app-env SESSION_SECRET_KEY=...` in production and
    # never regenerated on redeploy — rotating it invalidates every active
    # session. The default below is fine for local dev only.
    session_secret_key: str = "dev-insecure-session-secret-change-me"
    session_max_age_days: int = 30

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

    # Stripe (app/routers/billing.py's real Checkout integration). Self-service:
    # Ahsan creates his own Stripe account (test mode) and sets both via
    # `/set-app-env`. Unlike the string-default fields above, these default to
    # `None` rather than "" — they're secret material, not a dev convenience
    # default, so there is no fake-but-harmless placeholder value for them.
    # `None` means "not configured yet"; POST /api/billing/checkout reports a
    # structured not_configured response instead of calling Stripe with no key,
    # same pattern as google_client_id/college_scorecard_api_key above.
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None

    # Password-reset email delivery (app/core/email.py). Same self-service
    # pattern as the settings above: Ahsan sets these via `/set-app-env` when
    # he has real SMTP credentials. Until then, empty `smtp_host` means "not
    # configured" and send_password_reset_email() logs the reset link at INFO
    # level instead of emailing it (retrievable via the app-logs skill) —
    # matching the college_scorecard_api_key / azure_storage_connection_string
    # not-configured-fallback pattern rather than erroring.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "no-reply@college-advisor.labs.evolveml.io"

    # Contact Us / feedback form (app/routers/feedback.py) — where submissions
    # are sent. Reuses the smtp_* settings above for delivery.
    feedback_to_email: str = "admin@collegepath.io"

    password_reset_token_max_age_minutes: int = 60

    # AI Advisor chat (app/routers/advisor.py). Self-service: Ahsan provides
    # his own Anthropic API key via `/set-app-env`. Same not-configured
    # pattern as stripe_secret_key above — `None` means "not set yet", and
    # POST /api/advisor/chat reports a structured not_configured response
    # instead of calling the API with no key.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — import and call this, do not instantiate Settings() directly."""
    return Settings()

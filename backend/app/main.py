"""College Advisor — FastAPI application (app factory pattern)."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.models import onboarding as _onboarding_models  # noqa: F401
from app.models import user as _user_model  # noqa: F401
from app.models import password_reset as _password_reset_model  # noqa: F401
from app.models import billing as _billing_models  # noqa: F401
from app.models import derived as _derived_models  # noqa: F401
from app.models import college as _college_models  # noqa: F401
from app.models import profile as _profile_models  # noqa: F401
from app.models import tasks as _tasks_models  # noqa: F401
from app.models.base import Base
from app.routers.onboarding import ROUTERS as onboarding_routers
from app.services import register_sync_handlers

# The two imports above (unused directly) must happen before `create_all`
# runs in `lifespan` below, so `Base.metadata` knows about every table — see
# app/models/__init__.py, which imports the same modules for the same reason.


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables if they don't exist yet, then run the app.

    No Alembic is configured in this repo yet (scaffold phase, SQLite
    default per app/core/config.py) — `create_all` is the documented
    stand-in until a real migration tool is wired up. It is a no-op for
    tables that already exist and never drops/alters existing ones, so it's
    safe to run on every startup.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_user_name_column()
    await _ensure_subscription_billing_interval_column()
    # Register sync handlers after tables are created
    register_sync_handlers()
    await _seed_colleges_if_empty()
    yield


async def _ensure_user_name_column() -> None:
    """`users.name` was added after the `users` table already existed in
    production — `create_all` only creates missing *tables*, never alters
    columns on ones that already exist, so it won't add this on its own.
    Same no-Alembic-yet situation as `_seed_colleges_if_empty` below; this is
    the equivalent lightweight, idempotent step for a column instead of a
    table. Works on both SQLite (local dev) and Postgres (production).
    """
    from sqlalchemy import inspect, text

    async with engine.begin() as conn:
        columns = await conn.run_sync(lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("users")])
        if "name" not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(255)"))


async def _ensure_subscription_billing_interval_column() -> None:
    """`subscriptions.billing_interval` was added after the `subscriptions`
    table already existed in production (the repricing/annual-plan work) —
    same `create_all`-won't-alter-existing-tables situation as
    `_ensure_user_name_column` above. Existing rows default to `'month'`,
    which matches every subscription granted before this column existed
    (annual billing didn't exist yet, so they were all monthly).
    """
    from sqlalchemy import inspect, text

    async with engine.begin() as conn:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("subscriptions")]
        )
        if "billing_interval" not in columns:
            await conn.execute(
                text(
                    "ALTER TABLE subscriptions ADD COLUMN billing_interval "
                    "VARCHAR(10) DEFAULT 'month'"
                )
            )


async def _seed_colleges_if_empty() -> None:
    """Populate the initial 13-school college directory on first boot.

    Deploys go through the BFF's server-side build (see repo CLAUDE.md) —
    there is no kubectl/pod-exec access from the workspace to run
    `app/migrations/seed_colleges.py` manually against a freshly-provisioned
    environment (Mandatory Rule 1: no labs-kubectl). Running the (idempotent,
    upsert-based) seed here, gated on "no programs exist yet", makes a fresh
    deploy self-populating without needing any out-of-band step, while still
    only ever running its actual insert/update work once per empty database.
    """
    from sqlalchemy import func, select

    from app.core.database import AsyncSessionLocal
    from app.migrations.seed_colleges import seed_colleges
    from app.models.college import Program

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count()).select_from(Program))
        count = result.scalar_one()

    if count == 0:
        await seed_colleges()


def create_app() -> FastAPI:
    """Application factory — builds and configures the FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="College admissions planning tool for students and parents.",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Only used by authlib to hold the Google OAuth state/nonce between the
    # /google/login redirect and /google/callback — a short-lived, separate
    # cookie from our own real session cookie (app/core/security.py's
    # SESSION_COOKIE_NAME="session"); named distinctly here so the two never
    # collide.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret_key,
        session_cookie="oauth_state",
        max_age=600,
    )

    for router, prefix, tag in onboarding_routers:
        app.include_router(router, prefix=f"/api/onboarding{prefix}", tags=[tag])
    # Billing/demo routes
    from app.routers.auth import router as auth_router
    from app.routers.billing import router as billing_router
    from app.routers.sync import router as sync_router
    from app.routers.colleges import router as colleges_router
    from app.routers.profile import router as profile_router
    from app.routers.advisor import router as advisor_router
    from app.routers.bias_research import router as bias_research_router
    from app.routers.tasks import router as tasks_router
    from app.routers.feedback import router as feedback_router

    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
    app.include_router(sync_router, tags=["sync"])
    app.include_router(colleges_router, tags=["colleges"])
    app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
    app.include_router(advisor_router, prefix="/api/advisor", tags=["advisor"])
    app.include_router(bias_research_router, prefix="/api/bias-research", tags=["bias-research"])
    app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
    app.include_router(feedback_router, prefix="/api/feedback", tags=["feedback"])

    @app.get("/")
    async def root() -> dict[str, str]:
        """Application root — returns app info."""
        return {
            "app": settings.app_name,
            "status": "running",
            "docs": "/docs",
        }

    @app.get("/health")
    async def health() -> JSONResponse:
        """Health check endpoint for Kubernetes liveness/readiness probes."""
        return JSONResponse(content={"status": "healthy"}, status_code=200)

    return app


app = create_app()

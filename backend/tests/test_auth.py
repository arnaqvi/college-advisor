"""Tests for /api/auth/* — register, login, logout, me.

Covers the real auth system replacing the old X-User-Email dev placeholder.
"""

from datetime import datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.routers.auth as auth_router
from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.billing import Account, Subscription
from app.models.password_reset import PasswordResetToken


@pytest.fixture
async def test_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with session_maker() as session:
            yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        await engine.dispose()


@pytest.mark.asyncio
async def test_register_creates_free_account_and_session(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "Student@Example.com",
                "password": "correct horse battery",
                "name": "Jamie Student",
                "role": "student",
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body == {"email": "student@example.com", "name": "Jamie Student", "role": "student", "tier": "free"}

        # session cookie was set — /me works without any extra header
        me = await client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "student@example.com"


@pytest.mark.asyncio
async def test_register_with_paid_plan_still_grants_free_tier(test_session: AsyncSession) -> None:
    """`plan` in the register payload must never grant paid tier directly —
    that field only drives the frontend's post-signup checkout redirect.
    Paid tier is only ever earned via `POST /checkout` + `GET
    /checkout/verify` after real Stripe payment (see upsert_subscription_for_user's
    callers in auth.py, and billing.py's `subscribe()` for the same guard)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={
                "email": "family@example.com",
                "password": "correct horse battery",
                "name": "Family Plan",
                "role": "parent",
                "plan": "family",
            },
        )
        assert response.status_code == 200
        assert response.json()["tier"] == "free"


@pytest.mark.asyncio
async def test_register_duplicate_email_rejected(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "email": "dupe@example.com",
            "password": "correct horse battery",
            "name": "First",
            "role": "student",
        }
        first = await client.post("/api/auth/register", json=payload)
        assert first.status_code == 200

        second = await client.post("/api/auth/register", json={**payload, "name": "Second"})
        assert second.status_code == 409


@pytest.mark.asyncio
async def test_login_round_trip(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as register_client:
        await register_client.post(
            "/api/auth/register",
            json={
                "email": "login-test@example.com",
                "password": "correct horse battery",
                "name": "Login Test",
                "role": "student",
            },
        )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # No session yet on this fresh client
        assert (await client.get("/api/auth/me")).status_code == 401

        login = await client.post(
            "/api/auth/login",
            json={"email": "login-test@example.com", "password": "correct horse battery"},
        )
        assert login.status_code == 200
        assert login.json()["email"] == "login-test@example.com"

        assert (await client.get("/api/auth/me")).status_code == 200

        await client.post("/api/auth/logout")
        assert (await client.get("/api/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_login_wrong_password_and_unknown_email_both_generic(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={
                "email": "real@example.com",
                "password": "correct horse battery",
                "name": "Real User",
                "role": "student",
            },
        )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        wrong_password = await client.post(
            "/api/auth/login", json={"email": "real@example.com", "password": "nope"}
        )
        unknown_email = await client.post(
            "/api/auth/login", json={"email": "nobody@example.com", "password": "nope"}
        )

    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


@pytest.mark.asyncio
async def test_register_creates_billing_subscription(test_session: AsyncSession) -> None:
    """Bridges Subscription <-> User.tier — see upsert_subscription_for_user.
    Always `free` regardless of the requested plan (see
    test_register_with_paid_plan_still_grants_free_tier) — a paid `plan`
    value only takes effect after checkout, never at registration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={
                "email": "billing-check@example.com",
                "password": "correct horse battery",
                "name": "Billing Check",
                "role": "student",
                "plan": "individual",
            },
        )

    result = await test_session.execute(select(Account).where(Account.name == "billing-check@example.com"))
    account = result.scalar_one()
    result = await test_session.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one()
    assert subscription.plan == "free"
    assert subscription.status == "active"


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_returns_generic_ok(test_session: AsyncSession) -> None:
    """Anti-enumeration: no account for this email, still a plain 200/ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_forgot_password_reset_password_round_trip(test_session: AsyncSession, monkeypatch) -> None:
    """The full recovery loop a locked-out legacy account (no password_hash,
    per the 2026-08-06 real-auth migration) needs: request a link, use its
    token to set a new password, then log in with it."""
    captured = {}

    def fake_send(to_email: str, token: str) -> None:
        captured["email"] = to_email
        captured["token"] = token

    monkeypatch.setattr(auth_router, "send_password_reset_email", fake_send)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={
                "email": "reset-me@example.com",
                "password": "original password",
                "name": "Reset Me",
                "role": "student",
            },
        )
        await client.post("/api/auth/logout")

        forgot = await client.post("/api/auth/forgot-password", json={"email": "reset-me@example.com"})
        assert forgot.status_code == 200
        assert captured["email"] == "reset-me@example.com"

        reset = await client.post(
            "/api/auth/reset-password",
            json={"token": captured["token"], "password": "brand new password"},
        )
        assert reset.status_code == 200, reset.text
        assert reset.json()["email"] == "reset-me@example.com"

        # reset-password already signs the user in (fresh session cookie) —
        # /me should work immediately with no separate login call.
        assert (await client.get("/api/auth/me")).status_code == 200

        await client.post("/api/auth/logout")
        old_password_login = await client.post(
            "/api/auth/login", json={"email": "reset-me@example.com", "password": "original password"}
        )
        assert old_password_login.status_code == 401

        new_password_login = await client.post(
            "/api/auth/login", json={"email": "reset-me@example.com", "password": "brand new password"}
        )
        assert new_password_login.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_garbage_token_rejected(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/reset-password", json={"token": "not-a-real-token", "password": "whatever password"}
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_expired_token_rejected(test_session: AsyncSession, monkeypatch) -> None:
    captured = {}
    monkeypatch.setattr(
        auth_router, "send_password_reset_email", lambda to_email, token: captured.update(token=token)
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={
                "email": "expired-token@example.com",
                "password": "original password",
                "name": "Expired Token",
                "role": "student",
            },
        )
        await client.post("/api/auth/forgot-password", json={"email": "expired-token@example.com"})

    # Force the freshly-created token into the past.
    result = await test_session.execute(select(PasswordResetToken))
    reset_token = result.scalars().one()
    reset_token.expires_at = datetime.utcnow() - timedelta(minutes=1)
    await test_session.commit()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/reset-password", json={"token": captured["token"], "password": "whatever password"}
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_token_is_single_use(test_session: AsyncSession, monkeypatch) -> None:
    captured = {}
    monkeypatch.setattr(
        auth_router, "send_password_reset_email", lambda to_email, token: captured.update(token=token)
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={
                "email": "single-use@example.com",
                "password": "original password",
                "name": "Single Use",
                "role": "student",
            },
        )
        await client.post("/api/auth/forgot-password", json={"email": "single-use@example.com"})

        first = await client.post(
            "/api/auth/reset-password", json={"token": captured["token"], "password": "first new password"}
        )
        assert first.status_code == 200

        second = await client.post(
            "/api/auth/reset-password", json={"token": captured["token"], "password": "second new password"}
        )
        assert second.status_code == 400

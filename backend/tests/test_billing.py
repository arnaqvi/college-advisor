"""Tests for /api/billing/* — the real Stripe Checkout integration.

Covers the paths that don't need a live Stripe account: `not_configured`
responses (this workspace has no STRIPE_SECRET_KEY set anywhere, same
situation as `college_scorecard_api_key` in test_colleges.py), the
plan-validation 400s, the locked-down `/subscribe` endpoint, and the
Stripe-call paths with `stripe.Customer`/`stripe.checkout.Session` monkeypatched
(no real Stripe account needed to verify request-shaping and the
grant-only-after-verified-payment logic).
"""

from types import SimpleNamespace

import pytest
import stripe
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.user import User


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


async def _register_and_login(client: AsyncClient, email: str = "billing@example.com") -> None:
    response = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "correct horse battery",
            "name": "Billing Test",
            "role": "student",
        },
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_checkout_reports_not_configured_without_stripe_key(test_session: AsyncSession) -> None:
    """No STRIPE_SECRET_KEY is set anywhere in this workspace — checkout must
    report a structured not_configured response instead of calling Stripe.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/checkout", json={"plan": "individual"})

    assert response.status_code == 400
    assert response.json()["detail"]["status"] == "not_configured"


@pytest.mark.asyncio
async def test_verify_reports_not_configured_without_stripe_key(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_whatever"})

    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


@pytest.mark.asyncio
async def test_checkout_rejects_free_plan(test_session: AsyncSession) -> None:
    """Free needs no payment — checkout should point callers at /subscribe
    instead of trying to bill $0.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/checkout", json={"plan": "free"})

    assert response.status_code == 400
    assert "subscribe" in response.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_rejects_counselor_plan(test_session: AsyncSession) -> None:
    """Counsellor plans are "Custom"/manually provisioned, not self-serve checkout."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/checkout", json={"plan": "counselor"})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_subscribe_rejects_paid_plan(test_session: AsyncSession) -> None:
    """The old scaffold let /subscribe flip tier to "paid" for any plan with
    no payment collected. Now that real payment verification exists via
    Checkout, /subscribe must refuse paid plans.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/subscribe", json={"plan": "individual"})
        assert response.status_code == 400

        me = await client.get("/api/auth/me")
        assert me.json()["tier"] == "free"  # never granted


@pytest.mark.asyncio
async def test_subscribe_still_allows_free_plan(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/subscribe", json={"plan": "free"})

    assert response.status_code == 200
    assert response.json()["plan"] == "free"


@pytest.mark.asyncio
async def test_checkout_creates_session_and_reuses_stripe_customer(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With Stripe "configured" (monkeypatched — no real Stripe account
    needed), checkout should create a Customer once and a subscription-mode
    Checkout Session with inline `price_data` (see billing.py's module
    docstring for why price_data, not a pre-created Price id).
    """
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    customer_calls = []
    session_calls = []

    def fake_customer_create(**kwargs):
        customer_calls.append(kwargs)
        return SimpleNamespace(id="cus_fake123")

    def fake_session_create(**kwargs):
        session_calls.append(kwargs)
        return SimpleNamespace(url="https://checkout.stripe.com/fake-session")

    monkeypatch.setattr(stripe.Customer, "create", staticmethod(fake_customer_create))
    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(fake_session_create))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post("/api/billing/checkout", json={"plan": "individual"})

    assert response.status_code == 200, response.text
    assert response.json() == {"checkout_url": "https://checkout.stripe.com/fake-session"}
    assert len(customer_calls) == 1
    assert session_calls[0]["mode"] == "subscription"
    assert session_calls[0]["customer"] == "cus_fake123"
    assert session_calls[0]["line_items"][0]["price_data"]["unit_amount"] == 900


@pytest.mark.asyncio
async def test_verify_grants_plan_only_after_paid_status(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)

        # Look up the just-registered user's id directly from the DB to build
        # a matching fake Stripe session (metadata is normally set by our own
        # /checkout call, keyed on the real user id).
        result = await test_session.execute(select(User).where(User.email == "billing@example.com"))
        user = result.scalar_one()

        def fake_retrieve_pending(session_id, api_key=None):
            return SimpleNamespace(
                metadata={"user_id": str(user.id), "plan": "individual"},
                client_reference_id=str(user.id),
                payment_status="unpaid",
                subscription=None,
            )

        monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_pending))
        pending = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_1"})
        assert pending.status_code == 200
        assert pending.json()["status"] == "pending"

        def fake_retrieve_paid(session_id, api_key=None):
            return SimpleNamespace(
                metadata={"user_id": str(user.id), "plan": "individual"},
                client_reference_id=str(user.id),
                payment_status="paid",
                subscription="sub_fake123",
            )

        monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_paid))
        paid = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_1"})

        assert paid.status_code == 200
        assert paid.json() == {"status": "paid", "plan": "individual", "message": None}

    await test_session.refresh(user)
    assert user.tier == "paid"


class _RealShapeStripeMetadata:
    """Mimics the REAL stripe-python StripeObject shape for `.metadata`
    (see stripe._stripe_object.StripeObject) — no `.get()`, only `.to_dict()`.

    The other fakes in this file use a plain `dict` for `.metadata`, which
    has `.get()` and so never exercised the real bug: production code did
    `session.metadata.get(...)`, but a real Stripe SDK response's `.metadata`
    is a StripeObject, not a dict, and has no `.get()` — this raised
    AttributeError at runtime (caught 2026-08-09 against a real Stripe test
    account, not by these mocked tests). This fake reproduces that exact
    shape so the regression can't silently come back.
    """

    def __init__(self, data: dict[str, str]) -> None:
        self._data = data

    def to_dict(self) -> dict[str, str]:
        return dict(self._data)


@pytest.mark.asyncio
async def test_verify_handles_real_stripe_object_metadata_shape(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)

        result = await test_session.execute(select(User).where(User.email == "billing@example.com"))
        user = result.scalar_one()

        def fake_retrieve_paid(session_id, api_key=None):
            return SimpleNamespace(
                metadata=_RealShapeStripeMetadata({"user_id": str(user.id), "plan": "individual"}),
                client_reference_id=str(user.id),
                payment_status="paid",
                subscription="sub_fake123",
            )

        monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_paid))
        response = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_1"})

        assert response.status_code == 200, response.text
        assert response.json() == {"status": "paid", "plan": "individual", "message": None}

    await test_session.refresh(user)
    assert user.tier == "paid"


@pytest.mark.asyncio
async def test_verify_rejects_session_belonging_to_another_user(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    def fake_retrieve(session_id, api_key=None):
        return SimpleNamespace(
            metadata={"user_id": "999999", "plan": "individual"},
            client_reference_id="999999",
            payment_status="paid",
            subscription=None,
        )

    monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_2"})

    assert response.status_code == 403


async def _register_and_grant_paid_subscription(
    client: AsyncClient, test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> User:
    """Get a user through the real /checkout/verify path so their Subscription
    row ends up with a `stripe_subscription_id`, matching production shape —
    the /cancel tests below need that id populated to exercise the Stripe call.
    """
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    await _register_and_login(client)
    result = await test_session.execute(select(User).where(User.email == "billing@example.com"))
    user = result.scalar_one()

    def fake_retrieve_paid(session_id, api_key=None):
        return SimpleNamespace(
            metadata={"user_id": str(user.id), "plan": "individual"},
            client_reference_id=str(user.id),
            payment_status="paid",
            subscription="sub_fake123",
        )

    monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_paid))
    response = await client.get("/api/billing/checkout/verify", params={"session_id": "cs_test_1"})
    assert response.status_code == 200
    assert response.json()["status"] == "paid"
    return user


@pytest.mark.asyncio
async def test_cancel_cancels_the_real_stripe_subscription(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """/cancel must actually stop Stripe billing, not just flip local DB
    fields — this is the fix for the bug where users kept being charged
    after "canceling" in-app.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user = await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        cancel_calls = []

        def fake_cancel(subscription_id, api_key=None):
            cancel_calls.append(subscription_id)
            return SimpleNamespace(id=subscription_id, status="canceled")

        monkeypatch.setattr(stripe.Subscription, "cancel", staticmethod(fake_cancel))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert cancel_calls == ["sub_fake123"]
    assert response.json()["status"] == "canceled"

    await test_session.refresh(user)
    assert user.tier == "free"


@pytest.mark.asyncio
async def test_cancel_treats_already_canceled_stripe_subscription_as_success(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If Stripe already has no such subscription (e.g. canceled manually in
    the dashboard already), don't block the user's local state from clearing.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        def fake_cancel(subscription_id, api_key=None):
            raise stripe.InvalidRequestError(
                "No such subscription: 'sub_fake123'", param="id", code="resource_missing"
            )

        monkeypatch.setattr(stripe.Subscription, "cancel", staticmethod(fake_cancel))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "canceled"


@pytest.mark.asyncio
async def test_cancel_surfaces_other_stripe_errors_without_clearing_local_state(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A real Stripe failure (not "already gone") must not silently revoke
    the user's access while Stripe is still billing them — surface the error
    instead of clearing local state out from under a still-active real sub.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user = await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        def fake_cancel(subscription_id, api_key=None):
            raise stripe.APIConnectionError("network blip")

        monkeypatch.setattr(stripe.Subscription, "cancel", staticmethod(fake_cancel))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 502

    await test_session.refresh(user)
    assert user.tier == "paid"  # unchanged — Stripe cancel failed, so local state must not flip


@pytest.mark.asyncio
async def test_cancel_without_stripe_subscription_id_skips_stripe_call(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Free-plan subscriptions (from /subscribe) never get a
    stripe_subscription_id — cancel must still work locally without trying
    to call Stripe with nothing to cancel.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.post("/api/billing/subscribe", json={"plan": "free"})

        def fail_if_called(*args, **kwargs):
            raise AssertionError("stripe.Subscription.cancel should not be called")

        monkeypatch.setattr(stripe.Subscription, "cancel", staticmethod(fail_if_called))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "canceled"

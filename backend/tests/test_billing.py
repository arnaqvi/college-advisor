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
    assert session_calls[0]["line_items"][0]["price_data"]["unit_amount"] == 1900
    assert session_calls[0]["line_items"][0]["price_data"]["recurring"]["interval"] == "month"
    assert session_calls[0]["metadata"]["interval"] == "month"


@pytest.mark.asyncio
async def test_checkout_creates_annual_session_at_annual_price(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`interval: "year"` must price off the annual amount ($79/yr for
    individual, not 12x the monthly $19) and tell Stripe to bill yearly.
    """
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    session_calls = []

    monkeypatch.setattr(
        stripe.Customer, "create", staticmethod(lambda **kwargs: SimpleNamespace(id="cus_fake123"))
    )

    def fake_session_create(**kwargs):
        session_calls.append(kwargs)
        return SimpleNamespace(url="https://checkout.stripe.com/fake-session")

    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(fake_session_create))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.post(
            "/api/billing/checkout", json={"plan": "family", "interval": "year"}
        )

    assert response.status_code == 200, response.text
    assert session_calls[0]["line_items"][0]["price_data"]["unit_amount"] == 14900
    assert session_calls[0]["line_items"][0]["price_data"]["recurring"]["interval"] == "year"
    assert session_calls[0]["metadata"]["interval"] == "year"


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


@pytest.mark.asyncio
async def test_verify_persists_annual_billing_interval_and_period(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An annual checkout must land as `billing_interval: "year"` with a
    ~365-day period, not the 30-day default — and `GET /api/billing/` must
    surface that interval so the Pricing page can show "Billed annually".
    """
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        result = await test_session.execute(select(User).where(User.email == "billing@example.com"))
        user = result.scalar_one()

        def fake_retrieve_paid(session_id, api_key=None):
            return SimpleNamespace(
                metadata={"user_id": str(user.id), "plan": "individual", "interval": "year"},
                client_reference_id=str(user.id),
                payment_status="paid",
                subscription="sub_fake_annual",
            )

        monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_paid))
        verify_response = await client.get(
            "/api/billing/checkout/verify", params={"session_id": "cs_test_annual"}
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["status"] == "paid"

        billing_response = await client.get("/api/billing/")
        subscription = billing_response.json()["subscription"]
        assert subscription["billing_interval"] == "year"

    from datetime import datetime

    period_end = datetime.fromisoformat(subscription["current_period_end"])
    days_out = (period_end - datetime.utcnow()).days
    assert 350 <= days_out <= 365  # ~365 days, not the 30-day monthly default


@pytest.mark.asyncio
async def test_verify_old_session_without_interval_metadata_defaults_to_monthly(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A checkout session created before the annual plan shipped has no
    "interval" key in its metadata at all — verify must still succeed and
    treat it as monthly, not reject it as an unrecognized plan.
    """
    fake_settings = get_settings().model_copy(update={"stripe_secret_key": "sk_test_fake"})
    monkeypatch.setattr("app.routers.billing.get_settings", lambda: fake_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        result = await test_session.execute(select(User).where(User.email == "billing@example.com"))
        user = result.scalar_one()

        def fake_retrieve_paid(session_id, api_key=None):
            return SimpleNamespace(
                metadata={"user_id": str(user.id), "plan": "individual"},  # no "interval" key
                client_reference_id=str(user.id),
                payment_status="paid",
                subscription="sub_fake_pre_annual",
            )

        monkeypatch.setattr(stripe.checkout.Session, "retrieve", staticmethod(fake_retrieve_paid))
        response = await client.get(
            "/api/billing/checkout/verify", params={"session_id": "cs_test_pre_annual"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "paid"

        billing_response = await client.get("/api/billing/")
        assert billing_response.json()["subscription"]["billing_interval"] == "month"


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
async def test_cancel_schedules_stripe_cancellation_and_keeps_access_until_period_end(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """/cancel must schedule cancellation (`cancel_at_period_end=True` via
    Stripe's `modify`, not an immediate `.cancel()`) and keep the user's tier
    at "paid" — someone who prepaid a year and cancels after two months keeps
    the other ten instead of losing access the moment they click cancel.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user = await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        modify_calls = []

        def fake_modify(subscription_id, cancel_at_period_end=None, api_key=None):
            modify_calls.append((subscription_id, cancel_at_period_end))
            return SimpleNamespace(id=subscription_id, cancel_at_period_end=cancel_at_period_end)

        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(fake_modify))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert modify_calls == [("sub_fake123", True)]
    body = response.json()
    assert body["status"] == "active"  # NOT canceled yet — access continues
    assert body["billing_interval"] == "month"

    await test_session.refresh(user)
    assert user.tier == "paid"  # unchanged — the paid-for period hasn't ended


@pytest.mark.asyncio
async def test_reconcile_flips_tier_once_scheduled_cancellation_period_ends(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The other half of the deferred-cancellation story: once
    `current_period_end` has actually passed, the next authenticated read
    (GET /api/auth/me here) must self-heal tier/status to free/canceled —
    this app has no inbound Stripe webhook to do it any other way.
    """
    from datetime import datetime, timedelta

    from sqlalchemy import select as sa_select

    from app.models.billing import Account, Subscription

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user = await _register_and_grant_paid_subscription(client, test_session, monkeypatch)
        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(lambda *a, **k: SimpleNamespace()))
        await client.post("/api/billing/cancel")

        # Backdate current_period_end into the past, as if the paid period
        # genuinely ended, without waiting 30 real days in a test.
        result = await test_session.execute(sa_select(Account).where(Account.owner_user_id == user.id))
        account = result.scalar_one()
        result = await test_session.execute(
            sa_select(Subscription).where(Subscription.account_id == account.id)
        )
        subscription = result.scalar_one()
        subscription.current_period_end = datetime.utcnow() - timedelta(days=1)
        await test_session.commit()

        me_response = await client.get("/api/auth/me")

    assert me_response.status_code == 200
    assert me_response.json()["tier"] == "free"

    await test_session.refresh(user)
    assert user.tier == "free"
    await test_session.refresh(subscription)
    assert subscription.status == "canceled"


@pytest.mark.asyncio
async def test_cancel_treats_already_canceled_stripe_subscription_as_success(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If Stripe already has no such subscription (e.g. canceled manually in
    the dashboard already), fall back to clearing local state immediately —
    there's no real future period left to honor.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user = await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        def fake_modify(subscription_id, cancel_at_period_end=None, api_key=None):
            raise stripe.InvalidRequestError(
                "No such subscription: 'sub_fake123'", param="id", code="resource_missing"
            )

        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(fake_modify))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "canceled"

    await test_session.refresh(user)
    assert user.tier == "free"


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

        def fake_modify(subscription_id, cancel_at_period_end=None, api_key=None):
            raise stripe.APIConnectionError("network blip")

        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(fake_modify))

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
    to call Stripe with nothing to cancel, and clears immediately since
    there's no prepaid period to honor.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.post("/api/billing/subscribe", json={"plan": "free"})

        def fail_if_called(*args, **kwargs):
            raise AssertionError("stripe.Subscription.modify should not be called")

        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(fail_if_called))

        response = await client.post("/api/billing/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "canceled"


@pytest.mark.asyncio
async def test_retention_offer_applies_coupon_to_active_subscription(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The cancel-flow win-back offer: a one-time 50%-off coupon applied to
    the user's existing Stripe subscription, with no local state change.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_grant_paid_subscription(client, test_session, monkeypatch)

        coupon_calls = []
        modify_calls = []

        def fake_coupon_create(percent_off=None, duration=None, api_key=None):
            coupon_calls.append((percent_off, duration))
            return SimpleNamespace(id="coupon_fake50")

        def fake_modify(subscription_id, discounts=None, api_key=None):
            modify_calls.append((subscription_id, discounts))
            return SimpleNamespace(id=subscription_id)

        monkeypatch.setattr(stripe.Coupon, "create", staticmethod(fake_coupon_create))
        monkeypatch.setattr(stripe.Subscription, "modify", staticmethod(fake_modify))

        response = await client.post("/api/billing/retention-offer")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "applied"
    assert coupon_calls == [(50, "once")]
    assert modify_calls == [("sub_fake123", [{"coupon": "coupon_fake50"}])]


@pytest.mark.asyncio
async def test_retention_offer_rejects_free_plan_with_no_subscription(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Nothing to discount on the free plan — no Stripe call, a clear 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.post("/api/billing/subscribe", json={"plan": "free"})

        def fail_if_called(*args, **kwargs):
            raise AssertionError("Stripe should not be called for a free-plan account")

        monkeypatch.setattr(stripe.Coupon, "create", staticmethod(fail_if_called))

        response = await client.post("/api/billing/retention-offer")

    assert response.status_code == 400

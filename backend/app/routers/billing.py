"""Billing endpoints.

`POST /checkout` + `GET /checkout/verify` below are the real Stripe
integration: a hosted Stripe Checkout session is created for the signed-in
user, and a plan is only ever granted after this backend independently
verifies with Stripe (server-to-server) that the session actually paid. This
app sits behind the platform's Microsoft oauth2-proxy at the edge, which
blocks unauthenticated inbound calls — so there is deliberately no inbound
Stripe *webhook* handler here; verification happens on the success-redirect
instead (see `verify_checkout_session`).

`POST /subscribe` predates the Stripe integration and is kept only for the
`free` plan (new-account default / downgrade path, which never needed
payment). It used to accept any plan and flip `User.tier` to "paid" with
no payment collected at all — now that real payment verification exists via
Checkout, granting a *paid* plan through this endpoint would let anyone get
a paid tier for free, so it now rejects non-free plans. See `subscribe()`.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, cast

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.billing import Account, Subscription
from app.models.user import User
from app.schemas.auth import Plan
from app.services.meta_capi import send_purchase_event

router = APIRouter()

BillingInterval = Literal["month", "year"]

# Stripe Prices for `individual`/`family` are created inline at checkout-time
# via `price_data` (see `create_checkout_session`) rather than referencing
# pre-created Stripe Price IDs. There is no Stripe dashboard access from this
# workspace yet (self-service, per the platform note in the repo root
# CLAUDE.md) so no real Price IDs exist to reference, and inventing fake ones
# to hardcode would silently break checkout the moment Stripe is configured.
# `price_data` needs no pre-created Price object and works fine for
# `mode="subscription"` (Stripe supports recurring `price_data` for exactly
# this case) — this sidesteps the missing-Price-ID gap entirely instead of
# adding a second layer of "not configured" config. `free` and `counselor`
# are deliberately absent: `free` needs no payment, and `counselor` is
# "Custom"/manually provisioned (see frontend/src/data/plans.js), not
# self-serve checkout.
#
# Prices set 2026-09-11 per the competitive pricing review (annual amounts
# are a steep ~65% discount off 12x monthly — "8 months free" — deliberately
# closer to short-lifecycle consumer-app annual pricing than the ~17% SaaS
# norm, since a student's active usage window is ~18 months, not indefinite).
# This only affects *new* checkouts — Stripe subscriptions already created
# keep whatever price_data they were built with, so existing subscribers are
# unaffected without any extra migration.
@dataclass(frozen=True)
class _PlanPricing:
    unit_amount: int  # USD cents
    label: str


_CHECKOUT_PLAN_PRICING: dict[tuple[str, BillingInterval], _PlanPricing] = {
    ("individual", "month"): _PlanPricing(unit_amount=1900, label="Student — Monthly"),
    ("individual", "year"): _PlanPricing(unit_amount=7900, label="Student — Annual"),
    ("family", "month"): _PlanPricing(unit_amount=3900, label="Family — Monthly"),
    ("family", "year"): _PlanPricing(unit_amount=14900, label="Family — Annual"),
}


def _frontend_base_url() -> str:
    """Where to send the browser back to after Checkout."""
    return get_settings().frontend_base_url


class SubscriptionIn(BaseModel):
    plan: Plan


async def upsert_subscription_for_user(
    db: AsyncSession, user: User, plan: Plan, interval: BillingInterval = "month"
) -> Subscription:
    """Get-or-create the user's Account, upsert their single Subscription row
    to `plan`/`interval` with no real payment collected (tier-logic-only
    phase — see docs/user-stories.md and the auth redesign plan), and bridge
    the result onto `User.tier` so every other endpoint has a single,
    already-resolved field to check instead of needing its own billing
    lookup. Shared by POST /api/auth/register (plan chosen at signup, always
    `free` so `interval` is irrelevant there) and POST /subscribe below.
    """
    result = await db.execute(select(Account).where(Account.owner_user_id == user.id))
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(owner_user_id=user.id, name=user.email)
        db.add(account)
        await db.flush()

    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    now = datetime.utcnow()
    period_length = timedelta(days=365) if interval == "year" else timedelta(days=30)
    if subscription is None:
        subscription = Subscription(
            account_id=account.id,
            plan=plan,
            billing_interval=interval,
            status="active",
            current_period_end=now + period_length,
            trial_end=None,
            cancel_at_period_end=False,
        )
        db.add(subscription)
    else:
        subscription.plan = plan
        subscription.billing_interval = interval
        subscription.status = "active"
        subscription.current_period_end = now + period_length
        subscription.cancel_at_period_end = False
        subscription.updated_at = now

    user.tier = "free" if plan == "free" else "paid"

    await db.commit()
    await db.refresh(subscription)
    return subscription


class AccountOut(BaseModel):
    id: int
    name: str
    stripe_customer_id: str | None


class SubscriptionOut(BaseModel):
    id: int
    plan: str
    billing_interval: str
    status: str
    current_period_end: datetime | None
    trial_end: datetime | None


@router.get("/", response_model=dict)
async def get_billing(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    await reconcile_expired_cancellation(db, current_user)
    # Fetch or create an Account for the current user
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(
            owner_user_id=current_user.id, name=current_user.email, stripe_customer_id=None
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)

    # Fetch subscription if present
    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()

    return {
        "account": {
            "id": account.id,
            "name": account.name,
            "stripe_customer_id": account.stripe_customer_id,
        },
        "subscription": (
            {
                "id": subscription.id,
                "plan": subscription.plan,
                "billing_interval": subscription.billing_interval,
                "status": subscription.status,
                "current_period_end": subscription.current_period_end,
                "trial_end": subscription.trial_end,
            }
            if subscription
            else None
        ),
    }


@router.post("/subscribe", response_model=SubscriptionOut)
async def subscribe(
    payload: SubscriptionIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant the `free` plan with no payment involved.

    Locked to `free` only — see this file's module docstring. Paid plans
    (`individual`/`family`) must go through `POST /checkout` +
    `GET /checkout/verify` below, which is the only path in this codebase
    that grants a paid plan after confirming real payment with Stripe.
    """
    if payload.plan != "free":
        raise HTTPException(
            status_code=400,
            detail=(
                "Paid plans require checkout — POST /api/billing/checkout, "
                "complete payment, then GET /api/billing/checkout/verify."
            ),
        )
    subscription = await upsert_subscription_for_user(db, current_user, payload.plan)
    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "billing_interval": subscription.billing_interval,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }


class CheckoutIn(BaseModel):
    plan: Plan
    interval: BillingInterval = "month"


class CheckoutOut(BaseModel):
    checkout_url: str


class CheckoutVerifyOut(BaseModel):
    status: str  # "paid" | "pending" | "not_configured"
    plan: str | None = None
    message: str | None = None


async def _get_or_create_account(db: AsyncSession, user: User) -> Account:
    result = await db.execute(select(Account).where(Account.owner_user_id == user.id))
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(owner_user_id=user.id, name=user.email)
        db.add(account)
        await db.commit()
        await db.refresh(account)
    return account


async def _get_or_create_stripe_customer(
    db: AsyncSession, account: Account, user: User, api_key: str
) -> str:
    """Reuse the account's Stripe customer across checkouts instead of
    creating a new one every time — id is persisted on `Account.stripe_customer_id`.
    """
    if account.stripe_customer_id:
        return account.stripe_customer_id

    customer = stripe.Customer.create(email=user.email, name=user.name or user.email, api_key=api_key)
    account.stripe_customer_id = customer.id
    await db.commit()
    await db.refresh(account)
    return customer.id


@router.post("/checkout", response_model=CheckoutOut)
async def create_checkout_session(
    payload: CheckoutIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutOut:
    """Create a Stripe Checkout Session for the signed-in user and hand back
    its hosted URL for the frontend to redirect the browser to. No plan is
    granted here — only `GET /checkout/verify`, after independently
    confirming payment with Stripe, ever touches `Subscription`/`User.tier`.
    """
    pricing = _CHECKOUT_PLAN_PRICING.get((payload.plan, payload.interval))
    if pricing is None:
        detail = (
            "The free plan needs no checkout — use POST /api/billing/subscribe."
            if payload.plan == "free"
            else "Counsellor plans are provisioned manually — contact us instead of checking out."
        )
        raise HTTPException(status_code=400, detail=detail)

    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "not_configured",
                "message": (
                    "Stripe isn't set up yet. Create a Stripe account (test mode), then set "
                    "STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY via /set-app-env."
                ),
            },
        )

    account = await _get_or_create_account(db, current_user)
    customer_id = await _get_or_create_stripe_customer(
        db, account, current_user, settings.stripe_secret_key
    )

    base_url = _frontend_base_url()
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "recurring": {"interval": payload.interval},
                        "unit_amount": pricing.unit_amount,
                        "product_data": {"name": f"College Advisor — {pricing.label} plan"},
                    },
                    "quantity": 1,
                }
            ],
            success_url=f"{base_url}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/pricing/cancel",
            client_reference_id=str(current_user.id),
            metadata={
                "user_id": str(current_user.id),
                "plan": payload.plan,
                "interval": payload.interval,
            },
            api_key=settings.stripe_secret_key,
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Stripe couldn't create a checkout session: {exc.user_message or str(exc)}",
        ) from exc

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")
    return CheckoutOut(checkout_url=session.url)


@router.get("/checkout/verify", response_model=CheckoutVerifyOut)
async def verify_checkout_session(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutVerifyOut:
    """Server-side source of truth for "did this checkout actually get paid."

    Called by the frontend's `/pricing/success` page after Stripe redirects
    back with `?session_id=...`. Only grants the plan (via the shared
    `upsert_subscription_for_user` — same helper `POST /subscribe` and
    registration use) once this backend has independently confirmed with
    Stripe that the session belongs to the current user AND paid. This is
    the real replacement for the old scaffold's "trust whatever the client
    posts" behavior.
    """
    settings = get_settings()
    if not settings.stripe_secret_key:
        return CheckoutVerifyOut(status="not_configured", message="Stripe isn't set up yet.")

    try:
        session = stripe.checkout.Session.retrieve(session_id, api_key=settings.stripe_secret_key)
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Couldn't verify this checkout session: {exc.user_message or str(exc)}",
        ) from exc

    # session.metadata is a stripe-python StripeObject, not a real dict —
    # it has no .get() (confirmed: AttributeError at runtime, this was
    # previously masked by a typing.cast, which only affects the type
    # checker and does nothing at runtime). .to_dict() actually converts it;
    # fall back to plain dict() for test doubles that already pass a dict.
    raw_metadata = session.metadata or {}
    metadata = cast(
        dict[str, str],
        raw_metadata.to_dict() if hasattr(raw_metadata, "to_dict") else dict(raw_metadata),
    )

    # Never grant a plan based on a session_id that belongs to someone else's
    # checkout — confirm it was created for the currently signed-in user.
    session_user_id = metadata.get("user_id") or session.client_reference_id
    if session_user_id != str(current_user.id):
        raise HTTPException(
            status_code=403, detail="This checkout session does not belong to your account."
        )

    if session.payment_status != "paid":
        return CheckoutVerifyOut(status="pending", message="Payment has not completed yet.")

    plan = metadata.get("plan")
    # Older checkout sessions (created before the annual plan shipped) have
    # no "interval" key in their metadata at all — those were always
    # monthly, so default to "month" rather than rejecting an in-flight
    # session someone started right before this deploy.
    interval = metadata.get("interval") or "month"
    pricing_key = (plan, interval)
    if pricing_key not in _CHECKOUT_PLAN_PRICING:
        raise HTTPException(status_code=400, detail="Checkout session is missing a valid plan.")
    # Narrowed by the membership check above (`_CHECKOUT_PLAN_PRICING`'s keys
    # are exactly {"individual", "family"} x {"month", "year"}), but mypy
    # can't infer a str is a `Plan`/`BillingInterval` Literal from a runtime
    # `dict` membership test.
    plan_literal = cast(Plan, plan)
    interval_literal = cast(BillingInterval, interval)

    subscription = await upsert_subscription_for_user(
        db, current_user, plan_literal, interval_literal
    )

    stripe_subscription_id = None
    if isinstance(session.subscription, str):
        stripe_subscription_id = session.subscription
    elif session.subscription is not None:
        stripe_subscription_id = session.subscription.id
    if stripe_subscription_id:
        subscription.stripe_subscription_id = stripe_subscription_id
        await db.commit()

    await send_purchase_event(
        email=current_user.email,
        value=_CHECKOUT_PLAN_PRICING[pricing_key].unit_amount / 100,
        currency="usd",
        event_id=session_id,
        event_source_url=f"{_frontend_base_url()}/pricing/success",
        client_ip=request.client.host if request.client else None,
        client_user_agent=request.headers.get("user-agent"),
    )

    return CheckoutVerifyOut(status="paid", plan=plan)


async def reconcile_expired_cancellation(db: AsyncSession, user: User) -> None:
    """Lazily flip tier/status to free/canceled once a scheduled cancellation's
    paid period has actually ended.

    This app has no inbound Stripe webhook (see this file's module docstring
    — oauth2-proxy blocks unauthenticated inbound calls), so nothing else
    would ever notice `current_period_end` has passed and revoke access.
    Called from `GET /api/auth/me` and `GET /api/billing/` — the two places
    that hand tier/subscription state back to the client — so it self-heals
    on the next authenticated read after expiry, the same "confirm on the
    next real interaction" pattern `verify_checkout_session` uses for
    payment. A no-op for everyone else (one extra SELECT, no UPDATE) since
    the condition only trips for an account mid-scheduled-cancellation.
    """
    result = await db.execute(select(Account).where(Account.owner_user_id == user.id))
    account = result.scalar_one_or_none()
    if account is None:
        return
    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    if (
        subscription is not None
        and subscription.cancel_at_period_end
        and subscription.status == "active"
        and subscription.current_period_end is not None
        and datetime.utcnow() >= subscription.current_period_end
    ):
        subscription.status = "canceled"
        subscription.updated_at = datetime.utcnow()
        user.tier = "free"
        await db.commit()


@router.post("/cancel", response_model=SubscriptionOut)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Schedule cancellation for a real paid subscription — access continues
    until `current_period_end`, billing just stops there. Someone who prepaid
    a $79/yr annual plan and cancels after two months keeps the other ten;
    they aren't cut off the moment they click cancel. `reconcile_expired_
    cancellation()` above is what actually revokes access once that date
    arrives. The free plan (no real Stripe subscription behind it — nothing
    to schedule, no prepaid period to honor) and a subscription Stripe
    already has no record of both fall back to the old immediate-clear
    behavior, since there's no real guarantee left to keep in either case.
    """
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=404, detail="no active subscription")

    settings = get_settings()
    defer_revocation = bool(subscription.stripe_subscription_id and settings.stripe_secret_key)
    if defer_revocation:
        try:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=True,
                api_key=settings.stripe_secret_key,
            )
        except stripe.InvalidRequestError as exc:
            # Already gone on Stripe's side (e.g. canceled manually in the
            # dashboard already) — no real subscription left to honor a
            # future period on, so fall back to clearing immediately.
            if "No such subscription" not in str(exc):
                raise HTTPException(
                    status_code=502,
                    detail=f"Stripe couldn't cancel this subscription: {exc.user_message or str(exc)}",
                ) from exc
            defer_revocation = False
        except stripe.StripeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Stripe couldn't cancel this subscription: {exc.user_message or str(exc)}",
            ) from exc

    subscription.cancel_at_period_end = True
    subscription.updated_at = datetime.utcnow()
    if not defer_revocation:
        subscription.status = "canceled"
        current_user.tier = "free"
    await db.commit()
    await db.refresh(subscription)

    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "billing_interval": subscription.billing_interval,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }


class RetentionOfferOut(BaseModel):
    status: str  # "applied"
    message: str


@router.post("/retention-offer", response_model=RetentionOfferOut)
async def apply_retention_offer(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> RetentionOfferOut:
    """One-time 50%-off coupon on the next renewal — offered on the cancel
    flow before a cancellation is confirmed (see Pricing.jsx's cancel
    modal). A Stripe-native `duration="once"` coupon so it consumes itself on
    the next invoice and can never silently keep discounting future renewals,
    regardless of billing interval. Doesn't touch local subscription/tier
    state at all — the existing subscription just renews at half price once.
    """
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    if subscription is None or not subscription.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active paid subscription to discount.")

    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=400,
            detail={"status": "not_configured", "message": "Stripe isn't set up yet."},
        )

    try:
        coupon = stripe.Coupon.create(
            percent_off=50, duration="once", api_key=settings.stripe_secret_key
        )
        # `Subscription.modify`'s top-level `coupon` param is gone from this
        # Stripe API version's typed params (stripe-python 15.4.0) in favor
        # of a `discounts` list — checked stripe/params/_subscription_modify_
        # params.py directly rather than trusting a plain `coupon=` kwarg to
        # still work against the current API.
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            discounts=[{"coupon": coupon.id}],
            api_key=settings.stripe_secret_key,
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Stripe couldn't apply the discount: {exc.user_message or str(exc)}",
        ) from exc

    return RetentionOfferOut(status="applied", message="50% off has been applied to your next renewal.")

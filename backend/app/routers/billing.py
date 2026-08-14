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
from typing import cast

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.billing import Account, Subscription
from app.models.user import User
from app.schemas.auth import Plan

router = APIRouter()

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
@dataclass(frozen=True)
class _PlanPricing:
    unit_amount: int  # USD cents
    label: str


_CHECKOUT_PLAN_PRICING: dict[str, _PlanPricing] = {
    "individual": _PlanPricing(unit_amount=900, label="Student"),
    "family": _PlanPricing(unit_amount=2500, label="Family"),
}


def _frontend_base_url() -> str:
    """Where to send the browser back to after Checkout."""
    return get_settings().frontend_base_url


class SubscriptionIn(BaseModel):
    plan: Plan


async def upsert_subscription_for_user(db: AsyncSession, user: User, plan: Plan) -> Subscription:
    """Get-or-create the user's Account, upsert their single Subscription row
    to `plan` with no real payment collected (tier-logic-only phase — see
    docs/user-stories.md and the auth redesign plan), and bridge the result
    onto `User.tier` so every other endpoint has a single, already-resolved
    field to check instead of needing its own billing lookup. Shared by
    POST /api/auth/register (plan chosen at signup) and POST /subscribe below.
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
    if subscription is None:
        subscription = Subscription(
            account_id=account.id,
            plan=plan,
            status="active",
            current_period_end=now + timedelta(days=30),
            trial_end=None,
            cancel_at_period_end=False,
        )
        db.add(subscription)
    else:
        subscription.plan = plan
        subscription.status = "active"
        subscription.current_period_end = now + timedelta(days=30)
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
    status: str
    current_period_end: datetime | None
    trial_end: datetime | None


@router.get("/", response_model=dict)
async def get_billing(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
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
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }


class CheckoutIn(BaseModel):
    plan: Plan


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
    pricing = _CHECKOUT_PLAN_PRICING.get(payload.plan)
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
                        "recurring": {"interval": "month"},
                        "unit_amount": pricing.unit_amount,
                        "product_data": {"name": f"College Advisor — {pricing.label} plan"},
                    },
                    "quantity": 1,
                }
            ],
            success_url=f"{base_url}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/pricing/cancel",
            client_reference_id=str(current_user.id),
            metadata={"user_id": str(current_user.id), "plan": payload.plan},
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
    if plan not in _CHECKOUT_PLAN_PRICING:
        raise HTTPException(status_code=400, detail="Checkout session is missing a valid plan.")
    # Narrowed by the membership check above (`_CHECKOUT_PLAN_PRICING`'s keys
    # are exactly {"individual", "family"}), but mypy can't infer a str is a
    # `Plan` Literal from a runtime `dict` membership test.
    plan_literal = cast(Plan, plan)

    subscription = await upsert_subscription_for_user(db, current_user, plan_literal)

    stripe_subscription_id = None
    if isinstance(session.subscription, str):
        stripe_subscription_id = session.subscription
    elif session.subscription is not None:
        stripe_subscription_id = session.subscription.id
    if stripe_subscription_id:
        subscription.stripe_subscription_id = stripe_subscription_id
        await db.commit()

    return CheckoutVerifyOut(status="paid", plan=plan)


@router.post("/cancel", response_model=SubscriptionOut)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=404, detail="no active subscription")

    # This app has no inbound Stripe webhook (see this file's module
    # docstring — oauth2-proxy blocks unauthenticated inbound calls), so
    # cancellation has to be confirmed with Stripe synchronously here rather
    # than reconciled later. Mirrors the immediate access-revoke below: cancel
    # the real subscription right away rather than at period end, so Stripe
    # billing and local `tier` never disagree about whether the user is paid.
    settings = get_settings()
    if subscription.stripe_subscription_id and settings.stripe_secret_key:
        try:
            stripe.Subscription.cancel(
                subscription.stripe_subscription_id, api_key=settings.stripe_secret_key
            )
        except stripe.InvalidRequestError as exc:
            # Already gone on Stripe's side (e.g. canceled manually in the
            # dashboard already) — nothing left to stop billing on, so let
            # the local state clear rather than blocking the user on it.
            if "No such subscription" not in str(exc):
                raise HTTPException(
                    status_code=502,
                    detail=f"Stripe couldn't cancel this subscription: {exc.user_message or str(exc)}",
                ) from exc
        except stripe.StripeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Stripe couldn't cancel this subscription: {exc.user_message or str(exc)}",
            ) from exc

    subscription.status = "canceled"
    subscription.cancel_at_period_end = True
    subscription.updated_at = datetime.utcnow()
    current_user.tier = "free"
    await db.commit()
    await db.refresh(subscription)

    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }

"""Simple billing endpoints (scaffold).

These endpoints use the temporary dev auth (`X-User-Email`) and the local
`Account` / `Subscription` models added during scaffolding. They are NOT a
replacement for a real Stripe integration — they provide a minimal UI-backed
API for local development and demo flows.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.billing import Account, Subscription

router = APIRouter()


class SubscriptionIn(BaseModel):
    plan: str


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
    current_user=Depends(get_current_user),
):
    # Ensure account exists
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        account = Account(owner_user_id=current_user.id, name=current_user.email)
        db.add(account)
        await db.commit()
        await db.refresh(account)

    # Simple upsert: create or update the single subscription row for account
    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    now = datetime.utcnow()
    if subscription is None:
        subscription = Subscription(
            account_id=account.id,
            plan=payload.plan,
            status="active",
            current_period_end=now + timedelta(days=30),
            trial_end=None,
            cancel_at_period_end=False,
        )
        db.add(subscription)
    else:
        subscription.plan = payload.plan
        subscription.status = "active"
        subscription.current_period_end = now + timedelta(days=30)
        subscription.cancel_at_period_end = False
        subscription.updated_at = now

    await db.commit()
    await db.refresh(subscription)

    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }


@router.post("/cancel", response_model=SubscriptionOut)
async def cancel_subscription(
    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)
):
    result = await db.execute(select(Account).where(Account.owner_user_id == current_user.id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")

    result = await db.execute(select(Subscription).where(Subscription.account_id == account.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=404, detail="no active subscription")

    subscription.status = "canceled"
    subscription.cancel_at_period_end = True
    subscription.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(subscription)

    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
    }

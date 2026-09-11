"""Billing / subscription models.

Lightweight schema to represent Accounts, Subscriptions, and linked
StudentProfiles. This is intentionally minimal for the scaffold phase and
keeps fields needed for later Stripe integration (customer / subscription ids,
plan, status, and period/trial timestamps).
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), default=None)
    plan: Mapped[str] = mapped_column(String(50))  # free|individual|family
    billing_interval: Mapped[str] = mapped_column(String(10), default="month")  # month|year
    status: Mapped[str] = mapped_column(
        String(50), default="trial"
    )  # trial|active|past_due|canceled
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    student_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    display_name: Mapped[str | None] = mapped_column(String(255), default=None)
    graduation_year: Mapped[int | None] = mapped_column(Integer, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

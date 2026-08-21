"""Public Contact Us / feedback form — no auth required."""

import asyncio

from fastapi import APIRouter

from app.core.email import send_feedback_email
from app.schemas.feedback import FeedbackIn

router = APIRouter()


@router.post("/")
async def submit_feedback(payload: FeedbackIn) -> dict[str, bool]:
    # smtplib is blocking — offload so it can't stall the event loop, same as
    # the forgot-password flow in app/routers/auth.py.
    await asyncio.to_thread(
        send_feedback_email, payload.name.strip(), payload.email.strip(), payload.message.strip()
    )
    return {"ok": True}

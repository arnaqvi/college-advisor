"""Meta Conversions API — server-side `Purchase` event reporting.

Fired from `verify_checkout_session` (app/routers/billing.py) at the one
moment this backend has independently confirmed with Stripe that money
actually moved — not on "checkout started" client-side, which would count
abandoned checkouts as conversions and give Meta's ad delivery a false
signal to optimize against.

Self-service, same not-configured pattern as stripe_secret_key /
anthropic_api_key in app/core/config.py: when META_CAPI_ACCESS_TOKEN isn't
set, this silently no-ops rather than erroring — set it via `/set-app-env`
once the dataset (Events Manager > collegepath, ID 1116003507523517) has an
access token generated under its Settings tab.

A failure here must never block granting the plan the user already paid
for, so every error is caught and logged, not raised.
"""

import hashlib
import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


async def send_purchase_event(
    *,
    email: str,
    value: float,
    currency: str,
    event_id: str,
    event_source_url: str | None = None,
    client_ip: str | None = None,
    client_user_agent: str | None = None,
) -> None:
    """Report a completed subscription purchase to the collegepath dataset.

    `event_id` should be stable per checkout session (e.g. the Stripe
    session id) so a future browser Pixel send for the same purchase can
    dedup against this one instead of double-counting.
    """
    settings = get_settings()
    if not settings.meta_capi_access_token:
        logger.info("Meta CAPI not configured — skipping Purchase event for %s", event_id)
        return

    user_data: dict[str, object] = {"em": [_hash(email)]}
    if client_ip:
        user_data["client_ip_address"] = client_ip
    if client_user_agent:
        user_data["client_user_agent"] = client_user_agent

    event = {
        "event_name": "Purchase",
        "event_time": int(time.time()),
        "event_id": event_id,
        "action_source": "website",
        "user_data": user_data,
        "custom_data": {"currency": currency, "value": value},
    }
    if event_source_url:
        event["event_source_url"] = event_source_url

    url = (
        f"https://graph.facebook.com/{GRAPH_API_VERSION}/"
        f"{settings.meta_dataset_id}/events"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                url,
                params={"access_token": settings.meta_capi_access_token},
                json={"data": [event]},
            )
            response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Meta CAPI Purchase event failed for %s", event_id, exc_info=True)

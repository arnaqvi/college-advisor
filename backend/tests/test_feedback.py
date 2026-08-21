"""Tests for /api/feedback — public Contact Us form, no auth required."""

import pytest
from httpx import ASGITransport, AsyncClient

import app.routers.feedback as feedback_router
from app.main import app


@pytest.mark.asyncio
async def test_submit_feedback_sends_email(monkeypatch) -> None:
    captured = {}

    def fake_send(name: str, from_email: str, message_body: str) -> None:
        captured["name"] = name
        captured["from_email"] = from_email
        captured["message_body"] = message_body

    monkeypatch.setattr(feedback_router, "send_feedback_email", fake_send)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/feedback/",
            json={"name": "Jamie", "email": "jamie@example.com", "message": "Love the app!"},
        )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert captured == {
        "name": "Jamie",
        "from_email": "jamie@example.com",
        "message_body": "Love the app!",
    }


@pytest.mark.asyncio
async def test_submit_feedback_rejects_empty_message() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/feedback/",
            json={"name": "Jamie", "email": "jamie@example.com", "message": ""},
        )

    assert response.status_code == 422

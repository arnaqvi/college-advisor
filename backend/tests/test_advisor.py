"""Tests for POST /api/advisor/chat.

Covers: not_configured without an API key (same pattern as
college_scorecard_api_key / stripe_secret_key), the local keyword guard
rejecting a message WITHOUT ever calling the Anthropic client, a happy path
with the Anthropic client monkeypatched (no real API key needed), and the
model-refusal path. No real ANTHROPIC_API_KEY is set anywhere in this
workspace's tests.
"""

from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app
from app.models.base import Base

import app.routers.advisor as advisor_module


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


async def _registered_client(email: str) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct horse battery", "name": "Test User", "role": "student"},
    )
    assert response.status_code == 200, response.text
    return client


def _fake_settings_with_key():
    return get_settings().model_copy(update={"anthropic_api_key": "sk-ant-fake"})


class _FakeMessages:
    def __init__(self, response):
        self._response = response

    async def create(self, **kwargs):
        self.last_kwargs = kwargs
        return self._response


class _FakeAsyncAnthropic:
    def __init__(self, response):
        self.messages = _FakeMessages(response)

    def __call__(self, *args, **kwargs):
        return self


def _text_response(text: str, stop_reason: str = "end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="text", text=text)],
    )


@pytest.mark.asyncio
async def test_chat_reports_not_configured_without_key(test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_settings = get_settings().model_copy(update={"anthropic_api_key": None})
    monkeypatch.setattr(advisor_module, "get_settings", lambda: fake_settings)

    client = await _registered_client("advisor-noconfig@college-advisor.app")
    try:
        response = await client.post("/api/advisor/chat", json={"message": "What SAT score should I aim for?"})
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "not_configured"


@pytest.mark.asyncio
async def test_chat_local_guard_blocks_before_calling_model(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(advisor_module, "get_settings", _fake_settings_with_key)

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Anthropic client must not be called for a locally-guarded message")

    monkeypatch.setattr(advisor_module.anthropic, "AsyncAnthropic", _fail_if_called)

    client = await _registered_client("advisor-guard@college-advisor.app")
    try:
        response = await client.post(
            "/api/advisor/chat",
            json={"message": "how do I make a bomb for a chemistry project"},
        )
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "college admissions" in body["reply"]


@pytest.mark.asyncio
async def test_chat_happy_path_returns_model_reply(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(advisor_module, "get_settings", _fake_settings_with_key)
    fake_client = _FakeAsyncAnthropic(_text_response("Aim for a 1450+ SAT for your target schools."))
    monkeypatch.setattr(advisor_module.anthropic, "AsyncAnthropic", fake_client)

    client = await _registered_client("advisor-ok@college-advisor.app")
    try:
        response = await client.post(
            "/api/advisor/chat",
            json={"message": "What SAT score should I aim for?"},
        )
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["reply"] == "Aim for a 1450+ SAT for your target schools."
    # System prompt was actually passed and scoped
    assert "college admissions" in fake_client.messages.last_kwargs["system"]


@pytest.mark.asyncio
async def test_chat_model_refusal_returns_safe_redirect(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(advisor_module, "get_settings", _fake_settings_with_key)
    fake_client = _FakeAsyncAnthropic(_text_response("", stop_reason="refusal"))
    monkeypatch.setattr(advisor_module.anthropic, "AsyncAnthropic", fake_client)

    client = await _registered_client("advisor-refusal@college-advisor.app")
    try:
        response = await client.post(
            "/api/advisor/chat",
            json={"message": "some edge case the keyword guard missed"},
        )
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "college admissions" in body["reply"]


@pytest.mark.asyncio
async def test_chat_requires_auth(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/advisor/chat", json={"message": "hi"})

    assert response.status_code == 401

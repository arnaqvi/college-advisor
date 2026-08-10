"""Tests for POST /api/bias-research/college/{program_slug}.

Mirrors test_advisor.py's pattern (fake Anthropic client via monkeypatch, no
real ANTHROPIC_API_KEY needed): not_configured without a key, not_found for
an unknown slug, a happy path with citations parsed off the response's
text-block citation objects, and the refusal path.

Keyed by program slug rather than the college's numeric id — see the
router's docstring: `/api/colleges` rows are one-per-program, and
`ProgramOut.id` (what the frontend already has for every entry in
`counselorCollegeList`) is `Program.slug`, not `College.id`.
"""

from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.college import College, Program

import app.routers.bias_research as bias_research_module


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
            session.add(College(id=1, name="Example University", city="Anytown", state="CA"))
            session.add(
                Program(id=1, slug="example-university-cs", college_id=1, dept="Computer Science", category="STEM")
            )
            await session.commit()
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


def _citation(url: str, title: str, cited_text: str):
    return SimpleNamespace(type="web_search_result_location", url=url, title=title, cited_text=cited_text)


def _text_block(text: str, citations=None):
    return SimpleNamespace(type="text", text=text, citations=citations or [])


def _response(blocks, stop_reason: str = "end_turn"):
    return SimpleNamespace(stop_reason=stop_reason, content=blocks)


@pytest.mark.asyncio
async def test_research_reports_not_configured_without_key(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_settings = get_settings().model_copy(update={"anthropic_api_key": None})
    monkeypatch.setattr(bias_research_module, "get_settings", lambda: fake_settings)

    client = await _registered_client("bias-noconfig@college-advisor.app")
    try:
        response = await client.post("/api/bias-research/college/example-university-cs")
    finally:
        await client.aclose()

    assert response.status_code == 200
    assert response.json()["status"] == "not_configured"


@pytest.mark.asyncio
async def test_research_reports_not_found_for_missing_college(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(bias_research_module, "get_settings", _fake_settings_with_key)

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Anthropic client must not be called for a missing college")

    monkeypatch.setattr(bias_research_module.anthropic, "AsyncAnthropic", _fail_if_called)

    client = await _registered_client("bias-notfound@college-advisor.app")
    try:
        response = await client.post("/api/bias-research/college/nonexistent-slug")
    finally:
        await client.aclose()

    assert response.status_code == 200
    assert response.json()["status"] == "not_found"


@pytest.mark.asyncio
async def test_research_happy_path_returns_report_and_sources(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(bias_research_module, "get_settings", _fake_settings_with_key)
    fake_response = _response(
        [
            _text_block("## Verified\n"),
            _text_block(
                "- Legacy admits get preference per a 2023 lawsuit filing.\n",
                citations=[_citation("https://example.com/article", "Lawsuit Coverage", "legacy admits get preference")],
            ),
            _text_block("## Perceived\n- Reddit posters say athletes get an edge.\n"),
        ]
    )
    fake_client = _FakeAsyncAnthropic(fake_response)
    monkeypatch.setattr(bias_research_module.anthropic, "AsyncAnthropic", fake_client)

    client = await _registered_client("bias-ok@college-advisor.app")
    try:
        response = await client.post("/api/bias-research/college/example-university-cs")
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["college_name"] == "Example University"
    assert "Verified" in body["report"]
    assert "Perceived" in body["report"]
    assert body["sources"] == [
        {"url": "https://example.com/article", "title": "Lawsuit Coverage", "cited_text": "legacy admits get preference"}
    ]
    # web_search tool was actually requested, scoped by college name
    kwargs = fake_client.messages.last_kwargs
    assert kwargs["tools"][0]["type"] == "web_search_20260318"
    assert "Example University" in kwargs["system"]


@pytest.mark.asyncio
async def test_research_refusal_returns_ok_with_no_findings(
    test_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(bias_research_module, "get_settings", _fake_settings_with_key)
    fake_client = _FakeAsyncAnthropic(_response([], stop_reason="refusal"))
    monkeypatch.setattr(bias_research_module.anthropic, "AsyncAnthropic", fake_client)

    client = await _registered_client("bias-refusal@college-advisor.app")
    try:
        response = await client.post("/api/bias-research/college/example-university-cs")
    finally:
        await client.aclose()

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["sources"] == []


@pytest.mark.asyncio
async def test_research_requires_auth(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/bias-research/college/example-university-cs")

    assert response.status_code == 401

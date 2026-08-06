"""Tests for GET/PUT /api/profile.

Regression coverage for the reported bug: a new login must not inherit a
previous user's saved profile. See app/routers/profile.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base


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


@pytest.mark.asyncio
async def test_get_profile_returns_none_when_unsaved(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/profile", headers={"X-User-Email": "new-user@college-advisor.app"}
        )

    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_put_then_get_round_trips(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        put_response = await client.put(
            "/api/profile",
            headers={"X-User-Email": "student-a@college-advisor.app"},
            json={"data": {"studentName": "Student A", "gpaUnweighted": "3.9"}},
        )
        assert put_response.status_code == 200
        assert put_response.json()["data"]["studentName"] == "Student A"

        get_response = await client.get(
            "/api/profile", headers={"X-User-Email": "student-a@college-advisor.app"}
        )

    assert get_response.status_code == 200
    assert get_response.json()["data"] == {"studentName": "Student A", "gpaUnweighted": "3.9"}


@pytest.mark.asyncio
async def test_different_users_get_independent_profiles(test_session: AsyncSession) -> None:
    """The literal reproduction of the reported bug: two different logins on
    the same client must never see each other's saved profile.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put(
            "/api/profile",
            headers={"X-User-Email": "student-a@college-advisor.app"},
            json={"data": {"studentName": "Student A"}},
        )
        await client.put(
            "/api/profile",
            headers={"X-User-Email": "student-b@college-advisor.app"},
            json={"data": {"studentName": "Student B"}},
        )

        response_a = await client.get(
            "/api/profile", headers={"X-User-Email": "student-a@college-advisor.app"}
        )
        response_b = await client.get(
            "/api/profile", headers={"X-User-Email": "student-b@college-advisor.app"}
        )
        response_new = await client.get(
            "/api/profile", headers={"X-User-Email": "student-c@college-advisor.app"}
        )

    assert response_a.json()["data"]["studentName"] == "Student A"
    assert response_b.json()["data"]["studentName"] == "Student B"
    assert response_new.json() is None

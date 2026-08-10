"""Tests for /api/colleges/deadline-overrides — see app/models/college.py's
`DeadlineOverride` docstring for why this is per-user, not a write to the
shared `College.deadlines` field."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.college import College, Program


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


@pytest.fixture
async def seeded_program(test_session: AsyncSession) -> Program:
    college = College(name="University of Tulsa", state="OK", country="US", type="Private", data_source="seed")
    test_session.add(college)
    await test_session.flush()

    program = Program(
        slug="tulsa-cs", college_id=college.id, dept="Computer Science", category="STEM", data_source="seed"
    )
    test_session.add(program)
    await test_session.commit()
    return program


async def _register_and_login(client: AsyncClient, email: str = "deadlines@example.com") -> None:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct horse battery", "name": "Deadlines Test", "role": "student"},
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_overrides_start_empty(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.get("/api/colleges/deadline-overrides")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_set_override_for_unknown_program_404s(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.put("/api/colleges/deadline-overrides/not-a-real-slug", json={"rdDate": "2027-01-15"})

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_set_and_list_override(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        put_response = await client.put(
            "/api/colleges/deadline-overrides/tulsa-cs",
            json={"rolling": True, "note": "Rolling admission, applied Nov 3"},
        )
        list_response = await client.get("/api/colleges/deadline-overrides")

    assert put_response.status_code == 200
    body = put_response.json()
    assert body["programSlug"] == "tulsa-cs"
    assert body["rolling"] is True
    assert body["note"] == "Rolling admission, applied Nov 3"
    assert body["edDate"] is None
    assert list_response.json() == [body]


@pytest.mark.asyncio
async def test_setting_again_updates_in_place_not_duplicates(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.put("/api/colleges/deadline-overrides/tulsa-cs", json={"rdDate": "2027-01-15"})
        response = await client.put("/api/colleges/deadline-overrides/tulsa-cs", json={"rdDate": "2027-02-01"})
        list_response = await client.get("/api/colleges/deadline-overrides")

    assert response.json()["rdDate"] == "2027-02-01"
    assert len(list_response.json()) == 1


@pytest.mark.asyncio
async def test_overrides_are_scoped_per_user(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_a:
        await _register_and_login(client_a, email="deadlines-a@example.com")
        await client_a.put("/api/colleges/deadline-overrides/tulsa-cs", json={"rdDate": "2027-01-15"})

    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await _register_and_login(client_b, email="deadlines-b@example.com")
        response = await client_b.get("/api/colleges/deadline-overrides")

    assert response.json() == []


@pytest.mark.asyncio
async def test_delete_override(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.put("/api/colleges/deadline-overrides/tulsa-cs", json={"rdDate": "2027-01-15"})
        delete_response = await client.delete("/api/colleges/deadline-overrides/tulsa-cs")
        list_response = await client.get("/api/colleges/deadline-overrides")

    assert delete_response.status_code == 204
    assert list_response.json() == []


@pytest.mark.asyncio
async def test_overrides_require_auth(seeded_program: Program) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/colleges/deadline-overrides")

    assert response.status_code == 401

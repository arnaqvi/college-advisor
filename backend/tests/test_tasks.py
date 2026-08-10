"""Tests for /api/tasks/* — Timeline checklist persistence.

`TaskCompletion` rows only ever store a client-computed slug (see
frontend/src/lib/engine/taskSlugs.js) — the backend has no opinion on what
the slug means, so these tests just exercise it as an opaque string.
`CustomTask` rows are fully backend-owned content, same CRUD shape as the
onboarding routers' TestScore.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.models.tasks import CustomTask, TaskCompletion


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


async def _register_and_login(client: AsyncClient, email: str = "tasks@example.com") -> None:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct horse battery", "name": "Tasks Test", "role": "student"},
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_completions_start_empty(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        response = await client.get("/api/tasks/completions")

    assert response.status_code == 200
    assert response.json() == {"completed_slugs": []}


@pytest.mark.asyncio
async def test_marking_a_slug_complete_persists_it(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        put_response = await client.put(
            "/api/tasks/completions/system:September:student:draft-the-common-app-personal-essay",
            json={"completed": True},
        )
        get_response = await client.get("/api/tasks/completions")

    assert put_response.status_code == 200
    assert put_response.json() == get_response.json()
    assert get_response.json()["completed_slugs"] == [
        "system:September:student:draft-the-common-app-personal-essay"
    ]


@pytest.mark.asyncio
async def test_marking_complete_twice_does_not_duplicate(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.put("/api/tasks/completions/system:October:parent:x", json={"completed": True})
        response = await client.put("/api/tasks/completions/system:October:parent:x", json={"completed": True})

    assert response.status_code == 200
    assert response.json()["completed_slugs"] == ["system:October:parent:x"]

    result = await test_session.execute(select(TaskCompletion))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_unmarking_a_slug_removes_it(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        await client.put("/api/tasks/completions/system:October:student:x", json={"completed": True})
        response = await client.put("/api/tasks/completions/system:October:student:x", json={"completed": False})

    assert response.status_code == 200
    assert response.json()["completed_slugs"] == []


@pytest.mark.asyncio
async def test_completions_are_scoped_per_user(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_a:
        await _register_and_login(client_a, email="tasks-a@example.com")
        await client_a.put("/api/tasks/completions/system:shared-slug", json={"completed": True})

    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await _register_and_login(client_b, email="tasks-b@example.com")
        response = await client_b.get("/api/tasks/completions")

    assert response.json() == {"completed_slugs": []}


@pytest.mark.asyncio
async def test_completions_require_auth(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/tasks/completions")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_and_list_custom_task(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        create_response = await client.post(
            "/api/tasks/custom",
            json={"title": "Call Aunt Jane for essay feedback", "category": "student", "month": "September"},
        )
        list_response = await client.get("/api/tasks/custom")

    assert create_response.status_code == 201
    body = create_response.json()
    assert body["title"] == "Call Aunt Jane for essay feedback"
    assert body["completed_at"] is None
    assert list_response.json() == [body]


@pytest.mark.asyncio
async def test_toggle_custom_task_complete(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        created = (
            await client.post("/api/tasks/custom", json={"title": "Task", "category": "parent"})
        ).json()

        completed = await client.patch(f"/api/tasks/custom/{created['id']}", json={"completed": True})
        assert completed.json()["completed_at"] is not None

        uncompleted = await client.patch(f"/api/tasks/custom/{created['id']}", json={"completed": False})
        assert uncompleted.json()["completed_at"] is None


@pytest.mark.asyncio
async def test_delete_custom_task(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await _register_and_login(client)
        created = (
            await client.post("/api/tasks/custom", json={"title": "Task", "category": "student"})
        ).json()

        delete_response = await client.delete(f"/api/tasks/custom/{created['id']}")
        list_response = await client.get("/api/tasks/custom")

    assert delete_response.status_code == 204
    assert list_response.json() == []


@pytest.mark.asyncio
async def test_custom_task_operations_are_scoped_per_user(test_session: AsyncSession) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client_a:
        await _register_and_login(client_a, email="tasks-owner@example.com")
        created = (
            await client_a.post("/api/tasks/custom", json={"title": "Owner's task", "category": "student"})
        ).json()

    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        await _register_and_login(client_b, email="tasks-intruder@example.com")
        patch_response = await client_b.patch(f"/api/tasks/custom/{created['id']}", json={"completed": True})
        delete_response = await client_b.delete(f"/api/tasks/custom/{created['id']}")

    assert patch_response.status_code == 404
    assert delete_response.status_code == 404

    remaining = await test_session.execute(select(CustomTask).where(CustomTask.id == created["id"]))
    assert remaining.scalar_one().completed_at is None

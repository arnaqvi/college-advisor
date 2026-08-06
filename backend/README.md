# College Advisor — Backend

FastAPI (Python 3.11) backend for the College Advisor app, managed with Poetry.

## Local Development

```bash
poetry install
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

App runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

## Project Structure

```
app/
  main.py          # App factory (create_app) + FastAPI instance
  core/
    config.py      # Pydantic v2 settings (env-var driven)
    database.py     # SQLAlchemy 2.0 async engine/session skeleton (no tables yet)
  models/
    base.py         # Declarative base for future ORM models
  routers/          # Future API routers get added here and included in main.py
tests/
  test_health.py    # Health-check smoke test
pyproject.toml / poetry.lock   # Poetry-managed dependencies
Dockerfile          # Multi-stage build (Poetry export -> slim runtime)
```

## Auth Note

This app will use **public self-serve Google OAuth** for end users (students/parents),
added in a later phase. Do **not** assume the platform's default Microsoft
oauth2-proxy sidecar applies to this app's public routes — auth is being built
at the application level instead. See the top-level `README.md` for details.

## Database

SQLAlchemy 2.0 async is wired (`app/core/database.py`, `app/models/base.py`) but no
schema/tables exist yet — that's a later phase. Local dev defaults to SQLite; point
`DATABASE_URL` at Postgres when the real schema lands.

## Testing

```bash
poetry run pytest
```

# SUPERSEDED as of 2026-07-28 — do not deploy from here anymore.
# college-advisor-api (the standalone backend app this built) was retired:
# its own oauth2-proxy sidecar made it structurally unreachable from the
# frontend's server-side nginx proxy (every deployed app gets its own
# sidecar with no internal-call bypass — see repo .lab-meta.json's incident
# history). Backend + frontend are now built together from the repo-root
# `Dockerfile` and deployed as one app (slug college-advisor) — see
# docker/entrypoint.sh. Kept here for reference / local `poetry run uvicorn`
# dev use only.
#
# Single-stage: poetry install directly (reliable — installs the full locked dependency
# set incl. transitive deps like typing_extensions; avoids the poetry-export drop issue).
FROM python:3.11-slim

WORKDIR /app
RUN pip install --no-cache-dir poetry==2.4.1

COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --only main --no-interaction --no-ansi

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

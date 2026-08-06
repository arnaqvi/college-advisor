# Merged deployable — nginx (frontend + /api/ reverse proxy) and uvicorn
# (backend) run as sibling processes in ONE container/pod, via
# docker/entrypoint.sh. Replaces the two separately-deployed BFF apps
# (college-advisor + college-advisor-api), each of which used to get its own
# oauth2-proxy sidecar — that topology made nginx's server-to-server call to
# the backend structurally impossible (the backend's K8s Service only ever
# routed to ITS OWN oauth2-proxy, which has no auth-bypass for internal
# callers). See docker/entrypoint.sh's header comment and
# .lab-meta.json's incident history for the full root cause.
#
# Deploy from the REPO ROOT (not frontend/ or backend/) — slug
# college-advisor, port 80, health /health. See DEPLOY.md.
#
# Do not add `--platform=` to any FROM line — breaks the ACR build scanner.

# Stage 1: build the React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: install backend Python deps (direct `poetry install`, not
# `poetry export` — export drops transitive deps like typing_extensions and
# CrashLoops the app after a clean build).
FROM python:3.11-slim AS backend-builder
WORKDIR /app/backend
RUN pip install --no-cache-dir poetry==2.4.1
COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --only main --no-interaction --no-ansi
COPY backend/app ./app

# Final stage: python runtime + nginx, both processes supervised by
# docker/entrypoint.sh.
FROM python:3.11-slim

# Debian's nginx package (unlike the official nginx:*-alpine image the old
# standalone frontend/Dockerfile used) logs to real files under
# /var/log/nginx by default, not stdout/stderr — so after this app's
# 2026-07-28 merge (away from nginx:1.27-alpine), `kubectl logs`/the BFF
# logs endpoint went completely silent on anything nginx does after its own
# startup-time config warnings (those print to stderr before the error_log
# directive takes effect, so they alone kept appearing). Symlink both logs
# to the standard streams below, same convention the official nginx image
# already uses, so request/error-level nginx activity (including how it's
# handling liveness/readiness /health probes) is actually visible again.
#
# The package also enables its own stock default site
# (/etc/nginx/sites-enabled/default -> sites-available/default), which
# loads AFTER our conf.d/default.conf and re-declares `server_name _` on
# the same 0.0.0.0:80 — harmless in practice (nginx keeps the first-loaded
# block, ours) but throws a "conflicting server name" warning on every
# single container start. Removed below so that warning stops firing and
# can't be mistaken for something significant during future debugging.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log \
    && rm -f /etc/nginx/sites-enabled/default

# Backend: installed site-packages + console scripts (uvicorn) copied from
# the builder stage (same base image, so the compiled C-extension wheels —
# asyncpg etc. — are ABI-compatible).
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin
COPY --from=backend-builder /app/backend/app /app/backend/app

# Frontend: built static assets served by nginx.
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/backend
EXPOSE 80
CMD ["/entrypoint.sh"]

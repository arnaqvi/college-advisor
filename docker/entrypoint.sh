#!/bin/sh
# Runs uvicorn (backend, 127.0.0.1:8000 — never exposed outside this
# container) and nginx (frontend + /api/ reverse proxy, 0.0.0.0:80 — the
# only port this pod's K8s Service/oauth2-proxy sidecar ever sees) as
# sibling processes in one container.
#
# Why: college-advisor and college-advisor-api used to be two separately
# -deployed BFF apps, each with its own oauth2-proxy sidecar (platform
# Mandatory Rule 3). nginx's server-to-server call to the backend's K8s
# Service could never succeed — that Service only forwards to ITS OWN
# oauth2-proxy sidecar (port 4180), which has no auth-bypass for internal
# callers, so every /api/* request hit a 302-to-Microsoft-login instead of
# real JSON, regardless of correct DNS/hostname. Merging into one pod makes
# nginx -> uvicorn a loopback call that never touches a K8s Service or any
# oauth2-proxy at all — exactly the same pattern this pod's own oauth2-proxy
# sidecar already uses to reach nginx (`--upstream=http://localhost:80`).
# See .lab-meta.json's (retired) OUTSTANDING_ISSUE entry and the 2026-07-28
# incident commits for the full root-cause history.
#
# POSIX /bin/sh (not bash) — python:3.11-slim's /bin/sh is dash, which
# doesn't support bash's `wait -n`. Uses a plain poll loop instead so this
# doesn't silently break if the base image ever changes.
set -e

START_EPOCH=$(date +%s)

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

# 2026-07-28 diagnostic instrumentation (see .lab-meta.json / repo CLAUDE.md
# — the new merged image was found crash-looping ~35-40s after start, with
# no crash evidence from either uvicorn or nginx; this container's only
# exit-0 path is term_handler below, so an external SIGTERM — most likely
# the Deployment's own liveness probe, timing lines up almost exactly — is
# the leading suspect). Log unambiguously WHY this container is exiting and
# WHEN, so the next occurrence (if any) is conclusive from `kubectl logs`
# alone, no cluster Events access required.
term_handler() {
  echo "entrypoint: received TERM/INT at $(date -u +%Y-%m-%dT%H:%M:%S.%NZ) — $(($(date +%s) - START_EPOCH))s after start. Shutting down both processes gracefully." >&2
  kill -TERM "$UVICORN_PID" 2>/dev/null || true
  kill -TERM "$NGINX_PID" 2>/dev/null || true
  wait "$UVICORN_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
  exit 0
}
trap term_handler TERM INT

# If either process dies on its own (crash), tear the other down and exit
# non-zero so K8s restarts the whole pod — don't limp along with only one
# of the two processes alive.
while kill -0 "$UVICORN_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 2
done
if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
  echo "entrypoint: uvicorn (pid $UVICORN_PID) died on its own at $(($(date +%s) - START_EPOCH))s after start." >&2
fi
if ! kill -0 "$NGINX_PID" 2>/dev/null; then
  echo "entrypoint: nginx (pid $NGINX_PID) died on its own at $(($(date +%s) - START_EPOCH))s after start." >&2
fi
kill -TERM "$UVICORN_PID" 2>/dev/null || true
kill -TERM "$NGINX_PID" 2>/dev/null || true
exit 1

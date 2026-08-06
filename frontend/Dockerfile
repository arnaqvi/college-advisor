# SUPERSEDED as of 2026-07-28 — do not deploy from here anymore.
# nginx now needs a sibling uvicorn process in the same container to reach
# the backend over loopback (see repo-root `Dockerfile` +
# docker/entrypoint.sh) — a frontend-only image built from this file would
# have `frontend/nginx/default.conf`'s /api/ proxy_pass pointing at
# 127.0.0.1:8000 with nothing listening there. Deploy from the repo root
# instead. Kept here for reference / local iteration only.
#
# Stage 1: Build the React app
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm install (not npm ci) to work without a pre-existing lockfile.
# A package-lock.json is generated automatically in the build layer.
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

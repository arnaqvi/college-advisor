// Fetches the real backend-sourced college/program directory that replaced
// the old static `frontend/src/data/colleges.js` fixture (see
// backend/app/routers/colleges.py). `/api/*` is same-origin in production
// (nginx proxies it to the college-advisor-api service) and proxied to
// localhost:8000 in local dev (see vite.config.js).
//
// Built from `import.meta.env.BASE_URL` rather than a hardcoded leading
// slash — `fetch()` paths are resolved by the browser against the page's
// actual origin/path, NOT Vite's `base` config, so a bare `fetch('/api/...')`
// silently breaks in local dev whenever `base` is proxy-prefixed (the Coder
// workspace preview URL — see vite.config.js's `base`/App.jsx's
// `BrowserRouter basename`, which already uses the same env var for the same
// reason). In production `BASE_URL` is `/`, so this still resolves to plain
// `/api/colleges` exactly as before.
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export async function fetchColleges() {
  const response = await fetch(`${API_BASE}api/colleges`)
  if (!response.ok) {
    throw new Error(`Failed to load colleges (HTTP ${response.status})`)
  }
  return response.json()
}

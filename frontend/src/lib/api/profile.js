// Backend-persisted student profile (see backend/app/routers/profile.py) —
// GET/PUT /api/profile, scoped per user via the X-User-Email header (same
// dev-auth pattern as billing.py/onboarding routers; see backend/app/core/
// auth.py). Replaces the old localStorage-only persistence in AppContext.jsx,
// which had no relationship to which user was logged in.
//
// Follows colleges.js's BASE_URL convention (fetch() paths resolve against
// the page's real origin, not Vite's proxy-prefixed `base`) rather than the
// bare `fetch('/api/...')` pattern used in Pricing.jsx.
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export async function fetchProfile(email) {
  const response = await fetch(`${API_BASE}api/profile`, {
    headers: { 'X-User-Email': email },
  })
  if (!response.ok) {
    throw new Error(`Failed to load profile (HTTP ${response.status})`)
  }
  const body = await response.json()
  return body ? body.data : null
}

export async function putProfile(email, data) {
  const response = await fetch(`${API_BASE}api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': email,
    },
    body: JSON.stringify({ data }),
  })
  if (!response.ok) {
    throw new Error(`Failed to save profile (HTTP ${response.status})`)
  }
  const body = await response.json()
  return body.data
}

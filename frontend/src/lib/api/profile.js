// Backend-persisted student profile (see backend/app/routers/profile.py) —
// GET/PUT /api/profile. Identity is now carried by the signed session cookie
// set at login (see backend/app/routers/auth.py) and sent automatically on
// same-origin requests — no more X-User-Email header (that dev-auth
// placeholder is gone, see backend/app/core/auth.py). The `email` param is
// kept on these functions only because AppContext.jsx already calls them
// keyed on the logged-in email to react to identity changes — it isn't sent
// over the wire.
//
// Follows colleges.js's BASE_URL convention (fetch() paths resolve against
// the page's real origin, not Vite's proxy-prefixed `base`).
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export async function fetchProfile() {
  const response = await fetch(`${API_BASE}api/profile`)
  if (!response.ok) {
    throw new Error(`Failed to load profile (HTTP ${response.status})`)
  }
  const body = await response.json()
  return body ? body.data : null
}

export async function putProfile(data) {
  const response = await fetch(`${API_BASE}api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!response.ok) {
    throw new Error(`Failed to save profile (HTTP ${response.status})`)
  }
  const body = await response.json()
  return body.data
}

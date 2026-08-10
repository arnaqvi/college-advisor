// Real session-backed auth — replaces the old client-only AuthContext that
// just wrote {email, role, name} to localStorage. Identity now lives in a
// signed httpOnly cookie set by the backend (see backend/app/routers/auth.py);
// the browser sends it automatically on same-origin requests (fetch()'s
// default `credentials: 'same-origin'` already includes it — no extra option
// needed since nginx serves both frontend and /api on the same origin).
//
// Follows colleges.js's BASE_URL convention (fetch() paths resolve against
// the page's real origin, not Vite's proxy-prefixed `base`).
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

async function parseErrorDetail(response) {
  try {
    const body = await response.json()
    return body.detail || `Request failed (HTTP ${response.status})`
  } catch {
    return `Request failed (HTTP ${response.status})`
  }
}

export async function fetchMe() {
  const response = await fetch(`${API_BASE}api/auth/me`)
  if (response.status === 401) return null
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

export async function register({ email, password, name, role, plan }) {
  const response = await fetch(`${API_BASE}api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, role, plan }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

export async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE}api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

export async function resetPassword(token, password) {
  const response = await fetch(`${API_BASE}api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

export async function logout() {
  await fetch(`${API_BASE}api/auth/logout`, { method: 'POST' })
}

export function googleLoginUrl(role, plan) {
  return `${API_BASE}api/auth/google/login?role=${encodeURIComponent(role)}&plan=${encodeURIComponent(plan)}`
}

export async function fetchAuthConfig() {
  try {
    const response = await fetch(`${API_BASE}api/auth/config`)
    if (!response.ok) return { google_enabled: false }
    return response.json()
  } catch {
    return { google_enabled: false }
  }
}

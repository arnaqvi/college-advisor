// A student's own self-reported deadlines — GET/PUT/DELETE
// /api/colleges/deadline-overrides (see backend/app/routers/colleges.py).
// Follows profile.js's BASE_URL convention. Only used for programs with no
// curated (verified) deadline yet — see lib/engine/timelineEngine.js.
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export async function fetchDeadlineOverrides() {
  const response = await fetch(`${API_BASE}api/colleges/deadline-overrides`)
  if (!response.ok) throw new Error(`Failed to load your saved deadlines (HTTP ${response.status})`)
  return response.json()
}

export async function setDeadlineOverride(programSlug, override) {
  const response = await fetch(`${API_BASE}api/colleges/deadline-overrides/${encodeURIComponent(programSlug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(override),
  })
  if (!response.ok) throw new Error(`Failed to save that deadline (HTTP ${response.status})`)
  return response.json()
}

export async function deleteDeadlineOverride(programSlug) {
  const response = await fetch(`${API_BASE}api/colleges/deadline-overrides/${encodeURIComponent(programSlug)}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(`Failed to remove that deadline (HTTP ${response.status})`)
}

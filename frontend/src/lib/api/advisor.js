// AI Advisor chat — POST /api/advisor/chat (see backend/app/routers/advisor.py).
// Stateless on the server: this module owns the running conversation and
// resends it (capped) on every call, same convention as the backend's
// per-request `history` field.
//
// Follows profile.js's BASE_URL convention (fetch() paths resolve against
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

// Only role + content travel over the wire — matches ChatMessage on the backend.
export async function sendAdvisorMessage(message, history) {
  const response = await fetch(`${API_BASE}api/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return response.json()
}

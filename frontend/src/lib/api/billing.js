// Real Stripe Checkout integration — replaces the old fake `/subscribe` flow
// for paid plans (see backend/app/routers/billing.py's module docstring).
// Same-origin session cookie auth, same BASE_URL convention as
// lib/api/auth.js / lib/api/colleges.js.
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

async function parseErrorDetail(response) {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
    if (body.detail?.message) return body.detail.message
    return `Request failed (HTTP ${response.status})`
  } catch {
    return `Request failed (HTTP ${response.status})`
  }
}

// Returns `{ checkout_url }` to redirect the browser to, or throws with a
// readable message — including the "Stripe isn't set up yet" not_configured
// case, which the backend reports as a 400 with a structured detail body.
// `interval` is `'month'` (default) or `'year'` — must match a key in
// backend/app/routers/billing.py's `_CHECKOUT_PLAN_PRICING`.
export async function createCheckoutSession(plan, interval = 'month') {
  const response = await fetch(`${API_BASE}api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, interval }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

// Server-side verification of a completed Checkout session — only after this
// confirms payment does the backend grant the plan. Returns
// `{ status: 'paid' | 'pending' | 'not_configured', plan, message }`.
export async function verifyCheckoutSession(sessionId) {
  const response = await fetch(
    `${API_BASE}api/billing/checkout/verify?session_id=${encodeURIComponent(sessionId)}`
  )
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

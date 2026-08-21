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

export async function submitFeedback({ name, email, message }) {
  const response = await fetch(`${API_BASE}api/feedback/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, message }),
  })
  if (!response.ok) throw new Error(await parseErrorDetail(response))
  return response.json()
}

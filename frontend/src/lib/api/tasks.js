// Timeline task tracking — GET/PUT /api/tasks/completions, CRUD
// /api/tasks/custom (see backend/app/routers/tasks.py). Follows profile.js's
// BASE_URL convention.
const API_BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export async function fetchCompletions() {
  const response = await fetch(`${API_BASE}api/tasks/completions`)
  if (!response.ok) throw new Error(`Failed to load your saved progress (HTTP ${response.status})`)
  const body = await response.json()
  return body.completed_slugs
}

export async function setCompletion(slug, completed) {
  const response = await fetch(`${API_BASE}api/tasks/completions/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  if (!response.ok) throw new Error(`Failed to save that change (HTTP ${response.status})`)
  return response.json()
}

export async function fetchCustomTasks() {
  const response = await fetch(`${API_BASE}api/tasks/custom`)
  if (!response.ok) throw new Error(`Failed to load your tasks (HTTP ${response.status})`)
  return response.json()
}

export async function createCustomTask({ title, category, month = null, dueDate = null }) {
  const response = await fetch(`${API_BASE}api/tasks/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, month, due_date: dueDate }),
  })
  if (!response.ok) throw new Error(`Failed to add that task (HTTP ${response.status})`)
  return response.json()
}

export async function updateCustomTask(id, patch) {
  const response = await fetch(`${API_BASE}api/tasks/custom/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Failed to save that change (HTTP ${response.status})`)
  return response.json()
}

export async function deleteCustomTask(id) {
  const response = await fetch(`${API_BASE}api/tasks/custom/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`Failed to delete that task (HTTP ${response.status})`)
}

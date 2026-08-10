// Counselor Bias Check — per-college admissions bias research, POST
// /api/bias-research/college/{programSlug} (see backend/app/routers/
// bias_research.py). Keyed by program slug, not a college id — every
// college/program object the frontend already has (from `colleges` in
// AppContext, e.g. studentProfile.counselorCollegeList) uses `id` =
// Program.slug (see backend/app/schemas/college.py), never the numeric
// College PK, so that's what this call takes too.
// Follows advisor.js's BASE_URL convention (fetch() paths resolve against
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

export async function researchCollegeBias(programSlug) {
  const response = await fetch(`${API_BASE}api/bias-research/college/${programSlug}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return response.json()
}

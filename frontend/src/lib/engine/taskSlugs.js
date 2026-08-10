// Stable identity for system-generated Timeline tasks. The backend only
// ever stores "this slug, for this user, is done" (see lib/api/tasks.js /
// backend/app/models/tasks.py) — it never needs to know the task's text,
// since the frontend already computes that deterministically from
// data/timeline.js + the student's classified program list. Content-based
// (not index-based) so reordering data/timeline.js doesn't silently
// reassign someone's checked state to a different task.
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function systemTaskSlug(month, category, text) {
  return `system:${month}:${category}:${slugify(text)}`
}

// Keyed by program id alone (not tier/decision-type) so a student's progress
// on "deal with this school's deadline" survives a tier reclassification
// (e.g. a later GPA update moves a school from Reach to Target) instead of
// silently resetting.
export function deadlineTaskSlug(programId) {
  return `system:deadline:${programId}`
}

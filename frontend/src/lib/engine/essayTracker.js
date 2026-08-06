// Spec 3.8 — Essay Tracker. Enriches each logged essay with progress and a
// reuse/overlap warning. Draft version history is explicitly out of scope
// for this pass (see plan) — only the latest draft per essay is tracked.

// Counts words in free-form essay text — splits on any run of whitespace and
// drops empty tokens (so leading/trailing/multiple spaces don't inflate the count).
export function countWords(text) {
  if (!text) return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function deriveEssayStatus(profile) {
  const essays = profile.essays || []
  // Word count is always derived from the essay text itself (never trusted from
  // stored state) — this is what makes the count "live" and also self-heals any
  // essay saved before this field was wired up (previously stuck at 0).
  const withWordCount = essays.map((e) => ({ ...e, wordCount: countWords(e.promptText) }))
  const byId = Object.fromEntries(withWordCount.map((e) => [e.id, e]))

  return withWordCount.map((e) => {
    const progressPercent = e.wordLimit ? Math.min(100, Math.round(((e.wordCount || 0) / e.wordLimit) * 100)) : 0

    let overlapWarning = false
    const source = e.reusedFromEssayId ? byId[e.reusedFromEssayId] : null
    if (source) {
      const diff = Math.abs((source.wordCount || 0) - (e.wordCount || 0))
      overlapWarning = diff < Math.max(30, (e.wordLimit || 0) * 0.1)
    }

    return { ...e, progressPercent, overlapWarning }
  })
}

// "This Week's Hidden Gem" — a rotating discovery feed over the student's
// own already-computed, uncapped hiddenGems list (see hiddenGems.js). Never
// hides or caps the full list — see college_advisor_retention_strategy
// memory for why coverage stays fully visible and only the FEATURED pick
// rotates. Pure function of (gems, current time): no backend, no stored
// state. Deterministic within a calendar week and stable across re-renders,
// changes on the next week so there's a genuine reason to check back.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function weekIndex(date) {
  return Math.floor(date.getTime() / WEEK_MS)
}

export function pickWeeklyGem(gems, date = new Date()) {
  if (!gems || gems.length === 0) return null
  return gems[weekIndex(date) % gems.length]
}

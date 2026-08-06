// Shared parsing helpers for the deterministic recommendation engine.
// Every engine module reads studentProfile fields through these — user input
// is always text/strings, so nothing downstream should call parseFloat/split
// directly on a raw profile field.

export function parseNumber(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function parseCourseList(text) {
  return (text || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

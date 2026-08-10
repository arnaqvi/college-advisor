// Profile completion % — a curated subset of Profile.jsx's fields, not all of
// them. These are the fields that actually drive fit-scoring/recommendations
// (see classification.js's Incomplete-tier check and recommendationEngine.js),
// unlike lower-stakes background fields (ethnicity, languages, work
// experience) which stay optional and uncounted.
//
// A field the student marks "N/A" (stored as its `name` in
// `studentProfile.notApplicableFields`) is excluded from BOTH the numerator
// and denominator — completion is "how much of what applies to you is
// filled in," not "how many of these ten fields have a value."
export const CORE_COMPLETION_FIELDS = [
  { name: 'gpaUnweighted', label: 'Unweighted GPA' },
  { name: 'satTotal', label: 'SAT Score' },
  { name: 'actComposite', label: 'ACT Score' },
  { name: 'gradeLevel', label: 'Grade Level' },
  { name: 'intendedMajors', label: 'Intended Major(s)', list: true },
  { name: 'targetStates', label: 'Target States', list: true },
  { name: 'extracurriculars', label: 'Extracurricular Activities' },
  { name: 'awards', label: 'Awards & Honors' },
  { name: 'highSchoolName', label: 'High School Name' },
  { name: 'homeState', label: 'Home State' },
]

export const CORE_COMPLETION_FIELD_NAMES = new Set(CORE_COMPLETION_FIELDS.map((f) => f.name))

function isFieldFilled(profile, field) {
  const value = profile[field.name]
  if (field.list) return Array.isArray(value) && value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

// A field marked N/A counts as neither missing nor filled — it's removed
// from consideration entirely. If every core field is marked N/A, treat
// completion as 100% ("everything that applies to you is done") rather than
// 0/0 reading as incomplete.
export function calculateProfileCompletion(profile) {
  const naFields = new Set(profile.notApplicableFields || [])
  const applicable = CORE_COMPLETION_FIELDS.filter((f) => !naFields.has(f.name))
  const missingFields = applicable.filter((f) => !isFieldFilled(profile, f)).map((f) => ({ name: f.name, label: f.label }))
  const completedCount = applicable.length - missingFields.length
  const percent = applicable.length === 0 ? 100 : Math.round((completedCount / applicable.length) * 100)

  return {
    percent,
    completedCount,
    totalCount: applicable.length,
    missingFields,
  }
}

// Re-trigger mapping from collegepath-master-prompt-spec.md, Section 1.1:
// "the full engine (or the relevant subset of modules) should re-run automatically
// whenever the student edits transcript/planned courses (-> re-run 3.1, 3.4, 3.5, 3.12),
// adds/removes an activity (-> re-run 3.6, 3.12), adds a counselor list (-> run 3.11)..."
//
// This mirrors the spec's field groups so the Profile tab can tell a user which
// downstream modules are stale, per Section 5: "every downstream recommendation
// should visibly refresh (or flag 'may be outdated -- refresh?') when inputs change."
export const FIELD_GROUPS = [
  {
    id: 'transcript',
    label: 'Transcript & Planned Courses',
    fields: [
      'gpaWeighted',
      'gpaUnweighted',
      'classRank',
      'classSize',
      'apCourses',
      'ibCourses',
      'honorsCourses',
      'satTotal',
      'actComposite',
      'plannedCourses',
      'intendedMajors',
    ],
    modules: [
      '3.1 College Classification (Reach/Target/Safety)',
      '3.4 Program Alignment',
      '3.5 Hidden Gem Discovery',
      '3.12 Application Gap Analysis',
    ],
  },
  {
    id: 'activities',
    label: 'Extracurriculars & Awards',
    fields: ['extracurriculars', 'awards', 'activities'],
    modules: ['3.6 Extracurricular Gap Analysis', '3.12 Application Gap Analysis'],
  },
  {
    id: 'counselor',
    label: 'School & Counselor Context',
    fields: ['highSchoolName', 'counselorName', 'counselorEmail', 'counselorCollegeList'],
    modules: ['3.11 Counselor Bias Check'],
  },
]

// Field-level equality that works for both scalar (string) fields and the
// array/object fields added alongside the derived-plan engine — a plain
// `!==` comparison always reports arrays as changed (different references),
// even when their contents are identical, so this falls back to a structural
// comparison for anything that isn't a string.
function fieldsEqual(a, b) {
  if (typeof a === 'string' || typeof b === 'string' || a == null || b == null) {
    return (a || '') === (b || '')
  }
  return JSON.stringify(a) === JSON.stringify(b)
}

// Compares a profile against the snapshot it was last synced against and
// returns the field groups (per Section 1.1) whose modules are now stale.
export function getStaleGroups(baseline, current) {
  if (!baseline) return []
  return FIELD_GROUPS.filter((group) =>
    group.fields.some((field) => !fieldsEqual(baseline[field], current[field]))
  )
}

// Spec 3.6 — Extracurricular Gap Analysis. Ranked additions tagged by
// type/target program/feasibility/format, informed by the student's intended
// majors and what they've already logged in Profile > activities.
const ACTIVITY_SUGGESTIONS_BY_DEPT = {
  'Computer Science': [
    { type: 'Competitive programming club or hackathon', mode: 'local', feasibility: 'High' },
    { type: 'Personal coding project (portfolio/GitHub)', mode: 'virtual', feasibility: 'High' },
  ],
  Engineering: [
    { type: 'Robotics or FIRST team', mode: 'local', feasibility: 'Medium' },
    { type: 'Summer engineering pre-college program', mode: 'summer', feasibility: 'Medium' },
  ],
  Business: [{ type: 'DECA/FBLA chapter or a student-run business', mode: 'local', feasibility: 'High' }],
  Biology: [{ type: 'Lab volunteering or research assistantship', mode: 'local', feasibility: 'Medium' }],
  Psychology: [{ type: 'Peer counseling or mental-health advocacy club', mode: 'local', feasibility: 'High' }],
  English: [{ type: 'Literary magazine or a writing competition', mode: 'virtual', feasibility: 'High' }],
  'Visual Arts': [{ type: 'Portfolio-building studio class or exhibition', mode: 'local', feasibility: 'Medium' }],
  Nursing: [{ type: 'Hospital/clinic volunteering (CNA track)', mode: 'local', feasibility: 'Medium' }],
}

export function analyzeActivityGaps(profile, classifiedPrograms) {
  const majors = profile.intendedMajors?.length
    ? profile.intendedMajors
    : [...new Set(classifiedPrograms.map((p) => p.dept))].slice(0, 2)

  const existingTypes = new Set((profile.activities || []).map((a) => (a.type || '').toLowerCase()))
  const hasLeadership = (profile.activities || []).some((a) => a.leadership)

  const suggestions = []
  if (!hasLeadership) {
    suggestions.push({
      type: 'A leadership role (officer, captain, founder) in an existing activity',
      mode: 'local',
      feasibility: 'High',
      targetsPrograms: [],
    })
  }
  for (const major of majors) {
    for (const s of ACTIVITY_SUGGESTIONS_BY_DEPT[major] || []) {
      if (!existingTypes.has(s.type.toLowerCase())) {
        suggestions.push({
          ...s,
          targetsPrograms: classifiedPrograms.filter((p) => p.dept === major).map((p) => p.id),
        })
      }
    }
  }

  return suggestions.slice(0, 6)
}

// Output #1 — Snapshot. Rolls the profile + classified list into the
// strengths/gaps summary shown on Dashboard.
export function buildSnapshot(profile, classifiedPrograms) {
  const complete = classifiedPrograms.filter((p) => p.tier !== 'Incomplete')
  const tierCounts = complete.reduce((acc, p) => {
    acc[p.tier] = (acc[p.tier] || 0) + 1
    return acc
  }, {})

  const strengths = []
  const gaps = []

  if (profile.gpaUnweighted || profile.gpaWeighted) {
    const parts = []
    if (profile.gpaUnweighted) parts.push(`${profile.gpaUnweighted} unweighted`)
    if (profile.gpaWeighted) parts.push(`${profile.gpaWeighted} weighted`)
    strengths.push(`GPA of ${parts.join(' / ')} on file`)
  } else gaps.push('Add your GPA to unlock accurate classification')

  if (profile.satTotal || profile.actComposite) strengths.push('Test scores on file')
  else gaps.push('Add SAT/ACT scores to unlock accurate classification')

  if ((profile.activities || []).length >= 3) strengths.push(`${profile.activities.length} extracurricular activities logged`)
  else gaps.push('Log more extracurricular activities for a stronger profile')

  if ((profile.essays || []).length > 0) strengths.push(`${profile.essays.length} essay(s) in progress`)
  else gaps.push('Start at least one essay')

  return {
    gpa: profile.gpaUnweighted || profile.gpaWeighted || null,
    testScores: profile.satTotal || profile.actComposite ? { sat: profile.satTotal || null, act: profile.actComposite || null } : null,
    intendedMajors: profile.intendedMajors || [],
    tierCounts,
    strengths,
    gaps,
  }
}

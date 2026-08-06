// Spec 3.11 — Counselor Bias Detection. Compares a counselor-supplied list
// (studentProfile.counselorCollegeList) against the student's own classified
// list and flags concentration/skew. Only runs when a counselor list exists.
export function checkCounselorBias(profile, classifiedPrograms) {
  const counselorIds = profile.counselorCollegeList || []
  if (counselorIds.length === 0) return null

  const counselorPrograms = classifiedPrograms.filter((p) => counselorIds.includes(p.id))
  const concentrationFlags = []

  const byType = counselorPrograms.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {})
  Object.entries(byType).forEach(([type, count]) => {
    if (count / counselorPrograms.length > 0.7) {
      concentrationFlags.push(`${Math.round((count / counselorPrograms.length) * 100)}% of the counselor's list is ${type} schools.`)
    }
  })

  const byTier = counselorPrograms.reduce((acc, p) => {
    acc[p.tier] = (acc[p.tier] || 0) + 1
    return acc
  }, {})
  if (!byTier.Reach) concentrationFlags.push("The counselor's list includes no Reach schools.")
  if (!byTier.Safety) concentrationFlags.push("The counselor's list includes no Safety schools.")

  const counselorStates = new Set(counselorPrograms.map((p) => p.state))
  const missingCategories = [...new Set(classifiedPrograms.map((p) => p.category))].filter(
    (cat) => !counselorPrograms.some((p) => p.category === cat)
  )

  const suggestedAdditions = classifiedPrograms
    .filter((p) => !counselorIds.includes(p.id) && (missingCategories.includes(p.category) || !counselorStates.has(p.state)))
    .map((p) => p.id)
    .slice(0, 5)

  return { concentrationFlags, missingCategories, suggestedAdditions }
}

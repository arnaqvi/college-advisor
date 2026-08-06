// Spec 3.2 (Public/Private segmentation) + 3.3 (State coverage).
export function segmentByTypeAndState(classifiedPrograms, profile) {
  const byType = classifiedPrograms.reduce((acc, p) => {
    acc[p.type] = acc[p.type] || []
    acc[p.type].push(p)
    return acc
  }, {})

  const byState = classifiedPrograms.reduce((acc, p) => {
    acc[p.state] = acc[p.state] || []
    acc[p.state].push(p)
    return acc
  }, {})

  const targetStates = Array.isArray(profile?.targetStates) ? profile.targetStates : []
  const stateCoverageGaps = targetStates.filter((state) => !byState[state] || byState[state].length === 0)

  return { byType, byState, stateCoverageGaps }
}

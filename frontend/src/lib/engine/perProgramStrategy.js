// Output #7 (Per-Program Strategy) — what to emphasize for a given program
// based on its tier and any remaining prerequisite gaps.
export function buildStrategy(profile, program, alignment) {
  const hasGaps = (alignment?.gapCourses || []).length > 0

  let note
  if (program.tier === 'Reach') {
    note = `${program.name} is a Reach — a distinctive, specific essay and strong recommenders matter most here.`
  } else if (program.tier === 'Safety') {
    note = `${program.name} is a Safety — a solid, on-time application is sufficient.`
  } else if (program.tier === 'Target') {
    note = `${program.name} is a Target — ${hasGaps ? 'round out coursework gaps and ' : ''}keep essays focused on fit.`
  } else {
    note = 'Add your GPA and test scores in Profile to get program-specific strategy.'
  }

  return {
    programId: program.id,
    programName: program.name,
    emphasizeEssays: program.tier === 'Reach',
    emphasizeActivities: !hasGaps && program.tier !== 'Safety',
    emphasizeRecommenders: program.tier === 'Reach' || program.tier === 'Target',
    note,
  }
}

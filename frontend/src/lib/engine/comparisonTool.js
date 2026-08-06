// Spec 3.10 — Side-by-side comparison tool.
export function compareColleges(profile, collegeIds, classifiedPrograms) {
  const columns = (collegeIds || [])
    .map((id) => classifiedPrograms.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.name,
      dept: p.dept,
      tier: p.tier,
      type: p.type,
      admitRate: p.admitRate,
      ranking: p.ranking,
      cost: p.type === 'Public' ? 'Lower (in-state tuition available)' : 'Higher (private tuition)',
      deadlines: p.type === 'Public' ? 'Typically Regular Decision, rolling in some states' : 'Early Action/Decision options available',
    }))

  let synthesisLine = 'Select at least two colleges to compare.'
  if (columns.length >= 2) {
    const tiers = [...new Set(columns.map((c) => c.tier))]
    synthesisLine =
      tiers.length > 1
        ? `This comparison spans ${tiers.join(', ')} tiers — a balanced pairing for your list.`
        : `All selected colleges are ${tiers[0]} tier — consider comparing against a school from a different tier for balance.`
  }

  return { columns, synthesisLine }
}

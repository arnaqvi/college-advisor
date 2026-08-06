// Spec 3.12 — Verified Applicant Benchmark & Gap Analysis. No consented,
// verified applicant dataset exists in this app, and the spec explicitly
// requires saying so rather than fabricating a comparison — so this always
// returns an "insufficient verified data" status. The completeness checklist
// itself is real, derived from the student's own logged data.
export function gapAnalysisForCollege(profile, program) {
  const completenessChecklist = [
    {
      label: 'GPA & test scores on file',
      complete: Boolean((profile.gpaUnweighted || profile.gpaWeighted) && (profile.satTotal || profile.actComposite)),
    },
    { label: 'At least one extracurricular activity logged', complete: (profile.activities || []).length > 0 },
    { label: 'At least one essay in progress', complete: (profile.essays || []).length > 0 },
    { label: 'Counselor context provided', complete: Boolean(profile.counselorName) },
  ]

  return {
    programId: program.id,
    programName: program.name,
    status: 'insufficient_verified_data',
    message:
      'Insufficient verified data — CollegePath does not have consented, verified applicant outcomes for this program yet.',
    completenessChecklist,
  }
}

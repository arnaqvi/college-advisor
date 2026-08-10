// Dashboard "Ask your advisor" nudge — picks one contextual, natural-language
// question from the student's actual state (gaps, then upcoming deadlines,
// then a evergreen fallback) so the AI Advisor reads as a helpful next step
// rather than a generic empty chat box. Priority: an unaddressed profile gap
// beats a distant deadline, since it's actionable today.
const GAP_PROMPTS = {
  'Add your GPA to unlock accurate classification': 'How much does my GPA matter for the schools on my list?',
  'Add SAT/ACT scores to unlock accurate classification':
    'Should I retake the SAT or ACT, and how much do test-optional policies really matter?',
  'Log more extracurricular activities for a stronger profile':
    'What extracurriculars would actually strengthen my application?',
  'Start at least one essay': 'How do I get started brainstorming my college essay?',
}

const FALLBACK_PROMPT = 'How can I make my application stand out for my reach schools?'

export function pickAdvisorPrompt(snapshot, roadmap) {
  const gap = (snapshot.gaps || []).find((g) => GAP_PROMPTS[g])
  if (gap) return GAP_PROMPTS[gap]

  const nextDeadline = (roadmap || [])
    .flatMap((m) => m.hardDeadlines)
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (nextDeadline) return `What should I prioritize before the ${nextDeadline.label}?`

  return FALLBACK_PROMPT
}

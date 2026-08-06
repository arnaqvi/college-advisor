// Derives completion % + sub-meters from context state (design doc §1, §5).
// The server's `GET /completion-summary` is the single implementation of the
// scoring logic — this hook is "a thin cache/optimistic-UI layer over this
// endpoint" per §5: it fetches (debounced) whenever section data changes,
// and falls back to a quick local weighted estimate (§1 weights) so the UI
// has an immediate number before the round trip completes or if the backend
// route isn't available yet.

import { useEffect, useState } from 'react'
import { getCompletionSummary } from '../api/onboardingClient.ts'
import type { OnboardingState } from '../context/onboardingReducer.ts'
import type { CompletionSummary } from '../types/onboarding.ts'
import { SECTION_WEIGHTS } from '../types/onboarding.ts'

const REFRESH_DEBOUNCE_MS = 500

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function localEstimate(state: OnboardingState): number {
  const { sections } = state
  let totalWeight = 0
  let earnedWeight = 0

  const score = (weight: number, done: boolean): void => {
    totalWeight += weight
    if (done) earnedWeight += weight
  }

  score(SECTION_WEIGHTS.basicInfo, hasValue(sections.basicInfo.student_name) && hasValue(sections.basicInfo.graduation_year))
  score(SECTION_WEIGHTS.academic, Boolean(sections.academicRecord && hasValue(sections.academicRecord.high_school_name)))
  score(SECTION_WEIGHTS.tests, sections.testScores.length > 0)
  score(SECTION_WEIGHTS.volunteer, sections.volunteerExperiences.length > 0)
  score(SECTION_WEIGHTS.projects, sections.projects.length > 0 || sections.internships.length > 0)
  score(SECTION_WEIGHTS.awards, sections.awards.length > 0)
  score(SECTION_WEIGHTS.recommendations, sections.recommendations.length > 0)
  score(SECTION_WEIGHTS.certifications, sections.certifications.length > 0)

  return totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100)
}

export interface CompletionScoreInfo {
  percent: number
  summary: CompletionSummary | null
  loading: boolean
}

export function useCompletionScore(state: OnboardingState, email: string | null): CompletionScoreInfo {
  const [summary, setSummary] = useState<CompletionSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!email || !state.hydrated) return undefined

    const handle = window.setTimeout(() => {
      setLoading(true)
      getCompletionSummary(email)
        .then((result) => setSummary(result))
        .catch(() => {
          // No completion-summary backend yet (or a transient failure) —
          // the local estimate below keeps the ring/meters responsive.
        })
        .finally(() => setLoading(false))
    }, REFRESH_DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sections, email, state.hydrated])

  return {
    percent: summary ? summary.profile_completion_pct : localEstimate(state),
    summary,
    loading,
  }
}

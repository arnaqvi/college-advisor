// Debounced PATCH/PUT autosave (design doc §7): subscribes to `dirty`,
// debounces 2s per section key (not globally — editing one section shouldn't
// delay an in-flight save for another), calls the matching API client
// function, clears that key from `dirty` on success, and retries with
// exponential backoff on failure while surfacing a "not saved — retrying"
// status.
//
// Scoped to the two singular-record sections (`basicInfo`, `academicRecord`)
// — list-backed sections (volunteer experiences, awards, ...) persist
// per-item immediately through the CRUD helpers exposed by OnboardingContext
// instead, since the backend's per-id POST/PATCH/DELETE shape (§5) doesn't
// have a "save the whole list" endpoint to debounce against.

import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { putAcademicRecord } from '../api/onboardingClient.ts'
import type { OnboardingAction, OnboardingState } from '../context/onboardingReducer.ts'

const DEBOUNCE_MS = 2000
const MAX_RETRY_DELAY_MS = 30_000
const BASIC_INFO_STORAGE_KEY = 'onboarding.basicInfo.v1'

const AUTOSAVED_SECTIONS = ['basicInfo', 'academicRecord'] as const
export type AutosavedSection = (typeof AUTOSAVED_SECTIONS)[number]

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AutosaveInfo {
  status: Record<AutosavedSection, SaveStatus>
  lastSavedAt: Record<AutosavedSection, string | null>
}

export function useAutosave(
  state: OnboardingState,
  dispatch: Dispatch<OnboardingAction>,
  email: string | null,
): AutosaveInfo {
  const [status, setStatus] = useState<Record<AutosavedSection, SaveStatus>>({
    basicInfo: 'idle',
    academicRecord: 'idle',
  })
  const [lastSavedAt, setLastSavedAt] = useState<Record<AutosavedSection, string | null>>({
    basicInfo: null,
    academicRecord: null,
  })
  const timers = useRef<Partial<Record<AutosavedSection, number>>>({})
  const retryDelays = useRef<Partial<Record<AutosavedSection, number>>>({})
  const stateRef = useRef(state)
  stateRef.current = state

  async function save(section: AutosavedSection): Promise<void> {
    if (!email) return
    setStatus((prev) => ({ ...prev, [section]: 'saving' }))
    try {
      const current = stateRef.current
      if (section === 'academicRecord' && current.sections.academicRecord) {
        await putAcademicRecord(email, current.sections.academicRecord)
      } else if (section === 'basicInfo') {
        // No dedicated backend route exists yet for student name/email — per
        // the legacy-mapping note in §4, those belong to the future `users`
        // table, not an onboarding resource. Buffer to localStorage using the
        // same offline-write pattern §7 describes for failed PATCHes, until a
        // profile endpoint exists to call instead.
        window.localStorage.setItem(BASIC_INFO_STORAGE_KEY, JSON.stringify(current.sections.basicInfo))
      }
      retryDelays.current[section] = undefined
      dispatch({ type: 'MARK_CLEAN', section })
      setStatus((prev) => ({ ...prev, [section]: 'saved' }))
      setLastSavedAt((prev) => ({ ...prev, [section]: new Date().toISOString() }))
    } catch {
      const nextDelay = Math.min((retryDelays.current[section] ?? DEBOUNCE_MS) * 2, MAX_RETRY_DELAY_MS)
      retryDelays.current[section] = nextDelay
      setStatus((prev) => ({ ...prev, [section]: 'error' }))
      timers.current[section] = window.setTimeout(() => void save(section), nextDelay)
    }
  }

  useEffect(() => {
    if (!email) return
    for (const section of AUTOSAVED_SECTIONS) {
      if (!state.dirty.has(section)) continue
      const existing = timers.current[section]
      if (existing) window.clearTimeout(existing)
      timers.current[section] = window.setTimeout(() => void save(section), DEBOUNCE_MS)
    }
    // Only the identity of `dirty` and the two autosaved section slices
    // should re-arm the debounce timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dirty, state.sections.basicInfo, state.sections.academicRecord, email])

  useEffect(() => {
    const timersAtMount = timers.current
    return () => {
      Object.values(timersAtMount).forEach((id) => {
        if (id) window.clearTimeout(id)
      })
    }
  }, [])

  return { status, lastSavedAt }
}

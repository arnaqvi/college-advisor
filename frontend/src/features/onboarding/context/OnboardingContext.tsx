// useReducer + autosave + undo-toast state (design doc §7). Server is the
// source of truth on load — mount does one GET per resource (parallelized),
// not a localStorage read, so progress survives a device switch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { trackEvent } from '../../../lib/trackEvent.js'
import {
  awardsApi,
  certificationsApi,
  deleteFileUpload,
  getAcademicRecord,
  getProgress,
  internshipsApi,
  projectsApi,
  recommendationsApi,
  testScoresApi,
  updateProgress,
  volunteerExperiencesApi,
} from '../api/onboardingClient.ts'
import { useAutosave, type AutosaveInfo } from '../hooks/useAutosave.ts'
import { useCompletionScore } from '../hooks/useCompletionScore.ts'
import { useUndo } from '../hooks/useUndo.ts'
import {
  initialOnboardingState,
  onboardingReducer,
  type ListItem,
  type ListSectionKey,
  type OnboardingAction,
  type OnboardingState,
} from './onboardingReducer.ts'
import type {
  AcademicRecord,
  Award,
  AwardDraft,
  BasicInfo,
  Certification,
  CertificationDraft,
  CompletionSummary,
  Internship,
  InternshipDraft,
  PersonalProject,
  PersonalProjectDraft,
  Recommendation,
  RecommendationDraft,
  StepKey,
  TestScore,
  TestScoreDraft,
  UploadedFile,
  VolunteerExperience,
  VolunteerExperienceDraft,
} from '../types/onboarding.ts'

const MILESTONE_THRESHOLDS = [25, 50, 75, 100]

interface ListSectionApi<T, TDraft> {
  create: (email: string, draft: TDraft) => Promise<T>
  update: (email: string, id: number, patch: Partial<TDraft>) => Promise<T>
  remove: (email: string, id: number) => Promise<void>
}

interface ListSectionControls<T, TDraft> {
  items: T[]
  add: (draft: TDraft) => Promise<void>
  update: (id: number, patch: Partial<TDraft>) => void
  remove: (id: number, label: string) => void
}

interface UndoPayload {
  section: ListSectionKey
  item: ListItem
  index: number
}

export interface MilestoneToastState {
  pct: number
}

export interface OnboardingContextValue {
  state: OnboardingState
  percent: number
  completionSummary: CompletionSummary | null
  completionLoading: boolean
  saveStatus: AutosaveInfo
  undoToast: { message: string; onUndo: () => void } | null
  milestoneToast: MilestoneToastState | null
  dismissMilestoneToast: () => void
  setBasicInfo: (patch: Partial<BasicInfo>) => void
  setAcademicRecord: (patch: Partial<AcademicRecord>) => void
  goToStep: (step: StepKey) => void
  markStepComplete: (step: StepKey) => void
  testScores: ListSectionControls<TestScore, TestScoreDraft>
  volunteer: ListSectionControls<VolunteerExperience, VolunteerExperienceDraft>
  internships: ListSectionControls<Internship, InternshipDraft>
  projects: ListSectionControls<PersonalProject, PersonalProjectDraft>
  awards: ListSectionControls<Award, AwardDraft>
  recommendations: ListSectionControls<Recommendation, RecommendationDraft>
  certifications: ListSectionControls<Certification, CertificationDraft>
  files: {
    items: UploadedFile[]
    addFile: (file: UploadedFile) => void
    removeFile: (id: number) => void
  }
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

function useListSection<T extends { id: number }, TDraft>(
  section: ListSectionKey,
  api: ListSectionApi<T, TDraft>,
  items: T[],
  email: string | null,
  dispatch: Dispatch<OnboardingAction>,
  pushUndo: (message: string, data: UndoPayload, onExpire: (data: UndoPayload) => void) => void,
): ListSectionControls<T, TDraft> {
  const add = useCallback(
    async (draft: TDraft) => {
      if (!email) return
      try {
        const created = await api.create(email, draft)
        dispatch({ type: 'ADD_LIST_ITEM', section, item: created as unknown as ListItem })
      } catch {
        // Matches trackEvent.js's convention: fail silently until the
        // backend route exists / is reachable, rather than crash the step.
      }
    },
    [api, dispatch, email, section],
  )

  const update = useCallback(
    (id: number, patch: Partial<TDraft>) => {
      dispatch({ type: 'UPDATE_LIST_ITEM', section, id, patch: patch as Partial<ListItem> })
      if (!email) return
      void api.update(email, id, patch).catch(() => {
        // Optimistic UI keeps the local edit even if the PATCH fails; the
        // section is left dirty so a future retry mechanism can pick it up.
      })
    },
    [api, dispatch, email, section],
  )

  const remove = useCallback(
    (id: number, label: string) => {
      const index = items.findIndex((entry) => entry.id === id)
      if (index === -1) return
      const item = items[index]
      dispatch({ type: 'REMOVE_LIST_ITEM', section, id })
      pushUndo(`Removed ${label}`, { section, item: item as unknown as ListItem, index }, (data) => {
        if (!email) return
        void api.remove(email, data.item.id).catch(() => {})
      })
    },
    [api, dispatch, email, items, pushUndo, section],
  )

  return { items, add, update, remove }
}

export function OnboardingProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth()
  const email: string | null = user?.email ?? null
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState)
  const [milestoneToast, setMilestoneToast] = useState<MilestoneToastState | null>(null)
  const firedMilestones = useRef<Set<number>>(new Set())

  const undoState = useUndo<UndoPayload>()

  const saveStatus = useAutosave(state, dispatch, email)
  const { percent, summary: completionSummary, loading: completionLoading } = useCompletionScore(state, email)

  useEffect(() => {
    if (!email) return
    let cancelled = false

    async function hydrate(): Promise<void> {
      const [progress, academicRecord, testScores, volunteerExperiences, internships, projects, awards, recommendations, certifications] =
        await Promise.allSettled([
          getProgress(email as string),
          getAcademicRecord(email as string),
          testScoresApi.list(email as string),
          volunteerExperiencesApi.list(email as string),
          internshipsApi.list(email as string),
          projectsApi.list(email as string),
          awardsApi.list(email as string),
          recommendationsApi.list(email as string),
          certificationsApi.list(email as string),
        ])

      if (cancelled) return

      const value = <V,>(result: PromiseSettledResult<V>): V | undefined =>
        result.status === 'fulfilled' ? result.value : undefined

      dispatch({
        type: 'HYDRATE',
        payload: {
          progress: value(progress) ?? null,
          academicRecord: value(academicRecord) ?? null,
          testScores: value(testScores) ?? [],
          volunteerExperiences: value(volunteerExperiences) ?? [],
          internships: value(internships) ?? [],
          projects: value(projects) ?? [],
          awards: value(awards) ?? [],
          recommendations: value(recommendations) ?? [],
          certifications: value(certifications) ?? [],
        },
      })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [email, dispatch])

  useEffect(() => {
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (percent >= threshold && !firedMilestones.current.has(threshold)) {
        firedMilestones.current.add(threshold)
        setMilestoneToast({ pct: threshold })
        void trackEvent({
          component: 'onboarding',
          eventType: 'milestone_reached',
          metadata: { pct: threshold },
        })
      }
    }
  }, [percent])

  const setBasicInfo = useCallback(
    (patch: Partial<BasicInfo>) => dispatch({ type: 'SET_BASIC_INFO', patch }),
    [dispatch],
  )

  const setAcademicRecord = useCallback(
    (patch: Partial<AcademicRecord>) => dispatch({ type: 'SET_ACADEMIC_RECORD', patch }),
    [dispatch],
  )

  const goToStep = useCallback(
    (step: StepKey) => {
      dispatch({ type: 'SET_CURRENT_STEP', step })
      if (!email) return
      void updateProgress(email, step)
        .then((progress) => dispatch({ type: 'SET_CURRENT_STEP', step, progress }))
        .catch(() => {
          // Step navigation still works locally even if the PATCH fails.
        })
    },
    [dispatch, email],
  )

  const markStepComplete = useCallback((step: StepKey) => dispatch({ type: 'MARK_STEP_COMPLETE', step }), [dispatch])

  const restoreEntry = useCallback(
    (data: UndoPayload) => dispatch({ type: 'RESTORE_LIST_ITEM', section: data.section, item: data.item, index: data.index }),
    [dispatch],
  )

  const testScores = useListSection('testScores', testScoresApi, state.sections.testScores, email, dispatch, undoState.pushUndo)
  const volunteer = useListSection(
    'volunteerExperiences',
    volunteerExperiencesApi,
    state.sections.volunteerExperiences,
    email,
    dispatch,
    undoState.pushUndo,
  )
  const internships = useListSection('internships', internshipsApi, state.sections.internships, email, dispatch, undoState.pushUndo)
  const projects = useListSection('projects', projectsApi, state.sections.projects, email, dispatch, undoState.pushUndo)
  const awards = useListSection('awards', awardsApi, state.sections.awards, email, dispatch, undoState.pushUndo)
  const recommendations = useListSection(
    'recommendations',
    recommendationsApi,
    state.sections.recommendations,
    email,
    dispatch,
    undoState.pushUndo,
  )
  const certifications = useListSection(
    'certifications',
    certificationsApi,
    state.sections.certifications,
    email,
    dispatch,
    undoState.pushUndo,
  )

  const files = useMemo(
    () => ({
      items: state.sections.files,
      addFile: (file: UploadedFile) => dispatch({ type: 'ADD_FILE', file }),
      removeFile: (id: number) => {
        dispatch({ type: 'REMOVE_FILE', id })
        if (!email) return
        void deleteFileUpload(email, id).catch(() => {})
      },
    }),
    [dispatch, email, state.sections.files],
  )

  const undoToast = undoState.entry
    ? { message: undoState.entry.message, onUndo: () => undoState.undo(restoreEntry) }
    : null

  const value: OnboardingContextValue = {
    state,
    percent,
    completionSummary,
    completionLoading,
    saveStatus,
    undoToast,
    milestoneToast,
    dismissMilestoneToast: () => setMilestoneToast(null),
    setBasicInfo,
    setAcademicRecord,
    goToStep,
    markStepComplete,
    testScores,
    volunteer,
    internships,
    projects,
    awards,
    recommendations,
    certifications,
    files,
  }

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return ctx
}

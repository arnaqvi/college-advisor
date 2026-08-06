// Pure reducer for the onboarding feature — unit-testable in isolation (§7).
// A single flat reducer rather than one-per-section, because cross-section
// derivations (completion %) need to see every section at once anyway.

import type {
  AcademicRecord,
  Award,
  BasicInfo,
  Certification,
  Internship,
  OnboardingProgress,
  PersonalProject,
  Recommendation,
  StepKey,
  TestScore,
  UploadedFile,
  VolunteerExperience,
} from '../types/onboarding.ts'

export type ListSectionKey =
  | 'testScores'
  | 'volunteerExperiences'
  | 'internships'
  | 'projects'
  | 'awards'
  | 'recommendations'
  | 'certifications'

export type ListItem =
  | TestScore
  | VolunteerExperience
  | Internship
  | PersonalProject
  | Award
  | Recommendation
  | Certification

export interface OnboardingSections {
  basicInfo: BasicInfo
  academicRecord: AcademicRecord | null
  testScores: TestScore[]
  volunteerExperiences: VolunteerExperience[]
  internships: Internship[]
  projects: PersonalProject[]
  awards: Award[]
  recommendations: Recommendation[]
  certifications: Certification[]
  files: UploadedFile[]
}

export type SectionKey = keyof OnboardingSections

export interface OnboardingState {
  progress: OnboardingProgress | null
  sections: OnboardingSections
  dirty: Set<SectionKey>
  hydrated: boolean
  loading: boolean
  error: string | null
}

export const EMPTY_BASIC_INFO: BasicInfo = {
  student_name: '',
  email: '',
  high_school_name: '',
  graduation_year: null,
}

export const initialOnboardingState: OnboardingState = {
  progress: null,
  sections: {
    basicInfo: EMPTY_BASIC_INFO,
    academicRecord: null,
    testScores: [],
    volunteerExperiences: [],
    internships: [],
    projects: [],
    awards: [],
    recommendations: [],
    certifications: [],
    files: [],
  },
  dirty: new Set(),
  hydrated: false,
  loading: true,
  error: null,
}

export interface HydratePayload {
  progress?: OnboardingProgress | null
  basicInfo?: BasicInfo
  academicRecord?: AcademicRecord | null
  testScores?: TestScore[]
  volunteerExperiences?: VolunteerExperience[]
  internships?: Internship[]
  projects?: PersonalProject[]
  awards?: Award[]
  recommendations?: Recommendation[]
  certifications?: Certification[]
  files?: UploadedFile[]
}

export type OnboardingAction =
  | { type: 'HYDRATE'; payload: HydratePayload }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_CURRENT_STEP'; step: StepKey; progress?: OnboardingProgress }
  | { type: 'MARK_STEP_COMPLETE'; step: StepKey }
  | { type: 'SET_BASIC_INFO'; patch: Partial<BasicInfo> }
  | { type: 'SET_ACADEMIC_RECORD'; patch: Partial<AcademicRecord> }
  | { type: 'ADD_LIST_ITEM'; section: ListSectionKey; item: ListItem }
  | { type: 'UPDATE_LIST_ITEM'; section: ListSectionKey; id: number; patch: Partial<ListItem> }
  | { type: 'REMOVE_LIST_ITEM'; section: ListSectionKey; id: number }
  | { type: 'RESTORE_LIST_ITEM'; section: ListSectionKey; item: ListItem; index: number }
  | { type: 'ADD_FILE'; file: UploadedFile }
  | { type: 'REMOVE_FILE'; id: number }
  | { type: 'MARK_CLEAN'; section: SectionKey }

function withDirty(dirty: Set<SectionKey>, section: SectionKey): Set<SectionKey> {
  const next = new Set(dirty)
  next.add(section)
  return next
}

function getList(sections: OnboardingSections, section: ListSectionKey): ListItem[] {
  return sections[section] as ListItem[]
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'HYDRATE': {
      const { payload } = action
      return {
        ...state,
        progress: payload.progress ?? state.progress,
        hydrated: true,
        loading: false,
        sections: {
          ...state.sections,
          basicInfo: payload.basicInfo ?? state.sections.basicInfo,
          academicRecord: payload.academicRecord ?? state.sections.academicRecord,
          testScores: payload.testScores ?? state.sections.testScores,
          volunteerExperiences: payload.volunteerExperiences ?? state.sections.volunteerExperiences,
          internships: payload.internships ?? state.sections.internships,
          projects: payload.projects ?? state.sections.projects,
          awards: payload.awards ?? state.sections.awards,
          recommendations: payload.recommendations ?? state.sections.recommendations,
          certifications: payload.certifications ?? state.sections.certifications,
          files: payload.files ?? state.sections.files,
        },
      }
    }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        progress: action.progress ?? (state.progress ? { ...state.progress, current_step: action.step } : null),
      }

    case 'MARK_STEP_COMPLETE': {
      if (!state.progress) return state
      if (state.progress.completed_steps.includes(action.step)) return state
      return {
        ...state,
        progress: {
          ...state.progress,
          completed_steps: [...state.progress.completed_steps, action.step],
        },
      }
    }

    case 'SET_BASIC_INFO':
      return {
        ...state,
        sections: { ...state.sections, basicInfo: { ...state.sections.basicInfo, ...action.patch } },
        dirty: withDirty(state.dirty, 'basicInfo'),
      }

    case 'SET_ACADEMIC_RECORD': {
      const base: AcademicRecord = state.sections.academicRecord ?? {
        high_school_name: '',
        graduation_year: null,
        gpa: null,
        gpa_scale: '4.0',
        class_rank: null,
        rigor_courses: { ap: [], ib: [], honors: [] },
      }
      return {
        ...state,
        sections: { ...state.sections, academicRecord: { ...base, ...action.patch } },
        dirty: withDirty(state.dirty, 'academicRecord'),
      }
    }

    case 'ADD_LIST_ITEM': {
      const list = getList(state.sections, action.section)
      return {
        ...state,
        sections: { ...state.sections, [action.section]: [...list, action.item] } as OnboardingSections,
        dirty: withDirty(state.dirty, action.section),
      }
    }

    case 'UPDATE_LIST_ITEM': {
      const list = getList(state.sections, action.section)
      const nextList = list.map((entry) => (entry.id === action.id ? { ...entry, ...action.patch } : entry))
      return {
        ...state,
        sections: { ...state.sections, [action.section]: nextList } as OnboardingSections,
        dirty: withDirty(state.dirty, action.section),
      }
    }

    case 'REMOVE_LIST_ITEM': {
      const list = getList(state.sections, action.section)
      const nextList = list.filter((entry) => entry.id !== action.id)
      return {
        ...state,
        sections: { ...state.sections, [action.section]: nextList } as OnboardingSections,
        dirty: withDirty(state.dirty, action.section),
      }
    }

    case 'RESTORE_LIST_ITEM': {
      const list = [...getList(state.sections, action.section)]
      list.splice(action.index, 0, action.item)
      return {
        ...state,
        sections: { ...state.sections, [action.section]: list } as OnboardingSections,
        dirty: withDirty(state.dirty, action.section),
      }
    }

    case 'ADD_FILE':
      return {
        ...state,
        sections: { ...state.sections, files: [...state.sections.files, action.file] },
      }

    case 'REMOVE_FILE':
      return {
        ...state,
        sections: { ...state.sections, files: state.sections.files.filter((f) => f.id !== action.id) },
      }

    case 'MARK_CLEAN': {
      const next = new Set(state.dirty)
      next.delete(action.section)
      return { ...state, dirty: next }
    }

    default:
      return state
  }
}

// Typed fetch wrappers for `/api/onboarding/*` (design doc §5), proxied to the
// FastAPI backend via the existing Vite dev proxy (vite.config.js) / nginx
// `/api/` block in production.
//
// The backend's temporary dev-auth dependency (no real session/JWT yet, see
// design doc §5 note on Phase 2 auth) expects an `X-User-Email` header on
// every request, so every exported function takes the caller's email as its
// first argument — callers read it from `useAuth()` (AuthContext.jsx `user.email`)
// and pass it down. Keeping this isolated here means only this file needs to
// change once real session-based auth replaces the header.

import type {
  AcademicRecord,
  Award,
  AwardDraft,
  Certification,
  CertificationDraft,
  CompletionSummary,
  CreateFileUploadRequest,
  CreateFileUploadResponse,
  ExternalConnection,
  Internship,
  InternshipDraft,
  OnboardingProgress,
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

const BASE_URL = '/api/onboarding'

class OnboardingApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OnboardingApiError'
    this.status = status
  }
}

async function request<T>(email: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': email,
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new OnboardingApiError(`${init.method ?? 'GET'} ${path} failed with ${response.status}`, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function asJsonBody(body: unknown): string {
  return JSON.stringify(body)
}

// -- Progress -----------------------------------------------------------

export async function getProgress(email: string): Promise<OnboardingProgress> {
  return request<OnboardingProgress>(email, '/progress')
}

export async function updateProgress(email: string, current_step: StepKey): Promise<OnboardingProgress> {
  return request<OnboardingProgress>(email, '/progress', {
    method: 'PATCH',
    body: asJsonBody({ current_step }),
  })
}

// -- Academic record (one-per-user upsert) -------------------------------

export async function getAcademicRecord(email: string): Promise<AcademicRecord | null> {
  return request<AcademicRecord | null>(email, '/academic-record')
}

export async function putAcademicRecord(email: string, record: AcademicRecord): Promise<AcademicRecord> {
  return request<AcademicRecord>(email, '/academic-record', {
    method: 'PUT',
    body: asJsonBody(record),
  })
}

// -- Generic CRUD-list resource factory ----------------------------------
// Every remaining resource (§5: test-scores, volunteer-experiences,
// internships, projects, awards, recommendations, certifications) repeats
// the same GET-list / POST / PATCH / DELETE shape.

function makeListResource<T, TDraft>(resourcePath: string) {
  return {
    async list(email: string): Promise<T[]> {
      return request<T[]>(email, resourcePath)
    },
    async create(email: string, draft: TDraft): Promise<T> {
      return request<T>(email, resourcePath, { method: 'POST', body: asJsonBody(draft) })
    },
    async update(email: string, id: number, patch: Partial<TDraft>): Promise<T> {
      return request<T>(email, `${resourcePath}/${id}`, { method: 'PATCH', body: asJsonBody(patch) })
    },
    async remove(email: string, id: number): Promise<void> {
      return request<void>(email, `${resourcePath}/${id}`, { method: 'DELETE' })
    },
  }
}

export const testScoresApi = makeListResource<TestScore, TestScoreDraft>('/test-scores')
export const volunteerExperiencesApi = makeListResource<VolunteerExperience, VolunteerExperienceDraft>(
  '/volunteer-experiences',
)
export const internshipsApi = makeListResource<Internship, InternshipDraft>('/internships')
export const projectsApi = makeListResource<PersonalProject, PersonalProjectDraft>('/projects')
export const awardsApi = makeListResource<Award, AwardDraft>('/awards')
export const recommendationsApi = makeListResource<Recommendation, RecommendationDraft>('/recommendations')
export const certificationsApi = makeListResource<Certification, CertificationDraft>('/certifications')

// -- Files (presigned-upload flow, §6) -----------------------------------

export async function createFileUpload(
  email: string,
  payload: CreateFileUploadRequest,
): Promise<CreateFileUploadResponse> {
  return request<CreateFileUploadResponse>(email, '/files', {
    method: 'POST',
    body: asJsonBody(payload),
  })
}

export async function completeFileUpload(email: string, id: number): Promise<UploadedFile> {
  return request<UploadedFile>(email, `/files/${id}`, {
    method: 'PATCH',
    body: asJsonBody({ status: 'complete' }),
  })
}

export async function deleteFileUpload(email: string, id: number): Promise<void> {
  return request<void>(email, `/files/${id}`, { method: 'DELETE' })
}

// -- Completion summary (server is the single source of scoring truth) --

export async function getCompletionSummary(email: string): Promise<CompletionSummary> {
  return request<CompletionSummary>(email, '/completion-summary')
}

// -- External connections (placeholders, §9) -----------------------------

export async function getConnections(email: string): Promise<ExternalConnection[]> {
  return request<ExternalConnection[]>(email, '/connections')
}

export async function connectProvider(email: string, provider: string): Promise<void> {
  return request<void>(email, `/connections/${provider}/connect`, { method: 'POST' })
}

export { OnboardingApiError }

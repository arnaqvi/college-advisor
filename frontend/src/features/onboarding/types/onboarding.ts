// Shared TS types for the onboarding feature. Field names are snake_case to
// mirror the Pydantic v2 schemas in docs/onboarding-flow-design.md §4/§5 1:1 —
// deliberately not camelCased, so the API client needs no translation layer
// once the real backend lands.

export type StepKey =
  | 'welcome'
  | 'basic-info'
  | 'academic-history'
  | 'test-scores'
  | 'volunteer'
  | 'projects'
  | 'awards'
  | 'recommendations'
  | 'certifications'
  | 'completion'

export const STEP_ORDER: StepKey[] = [
  'welcome',
  'basic-info',
  'academic-history',
  'test-scores',
  'volunteer',
  'projects',
  'awards',
  'recommendations',
  'certifications',
  'completion',
]

export const STEP_LABELS: Record<StepKey, string> = {
  welcome: 'Welcome',
  'basic-info': 'Basic Info',
  'academic-history': 'Academic History',
  'test-scores': 'Test Scores',
  volunteer: 'Volunteer Work',
  projects: 'Internships & Projects',
  awards: 'Awards',
  recommendations: 'Recommendations',
  certifications: 'Certifications',
  completion: 'Completion Dashboard',
}

export interface OnboardingProgress {
  id: number
  user_id: number
  current_step: StepKey
  completed_steps: StepKey[]
  last_active_at: string
  streak_days: number
}

export type GpaScale = '4.0' | '4.5' | '5.0'

export interface RigorCourses {
  ap: string[]
  ib: string[]
  honors: string[]
}

export interface AcademicRecord {
  id?: number
  high_school_name: string
  graduation_year: number | null
  gpa: number | null
  gpa_scale: GpaScale
  class_rank: string | null
  rigor_courses: RigorCourses
}

export type TestType = 'sat' | 'act' | 'psat'
export type TestScoreSource = 'manual' | 'college_board_sync'

export interface TestScore {
  id: number
  test_type: TestType
  test_date: string | null
  reading_score: number | null
  writing_score: number | null
  math_score: number | null
  total_score: number | null
  source: TestScoreSource
}

export type TestScoreDraft = Omit<TestScore, 'id' | 'source'>

export interface VolunteerExperience {
  id: number
  organization: string
  role: string | null
  start_date: string | null
  end_date: string | null
  hours: number | null
  description: string | null
  skills_learned: string | null
  reflection: string | null
}

export type VolunteerExperienceDraft = Omit<VolunteerExperience, 'id'>

export interface Internship {
  id: number
  company: string
  role: string | null
  start_date: string | null
  end_date: string | null
  supervisor_name: string | null
  responsibilities: string | null
  skills: string | null
  achievements: string | null
}

export type InternshipDraft = Omit<Internship, 'id'>

export interface PersonalProject {
  id: number
  name: string
  description: string | null
  technologies: string | null
  github_url: string | null
  website_url: string | null
  video_url: string | null
}

export type PersonalProjectDraft = Omit<PersonalProject, 'id'>

export type AwardLevel = 'school' | 'district' | 'state' | 'national' | 'international'

export const AWARD_LEVELS: AwardLevel[] = ['school', 'district', 'state', 'national', 'international']

export interface Award {
  id: number
  name: string
  organization: string | null
  award_date: string | null
  level: AwardLevel
  description: string | null
}

export type AwardDraft = Omit<Award, 'id'>

export type RecommenderRelationship = 'teacher' | 'coach' | 'counselor' | 'mentor' | 'professor'
export type RecommendationStatus = 'not_requested' | 'requested' | 'received'

export const RECOMMENDER_RELATIONSHIPS: RecommenderRelationship[] = [
  'teacher',
  'coach',
  'counselor',
  'mentor',
  'professor',
]

export interface Recommendation {
  id: number
  recommender_name: string
  position: string | null
  school_or_org: string | null
  email: string | null
  phone: string | null
  relationship: RecommenderRelationship
  status: RecommendationStatus
}

export type RecommendationDraft = Omit<Recommendation, 'id' | 'status'>

export interface Certification {
  id: number
  name: string
  provider: string
  completion_date: string | null
  expiration_date: string | null
  credential_id: string | null
  credential_url: string | null
}

export type CertificationDraft = Omit<Certification, 'id'>

export type UploadOwnerType =
  | 'transcript'
  | 'test_score'
  | 'volunteer'
  | 'internship'
  | 'project'
  | 'award'
  | 'recommendation'
  | 'certification'

export interface UploadedFile {
  id: number
  owner_type: UploadOwnerType
  owner_id: number | null
  file_name: string
  content_type: string
  size_bytes: number
  storage_key: string
  uploaded_at: string
  status: 'pending' | 'complete'
}

export interface CreateFileUploadRequest {
  file_name: string
  content_type: string
  size_bytes: number
  owner_type: UploadOwnerType
  owner_id?: number | null
}

export interface CreateFileUploadResponse extends UploadedFile {
  upload_url: string
}

export type ConnectionProvider =
  | 'college_board'
  | 'act'
  | 'parchment'
  | 'naviance'
  | 'scoir'
  | 'common_app'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'

export interface ExternalConnection {
  id: number
  provider: ConnectionProvider
  status: 'not_connected' | 'connected'
  connected_at: string | null
}

export interface CompletionSummary {
  profile_completion_pct: number
  section_scores: Record<string, number>
  academic_strength: number
  volunteer_impact: { total_hours: number; org_count: number }
  leadership_score: number
  project_portfolio: { count: number; external_link_ratio: number }
  recommendation_status: { requested: number; received: number; none: number }
  certification_count: number
  college_readiness_score: number
  missing_items: string[]
}

export interface BasicInfo {
  student_name: string
  email: string
  high_school_name: string
  graduation_year: number | null
}

// Weights from design doc §1 — Profile Completion % breakdown.
export const SECTION_WEIGHTS = {
  basicInfo: 15,
  academic: 20,
  tests: 15,
  volunteer: 10,
  projects: 15,
  awards: 10,
  recommendations: 10,
  certifications: 5,
} as const

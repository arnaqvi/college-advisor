import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getStaleGroups } from '../data/specRetrigger.js'
import { generatePlan } from '../lib/recommendationEngine.js'
import { fetchColleges } from '../lib/api/colleges.js'
import { fetchProfile, putProfile } from '../lib/api/profile.js'
import { SAMPLE_PROFILE } from '../data/sampleProfile.js'
import { useAuth } from './AuthContext.jsx'

const STORAGE_KEY = 'collegeAdvisorProfile'
const OWNER_KEY = 'collegeAdvisorProfileOwner'
const SYNC_BASELINE_KEY = 'collegeAdvisorSyncBaseline'
const SYNC_LOG_KEY = 'collegeAdvisorSyncLog'

export const EMPTY_PROFILE = {
  studentName: '',
  gpaWeighted: '',
  gpaUnweighted: '',
  classRank: '',
  classSize: '',
  highSchoolName: '',
  counselorName: '',
  counselorEmail: '',
  apCourses: '',
  ibCourses: '',
  honorsCourses: '',
  extracurriculars: '',
  awards: '',
  notes: '',

  // Added to drive the derived-plan engine (lib/recommendationEngine.js) —
  // see collegepath-master-prompt-spec.md Section 2 for field provenance.
  gradeLevel: '',
  gradYear: '',
  targetCountries: [],
  targetStates: [],
  typePreference: 'No preference',
  budgetSensitivity: 'Medium',
  settingPreference: 'No preference',
  sizePreference: 'No preference',
  satTotal: '',
  actComposite: '',
  plannedCourses: '',
  intendedMajors: [],
  activities: [],
  essays: [],
  counselorCollegeList: [],
  documents: [], // [{ id, name, size, type, uploadedAt, dataUrl }] — see Profile.jsx's Documents section

  // Background & Eligibility — added to drive scholarship matching (see
  // lib/engine/scholarshipMatch.js). Kept separate from College Preferences'
  // targetStates/targetCountries, which describe where the student wants to
  // study, not where they live.
  homeState: '',
  homeCity: '',
  householdIncomeRange: '',
  firstGen: false,
  sports: '',
  religionCulture: '',
  ethnicity: '',
  languages: '',
  volunteerWork: '',
  workExperience: '',
  certifications: '',
  specialCircumstances: [],
}

const AppContext = createContext(null)

function readSyncBaseline() {
  try {
    const raw = localStorage.getItem(SYNC_BASELINE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Hydrate from whatever was last saved via Profile.jsx's "Save"/"Load Saved"
// flow, if anything. Without this, `studentProfile` always starts as
// EMPTY_PROFILE on every fresh mount/navigation (e.g. loading /colleges
// directly, or a hard refresh), which makes every program show as
// "Incomplete" even for a returning student who has already saved a real
// GPA/test-score profile — the saved data existed in localStorage the whole
// time, it just was never read until the user manually visited /profile and
// clicked "Load Saved". Read once, lazily, as React's initial state.
function readSavedProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Which email (if any) the browser-local guest profile has already been
// claimed by. Unset means it predates per-user backend persistence, or was
// only ever edited while logged out — see the migration comment below.
function readProfileOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth()
  const email = user?.email

  // Logged-in users are backed by the per-user backend profile (see
  // lib/api/profile.js) — start blank and let the effect below fetch it, so a
  // new/different login never starts from whatever a previous user last saved
  // on this browser. Logged-out visits fall back to the old browser-local
  // guest profile (Profile.jsx and friends are reachable without logging in).
  const [studentProfile, setStudentProfile] = useState(() =>
    email ? EMPTY_PROFILE : readSavedProfile() ?? EMPTY_PROFILE
  )
  const [profileLoading, setProfileLoading] = useState(Boolean(email))
  const [profileError, setProfileError] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [syncBaseline, setSyncBaseline] = useState(readSyncBaseline)
  const [lastSyncedAt, setLastSyncedAt] = useState(() => syncBaseline?.syncedAt ?? null)

  // Re-hydrate whenever the logged-in identity changes (login, logout, or
  // switching accounts on the same browser) — this is the fix for profiles
  // leaking across users: each identity gets its own fetch, and logging out
  // resets to a clean guest state instead of leaving the last profile in memory.
  useEffect(() => {
    let cancelled = false

    if (!email) {
      setStudentProfile(readSavedProfile() ?? EMPTY_PROFILE)
      setProfileLoading(false)
      setProfileError(null)
      return
    }

    setProfileLoading(true)
    setProfileError(null)
    fetchProfile(email)
      .then(async (data) => {
        if (cancelled) return
        if (data) {
          setStudentProfile(data)
          setProfileLoading(false)
          return
        }

        // No backend row yet for this email. Before defaulting to blank,
        // check for pre-existing browser-local data from before per-user
        // backend persistence existed (the STORAGE_KEY blob predates any
        // user scoping). Only adopt it if it hasn't already been claimed by
        // a *different* email on this browser — otherwise this reintroduces
        // the original bug (a new login inheriting someone else's data).
        const local = readSavedProfile()
        const owner = readProfileOwner()
        if (local && (!owner || owner === email)) {
          try {
            const migrated = await putProfile(email, local)
            if (cancelled) return
            localStorage.setItem(OWNER_KEY, email)
            setStudentProfile(migrated)
            setProfileLoading(false)
            return
          } catch (err) {
            if (cancelled) return
            setProfileError(err.message || 'Failed to migrate saved profile')
            // Fall through to blank rather than getting stuck loading.
          }
        }

        setStudentProfile(EMPTY_PROFILE)
        setProfileLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setProfileError(err.message || 'Failed to load profile')
        setStudentProfile(EMPTY_PROFILE)
        setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [email])

  // Backend-sourced college/program directory (spec 3.9) — replaced the
  // static `data/colleges.js` fixture as of the "remove hardcoded colleges"
  // session. Fetched once on mount; `retryFetchColleges` lets the error UI
  // (see Layout.jsx) retry without a full page reload.
  const [colleges, setColleges] = useState([])
  const [collegesLoading, setCollegesLoading] = useState(true)
  const [collegesError, setCollegesError] = useState(null)
  const [collegesFetchToken, setCollegesFetchToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setCollegesLoading(true)
    setCollegesError(null)
    fetchColleges()
      .then((data) => {
        if (cancelled) return
        setColleges(data)
        setCollegesLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setCollegesError(err.message || 'Failed to load colleges')
        setCollegesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collegesFetchToken])

  function retryFetchColleges() {
    setCollegesFetchToken((t) => t + 1)
  }

  async function saveProfile(profile) {
    if (email) {
      try {
        const saved = await putProfile(email, profile)
        localStorage.setItem(OWNER_KEY, email)
        setStudentProfile(saved)
        setLastSavedAt(new Date().toISOString())
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err.message || 'Failed to save profile — please try again.' }
      }
    }

    // Logged-out/guest fallback — unchanged localStorage behavior. Documents
    // are stored as base64 data URLs (see updateDocuments), which can
    // realistically exceed the browser's localStorage quota — unlike every
    // other profile field, this write can fail, so callers that add
    // documents check the returned result instead of assuming success.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      return { ok: false, error: 'Not enough browser storage space — try removing a document or uploading a smaller file.' }
    }
    setStudentProfile(profile)
    setLastSavedAt(new Date().toISOString())
    return { ok: true }
  }

  async function loadProfile() {
    if (email) {
      try {
        const data = await fetchProfile(email)
        if (!data) return null
        setStudentProfile(data)
        return data
      } catch (err) {
        setProfileError(err.message || 'Failed to load profile')
        return null
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    setStudentProfile(parsed)
    return parsed
  }

  // First-run shortcut (see ONBOARDING_NEW_USERS_BRIEF.md option 3) — lets a
  // brand-new visitor explore the app with realistic demo data instead of
  // filling out Profile before seeing anything. Goes through the same
  // saveProfile path as a real save, so it drives fitScore/classification
  // identically; the `_sample` flag on the object is the only thing that
  // distinguishes it (Profile.jsx uses it to show a banner).
  function loadSampleProfile() {
    return saveProfile(SAMPLE_PROFILE)
  }

  async function clearProfile() {
    if (email) {
      try {
        await putProfile(email, EMPTY_PROFILE)
      } catch (err) {
        setProfileError(err.message || 'Failed to clear profile')
      }
      setStudentProfile(EMPTY_PROFILE)
      setLastSavedAt(null)
      return
    }

    localStorage.removeItem(STORAGE_KEY)
    setStudentProfile(EMPTY_PROFILE)
    setLastSavedAt(null)
  }

  // Frontend-only stand-in for POST /api/sync/trigger (see backend/app/routers/sync.py)
  // until the backend is deployed. Re-derives which spec modules (Section 1.1 of
  // collegepath-master-prompt-spec.md) are stale, then stamps the profile as synced.
  function refreshProfile() {
    const staleGroups = getStaleGroups(syncBaseline?.profile, studentProfile)
    const syncedAt = new Date().toISOString()

    const nextBaseline = { profile: studentProfile, syncedAt }
    localStorage.setItem(SYNC_BASELINE_KEY, JSON.stringify(nextBaseline))
    setSyncBaseline(nextBaseline)
    setLastSyncedAt(syncedAt)

    const log = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]')
    log.unshift({
      syncedAt,
      reranModules: staleGroups.flatMap((g) => g.modules),
    })
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log.slice(0, 20)))

    return staleGroups
  }

  const staleGroups = useMemo(
    () => getStaleGroups(syncBaseline?.profile, studentProfile),
    [syncBaseline, studentProfile]
  )

  // Derived output (Section 4 of the spec), recomputed whenever the profile
  // OR the fetched college list changes. Recomputation is a pure, cheap
  // function over a few dozen rows, so there's no need for a separate
  // cache/invalidation strategy. While colleges are still loading (or failed
  // to load), `colleges` is `[]`, so this safely produces an empty-but-valid
  // plan rather than throwing — see Layout.jsx for the loading/error gate
  // that keeps pages from rendering a misleading "0 colleges" state instead.
  const derivedPlan = useMemo(
    () => generatePlan(studentProfile, { colleges }),
    [studentProfile, colleges]
  )

  function updateEssays(essays) {
    return saveProfile({ ...studentProfile, essays })
  }

  function updateCounselorList(counselorCollegeList) {
    return saveProfile({ ...studentProfile, counselorCollegeList })
  }

  function updateDocuments(documents) {
    return saveProfile({ ...studentProfile, documents })
  }

  const value = {
    studentProfile,
    setStudentProfile,
    saveProfile,
    loadProfile,
    loadSampleProfile,
    clearProfile,
    isSampleProfile: Boolean(studentProfile._sample),
    profileLoading,
    profileError,
    lastSavedAt,
    lastSyncedAt,
    staleGroups,
    refreshProfile,
    derivedPlan,
    updateEssays,
    updateCounselorList,
    updateDocuments,
    colleges,
    collegesLoading,
    collegesError,
    retryFetchColleges,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return ctx
}

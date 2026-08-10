import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw, Upload, FileText, Trash2, Sparkles } from 'lucide-react'
import { useAppContext, EMPTY_PROFILE } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import MultiSelect from '../components/MultiSelect.jsx'
import AdvisorChat from '../components/AdvisorChat.jsx'
import {
  MAJOR_OPTIONS,
  US_STATE_OPTIONS,
  COUNTRY_OPTIONS,
  INCOME_RANGE_OPTIONS,
  SPECIAL_CIRCUMSTANCE_OPTIONS,
} from '../data/collegePreferenceOptions.js'
import { CORE_COMPLETION_FIELD_NAMES, calculateProfileCompletion } from '../lib/engine/profileCompletion.js'

// Kept well under browser localStorage quotas — documents are stored as
// base64 data URLs (~33% larger than the raw file) alongside the rest of
// the profile in the same key, so a handful of large files could otherwise
// exhaust the quota and silently break profile saving entirely.
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const FIELDS = [
  { section: 'Academic Info', name: 'gpaWeighted', label: 'Weighted GPA', placeholder: '4.2' },
  { section: 'Academic Info', name: 'gpaUnweighted', label: 'Unweighted GPA', placeholder: '3.8' },
  { section: 'Academic Info', name: 'classRank', label: 'Class Rank', placeholder: '12' },
  { section: 'Academic Info', name: 'classSize', label: 'Class Size (overall count)', placeholder: '340' },
  { section: 'Academic Info', name: 'satTotal', label: 'SAT Total (out of 1600)', placeholder: '1450' },
  { section: 'Academic Info', name: 'actComposite', label: 'ACT Composite (out of 36)', placeholder: '32' },
  {
    section: 'Academic Info',
    name: 'gradeLevel',
    label: 'Current Grade',
    select: true,
    options: ['9', '10', '11', '12'],
  },
  { section: 'Academic Info', name: 'gradYear', label: 'Graduation Year', placeholder: '2027' },
  { section: 'Course Selection', name: 'apCourses', label: 'AP Courses', placeholder: 'AP Calc BC, AP Bio, AP Lit' },
  { section: 'Course Selection', name: 'ibCourses', label: 'IB Courses', placeholder: 'IB Chemistry HL' },
  { section: 'Course Selection', name: 'honorsCourses', label: 'Honors Courses', placeholder: 'Honors English' },
  {
    section: 'Course Selection',
    name: 'plannedCourses',
    label: 'Planned Next-Year Courses',
    placeholder: 'AP Physics C, AP Computer Science A',
  },
  { section: 'Extracurricular Activities', name: 'extracurriculars', label: 'Extracurricular Activities', textarea: true },
  { section: 'Awards & Honors', name: 'awards', label: 'Awards & Honors', textarea: true },
  {
    section: 'College Preferences',
    name: 'intendedMajors',
    label: 'Intended Majors (ranked by selection order)',
    multiSelect: true,
    options: MAJOR_OPTIONS,
    placeholder: 'Select majors...',
  },
  {
    section: 'College Preferences',
    name: 'targetStates',
    label: 'Target States',
    multiSelect: true,
    options: US_STATE_OPTIONS,
    placeholder: 'Select states...',
  },
  {
    section: 'College Preferences',
    name: 'targetCountries',
    label: 'Target Countries',
    multiSelect: true,
    options: COUNTRY_OPTIONS,
    placeholder: 'Select countries...',
  },
  {
    section: 'College Preferences',
    name: 'typePreference',
    label: 'Public/Private Preference',
    select: true,
    options: ['No preference', 'Public', 'Private'],
  },
  {
    section: 'College Preferences',
    name: 'budgetSensitivity',
    label: 'Budget Sensitivity',
    select: true,
    options: ['Low', 'Medium', 'High'],
  },
  {
    section: 'College Preferences',
    name: 'settingPreference',
    label: 'Campus Setting Preference',
    select: true,
    options: ['No preference', 'Urban', 'Suburban', 'Rural'],
  },
  {
    section: 'College Preferences',
    name: 'sizePreference',
    label: 'Campus Size Preference',
    select: true,
    options: ['No preference', 'Small', 'Medium', 'Large'],
  },
  { section: 'School Contacts', name: 'highSchoolName', label: 'High School Name' },
  { section: 'School Contacts', name: 'counselorName', label: 'Counselor Name' },
  { section: 'School Contacts', name: 'counselorEmail', label: 'Counselor Email' },
  {
    section: 'Background & Eligibility',
    name: 'homeState',
    label: 'Home State',
    select: true,
    options: US_STATE_OPTIONS,
  },
  { section: 'Background & Eligibility', name: 'homeCity', label: 'Home City', placeholder: 'Springfield' },
  {
    section: 'Background & Eligibility',
    name: 'householdIncomeRange',
    label: 'Household Income Range',
    select: true,
    options: INCOME_RANGE_OPTIONS,
  },
  {
    section: 'Background & Eligibility',
    name: 'firstGen',
    label: 'First-Generation College Student',
    select: true,
    options: ['No', 'Yes'],
  },
  { section: 'Background & Eligibility', name: 'sports', label: 'Sports Played or Coached', placeholder: 'Varsity soccer, club swimming' },
  {
    section: 'Background & Eligibility',
    name: 'religionCulture',
    label: 'Religious / Cultural Background',
    placeholder: 'Optional — used only to surface relevant scholarships',
  },
  { section: 'Background & Eligibility', name: 'ethnicity', label: 'Ethnicity / Heritage', placeholder: 'Optional — used only to surface relevant scholarships' },
  { section: 'Background & Eligibility', name: 'languages', label: 'Languages Spoken', placeholder: 'Spanish, Tagalog' },
  { section: 'Background & Eligibility', name: 'volunteerWork', label: 'Volunteer / Community Service', textarea: true },
  { section: 'Background & Eligibility', name: 'workExperience', label: 'Work / Internship Experience', textarea: true },
  { section: 'Background & Eligibility', name: 'certifications', label: 'Certifications & Skills', placeholder: 'Google IT Support, AWS Cloud Practitioner' },
  {
    section: 'Background & Eligibility',
    name: 'specialCircumstances',
    label: 'Special Circumstances',
    multiSelect: true,
    options: SPECIAL_CIRCUMSTANCE_OPTIONS,
    placeholder: 'Select if applicable...',
  },
]

const SECTIONS = [...new Set(FIELDS.map((f) => f.section))]

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || ''
}

function textToList(value) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

// select fields accept either plain strings (e.g. ['Low','Medium','High']) or
// {value,label} objects (e.g. US_STATE_OPTIONS) — these two helpers let a
// single select field/control handle both without extra field config.
function optionValue(o) {
  return typeof o === 'string' ? o : o.value
}
function optionLabel(o) {
  return typeof o === 'string' ? o : o.label
}
function singleOptionLabel(options, value) {
  const opt = options.find((o) => optionValue(o) === value)
  return opt ? optionLabel(opt) : value
}

// Renders a multiSelect field's stored values (e.g. state codes) using their
// display labels, for the read-only parent/counselor view.
function optionLabels(options, values) {
  if (!Array.isArray(values) || values.length === 0) return ''
  return values
    .map((v) => {
      const opt = options.find((o) => (typeof o === 'string' ? o : o.value) === v)
      return opt ? (typeof opt === 'string' ? opt : opt.label) : v
    })
    .join(', ')
}

// Section 5 of collegepath-master-prompt-spec.md: "Parent view: simplified
// read-mostly mode ... without needing to navigate the full student tool."
// Counselor gets the same read-mostly treatment — the spec's multi-student
// counselor dashboard is explicitly out of pilot scope (Section 1), so a
// counselor sees the same single profile as the parent, not an edit surface.
const READ_ONLY_ROLES = new Set(['parent', 'counselor'])

const ROLE_COPY = {
  parent: { title: 'Student Profile', subtitle: 'Read-only view — used to personalize the roadmap.' },
  counselor: { title: 'Student Profile', subtitle: 'Read-only view — used to personalize the roadmap.' },
}

function RefreshPanel({ lastSyncedAt, staleGroups, onRefresh }) {
  const isStale = staleGroups.length > 0
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        isStale ? 'border-target/30 bg-target-bg text-target' : 'border-border bg-surface-raised text-text-secondary'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          {isStale ? (
            <>
              <p className="font-medium">May be outdated — refresh to update your roadmap</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {staleGroups.flatMap((g) => g.modules).map((m) => (
                  <span key={m} className="rounded-full bg-target/15 px-2 py-0.5 text-xs font-medium text-target">
                    {m}
                  </span>
                ))}
              </p>
            </>
          ) : (
            <p>
              {lastSyncedAt
                ? `Up to date — last refreshed ${new Date(lastSyncedAt).toLocaleString()}`
                : 'Not yet refreshed — run Refresh to generate your roadmap and readiness score.'}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="landing-button-dark flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-raised"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    </div>
  )
}

export default function Profile() {
  const {
    studentProfile,
    saveProfile,
    loadProfile,
    loadSampleProfile,
    clearProfile,
    isSampleProfile,
    profileLoading,
    lastSavedAt,
    lastSyncedAt,
    staleGroups,
    refreshProfile,
    updateDocuments,
  } = useAppContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = user?.role
  const isReadOnly = READ_ONLY_ROLES.has(role)
  const [form, setForm] = useState(studentProfile)
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const hasStats = Boolean(studentProfile.gpaUnweighted || studentProfile.satTotal || studentProfile.actComposite)
  const completion = calculateProfileCompletion(form)
  const advisorPrompt = location.state?.advisorPrompt
  const advisorSectionRef = useRef(null)

  // Dashboard's "Ask your AI Advisor" nudge navigates here with a prompt in
  // router state — scroll straight to the chat so it doesn't get lost at the
  // bottom of a long profile form.
  useEffect(() => {
    if (advisorPrompt) advisorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [advisorPrompt])

  // studentProfile changes for reasons other than this form's own edits too —
  // an async backend fetch resolving after login, or switching to a different
  // logged-in user — so `form` must resync whenever it changes, not just once
  // at mount.
  useEffect(() => {
    setForm(studentProfile)
  }, [studentProfile])

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // "N/A" only exists for lib/engine/profileCompletion.js's core completion
  // fields — marking one excludes it from both the numerator and denominator
  // of the Dashboard completion meter, rather than counting it as missing.
  function toggleNotApplicable(name) {
    setForm((prev) => {
      const current = new Set(prev.notApplicableFields || [])
      if (current.has(name)) current.delete(name)
      else current.add(name)
      return { ...prev, notApplicableFields: [...current] }
    })
  }

  async function handleSave() {
    // A manual save always means real data — clear the sample-data flag even
    // if the form still carries it forward from an untouched sample load.
    const { _sample, ...rest } = form
    setSaveError('')
    const result = await saveProfile(rest)
    if (!result.ok) setSaveError(result.error)
  }

  async function handleLoad() {
    setSaveError('')
    const loaded = await loadProfile()
    if (loaded) setForm(loaded)
  }

  async function handleTrySample() {
    setSaveError('')
    const result = await loadSampleProfile()
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    navigate('/dashboard')
  }

  async function handleClearSample() {
    setSaveError('')
    await clearProfile()
    setForm(EMPTY_PROFILE)
  }

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setUploadError('')

    for (const file of files) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        setUploadError(`"${file.name}" is larger than ${formatBytes(MAX_DOCUMENT_BYTES)} — this browser-only prototype can't store it.`)
        continue
      }
      const dataUrl = await readFileAsDataUrl(file)
      const doc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        dataUrl,
      }
      const result = await updateDocuments([...(studentProfile.documents || []), doc])
      if (result && !result.ok) {
        setUploadError(result.error)
        break
      }
    }
  }

  async function handleRemoveDocument(id) {
    const result = await updateDocuments((studentProfile.documents || []).filter((d) => d.id !== id))
    if (result && !result.ok) setUploadError(result.error)
  }

  const copy = ROLE_COPY[role] ?? {
    title: 'Student Profile',
    subtitle: 'My Profile — used to personalize your roadmap.',
  }

  useRevealOnMount([role])

  return (
    <Reveal>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">{copy.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.subtitle}</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <button
              onClick={handleLoad}
              disabled={profileLoading}
              className="landing-button-dark rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load Saved
            </button>
            <button
              onClick={handleSave}
              disabled={profileLoading}
              className="landing-button-dark rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Profile
            </button>
          </div>
        )}
      </div>

      {profileLoading && !isReadOnly && (
        <p className="mt-2 text-xs text-text-secondary">Loading your saved profile…</p>
      )}

      {saveError && !isReadOnly && (
        <p className="mt-2 text-xs font-medium text-reach">{saveError}</p>
      )}

      {lastSavedAt && !isReadOnly && (
        <p className="mt-2 text-xs text-text-secondary">Last saved {new Date(lastSavedAt).toLocaleString()}</p>
      )}

      {!isReadOnly && !hasStats && !isSampleProfile && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-primary">
            Welcome! Your profile is {completion.percent}% complete — fill in your GPA and test scores below to
            unlock your personalized dashboard, matches, and roadmap, or explore the app first with a sample
            student.
          </p>
          <button
            onClick={handleTrySample}
            className="landing-button-dark flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
          >
            <Sparkles size={16} />
            Try a sample profile
          </button>
        </div>
      )}

      {!isReadOnly && isSampleProfile && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-target/30 bg-target-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-target">
            You're exploring with a sample student profile — edit and save below to make it yours.
          </p>
          <button
            onClick={handleClearSample}
            className="landing-button-dark shrink-0 rounded-full border border-target/30 bg-surface px-4 py-2 text-sm font-medium text-target hover:bg-surface-raised"
          >
            Clear sample & start fresh
          </button>
        </div>
      )}

      <RefreshPanel lastSyncedAt={lastSyncedAt} staleGroups={staleGroups} onRefresh={refreshProfile} />

      <div className="mt-6 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">{section}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {FIELDS.filter((f) => f.section === section).map((f) =>
                isReadOnly ? (
                  <div key={f.name} className={f.textarea ? 'sm:col-span-2' : ''}>
                    <span className="text-xs font-medium text-text-secondary">{f.label}</span>
                    <p className="mt-1 min-h-[2.25rem] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary">
                      {f.multiSelect
                        ? optionLabels(f.options, studentProfile[f.name]) || '—'
                        : f.list
                          ? listToText(studentProfile[f.name]) || '—'
                          : f.select
                            ? singleOptionLabel(f.options, studentProfile[f.name]) || '—'
                            : studentProfile[f.name] || '—'}
                    </p>
                  </div>
                ) : f.multiSelect ? (
                  <div key={f.name} className={CORE_COMPLETION_FIELD_NAMES.has(f.name) && (form.notApplicableFields || []).includes(f.name) ? 'opacity-50' : ''}>
                    <MultiSelect
                      label={f.label}
                      options={f.options}
                      value={form[f.name]}
                      onChange={(next) => handleChange(f.name, next)}
                      placeholder={f.placeholder}
                    />
                    {CORE_COMPLETION_FIELD_NAMES.has(f.name) && (
                      <label className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={(form.notApplicableFields || []).includes(f.name)}
                          onChange={() => toggleNotApplicable(f.name)}
                        />
                        Not applicable to me
                      </label>
                    )}
                  </div>
                ) : (
                  <label
                    key={f.name}
                    className={`${f.textarea ? 'sm:col-span-2' : ''} ${
                      CORE_COMPLETION_FIELD_NAMES.has(f.name) && (form.notApplicableFields || []).includes(f.name)
                        ? 'opacity-50'
                        : ''
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-secondary">{f.label}</span>
                      {CORE_COMPLETION_FIELD_NAMES.has(f.name) && (
                        <span className="flex items-center gap-1.5 text-[11px] font-normal text-text-secondary">
                          <input
                            type="checkbox"
                            checked={(form.notApplicableFields || []).includes(f.name)}
                            onChange={() => toggleNotApplicable(f.name)}
                          />
                          N/A
                        </span>
                      )}
                    </span>
                    {f.textarea ? (
                      <textarea
                        value={form[f.name] || ''}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
                      />
                    ) : f.select ? (
                      <select
                        value={form[f.name] || optionValue(f.options[0])}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
                      >
                        {f.options.map((o) => (
                          <option key={optionValue(o)} value={optionValue(o)}>
                            {optionLabel(o)}
                          </option>
                        ))}
                      </select>
                    ) : f.list ? (
                      <input
                        value={listToText(form[f.name])}
                        placeholder={f.placeholder}
                        onChange={(e) => handleChange(f.name, textToList(e.target.value))}
                        className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
                      />
                    ) : (
                      <input
                        value={form[f.name] || ''}
                        placeholder={f.placeholder}
                        onChange={(e) => handleChange(f.name, e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
                      />
                    )}
                  </label>
                )
              )}
            </div>
          </div>
        ))}

        {!isReadOnly && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Documents</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Upload transcripts, essays, or recommendation letters. Stored in this browser only — not yet synced to
              a server (backend storage is a later phase).
            </p>

            <label className="landing-button-dark mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised">
              <Upload size={16} />
              Choose Files
              <input type="file" multiple onChange={handleFilesSelected} className="hidden" />
            </label>
            {uploadError && <p className="mt-2 text-xs font-medium text-reach">{uploadError}</p>}

            <ul className="mt-3 space-y-2">
              {(studentProfile.documents || []).map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-2 text-sm"
                >
                  <a
                    href={doc.dataUrl}
                    download={doc.name}
                    className="flex min-w-0 items-center gap-2 text-text-primary hover:text-accent-contrast"
                  >
                    <FileText size={14} className="shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </a>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-text-secondary">{formatBytes(doc.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-text-secondary hover:text-reach"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
              {(studentProfile.documents || []).length === 0 && (
                <li className="rounded-2xl border border-dashed border-border bg-surface-raised px-4 py-6 text-center text-sm text-text-secondary">
                  No documents uploaded yet.
                </li>
              )}
            </ul>
          </div>
        )}

        <div ref={advisorSectionRef}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">AI Advisor</h3>
          <div className="mt-3">
            <AdvisorChat initialPrompt={advisorPrompt} />
          </div>
        </div>
      </div>
    </Reveal>
  )
}

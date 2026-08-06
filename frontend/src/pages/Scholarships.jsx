import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Sparkles, TrendingUp, Layers, Unlock, MapPin, CalendarClock } from 'lucide-react'
import { SCHOLARSHIPS, CATEGORIES } from '../data/scholarships.js'
import { matchScholarships, buildEssayClusters, getUnlockFields } from '../lib/engine/scholarshipMatch.js'
import { useAppContext } from '../context/AppContext.jsx'
import MultiSelect from '../components/MultiSelect.jsx'
import {
  MAJOR_OPTIONS,
  INCOME_RANGE_OPTIONS,
  SPECIAL_CIRCUMSTANCE_OPTIONS,
} from '../data/collegePreferenceOptions.js'

function getDaysRemaining(deadline) {
  const due = new Date(`${deadline}T00:00:00`)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((due - startOfToday) / (1000 * 60 * 60 * 24))
}

function getDeadlineBadge(deadline) {
  const days = getDaysRemaining(deadline)
  if (days < 0) return 'bg-surface-raised text-text-secondary'
  if (days <= 14) return 'bg-reach-bg text-reach'
  if (days <= 45) return 'bg-target-bg text-target'
  return 'bg-safety-bg text-safety'
}

function formatDeadline(deadline) {
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const MATCH_TIER_STYLES = {
  green: 'bg-safety-bg text-safety',
  amber: 'bg-target-bg text-target',
  red: 'bg-reach-bg text-reach',
}

function formatAmount(amount) {
  return typeof amount === 'number' ? `$${amount.toLocaleString()}` : amount
}

function fourYearTotal(s) {
  if (typeof s.amount !== 'number' || !s.renewable) return null
  return s.amount * s.renewable.years
}

// Empty-value check shared by the batch panel and unlock-field logic below —
// kept local since it's a light UI convenience, not matching-engine logic.
function isEmpty(value) {
  return Array.isArray(value) ? value.length === 0 : !value || !String(value).trim()
}

const BATCHES = [
  {
    label: 'Basics',
    fields: [
      { name: 'homeState', label: 'Home state', placeholder: 'e.g. CA' },
      { name: 'homeCity', label: 'Home city', placeholder: 'Springfield' },
      { name: 'gpaUnweighted', label: 'Unweighted GPA', placeholder: '3.8' },
      { name: 'gradeLevel', label: 'Current grade', select: ['9', '10', '11', '12'] },
      { name: 'intendedMajors', label: 'Intended major(s)', multiSelect: MAJOR_OPTIONS },
      { name: 'householdIncomeRange', label: 'Household income range', select: INCOME_RANGE_OPTIONS },
    ],
  },
  {
    label: 'Activities & Background',
    fields: [
      { name: 'extracurriculars', label: 'Clubs & extracurriculars', textarea: true },
      { name: 'sports', label: 'Sports played or coached', placeholder: 'Varsity soccer' },
      { name: 'religionCulture', label: 'Religious / cultural background', placeholder: 'Optional' },
      { name: 'certifications', label: 'Certifications & skills', placeholder: 'Google IT Support' },
      { name: 'firstGen', label: 'First-generation college student?', select: ['No', 'Yes'] },
    ],
  },
  {
    label: 'Circumstances',
    fields: [
      { name: 'volunteerWork', label: 'Volunteer / community service', textarea: true },
      { name: 'specialCircumstances', label: 'Special circumstances', multiSelect: SPECIAL_CIRCUMSTANCE_OPTIONS },
      { name: 'languages', label: 'Languages spoken', placeholder: 'Spanish, Tagalog' },
      { name: 'workExperience', label: 'Work / internship experience', textarea: true },
    ],
  },
]

function BatchField({ field, value, onChange }) {
  if (field.multiSelect) {
    return (
      <MultiSelect
        label={field.label}
        options={field.multiSelect}
        value={value}
        onChange={onChange}
        placeholder="Select..."
      />
    )
  }
  if (field.select) {
    return (
      <label className="block">
        <span className="text-xs font-medium text-text-secondary">{field.label}</span>
        <select
          value={value || field.select[0]}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        >
          {field.select.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className={`block ${field.textarea ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-text-secondary">{field.label}</span>
      {field.textarea ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        />
      ) : (
        <input
          value={value || ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        />
      )}
    </label>
  )
}

function ProfileBatchPanel({ profile, saveProfile }) {
  const batchIndex = BATCHES.findIndex((b) => b.fields.some((f) => isEmpty(profile[f.name])))
  const [draft, setDraft] = useState(profile)
  const [dismissed, setDismissed] = useState(false)
  const [saveError, setSaveError] = useState('')

  if (batchIndex === -1 || dismissed) return null
  const batch = BATCHES[batchIndex]

  function handleChange(name, value) {
    setDraft((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    setSaveError('')
    const result = await saveProfile({ ...profile, ...draft })
    if (!result.ok) setSaveError(result.error)
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface-raised p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-contrast">
            Complete your profile — batch {batchIndex + 1} of {BATCHES.length}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {batch.label} — a few quick answers unlock more accurate, more numerous matches below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          Skip for now
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {batch.fields.map((f) => (
          <BatchField key={f.name} field={f} value={draft[f.name]} onChange={(v) => handleChange(f.name, v)} />
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="landing-button-dark mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
      >
        Save & Continue
      </button>
      {saveError && <p className="mt-2 text-xs font-medium text-reach">{saveError}</p>}
    </div>
  )
}

function ScholarshipCard({ s, tag }) {
  return (
    <div className="rounded-[14px] border border-[#e7e5df] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          {tag && (
            <span className="mb-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-contrast">
              {tag}
            </span>
          )}
          <h3 className="font-semibold text-slate-900">{s.name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{s.sponsor}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            s.financialAid ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {s.financialAid ? 'Need-based' : 'Merit-based'}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">{s.eligibility}</p>
      {s.reasons.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{s.reasons.slice(0, 2).join('. ')}.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-lg font-semibold text-[#1f7a5c]">{formatAmount(s.amount)}</span>
          {fourYearTotal(s) && (
            <span className="ml-2 text-xs text-slate-500">(${fourYearTotal(s).toLocaleString()} over {s.renewable.years} yrs)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${MATCH_TIER_STYLES[s.matchTier]}`}>
            {s.matchPercent}% match
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getDeadlineBadge(s.deadline)}`}>
            {formatDeadline(s.deadline)}
          </span>
        </div>
      </div>

      <a
        href={s.applyUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-contrast hover:underline"
      >
        Apply on sponsor's site <ExternalLink size={12} />
      </a>
    </div>
  )
}

const ESSAY_THEME_LABELS = {
  'leadership-service': 'Leadership & service',
  'personal-statement-financial-need': 'Personal statement / overcoming financial need',
  'overcoming-adversity': 'Overcoming adversity',
  'community-impact': 'Community impact',
  'career-goals-major': 'Career & major goals',
  'personal-portfolio-statement': 'Creative portfolio + artist statement',
  'cultural-heritage-identity': 'Cultural heritage & identity',
  'family-heritage-values': 'Family, heritage & values',
}

export default function Scholarships() {
  const { studentProfile, saveProfile } = useAppContext()

  const matched = useMemo(() => matchScholarships(studentProfile, SCHOLARSHIPS), [studentProfile])
  const unlockFields = useMemo(() => getUnlockFields(studentProfile), [studentProfile])
  const essayClusters = useMemo(() => buildEssayClusters(matched), [matched])

  const eligible = matched.filter((m) => !m.disqualified)

  const quickWins = [...eligible]
    .filter((m) => m.matchPercent >= 70)
    .sort((a, b) => {
      const scoreA = a.matchPercent + (a.category !== 'national' ? 5 : 0)
      const scoreB = b.matchPercent + (b.category !== 'national' ? 5 : 0)
      return scoreB - scoreA
    })
    .slice(0, 5)

  const highValue = [...eligible]
    .filter((m) => m.matchTier !== 'red')
    .sort((a, b) => {
      const valueA = typeof a.amount === 'number' ? (fourYearTotal(a) ?? a.amount) : Infinity
      const valueB = typeof b.amount === 'number' ? (fourYearTotal(b) ?? b.amount) : Infinity
      return valueB - valueA
    })
    .slice(0, 5)

  const byCategory = useMemo(() => {
    const groups = {}
    for (const m of matched) {
      ;(groups[m.category] ||= []).push(m)
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => b.matchPercent - a.matchPercent)
    }
    return groups
  }, [matched])

  const timeline = useMemo(() => {
    const groups = {}
    for (const m of matched) {
      const key = new Date(`${m.deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      ;(groups[key] ||= []).push(m)
    }
    return Object.entries(groups).sort(
      ([, a], [, b]) => new Date(`${a[0].deadline}T00:00:00`) - new Date(`${b[0].deadline}T00:00:00`)
    )
  }, [matched])

  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">National Scholarships</h2>
      <p className="mt-1 text-sm text-slate-500">
        Matched against your profile — deadlines and eligibility shown are typical for this program; always confirm
        the current year's deadline and eligibility on the sponsor's site before applying.
      </p>

      <ProfileBatchPanel profile={studentProfile} saveProfile={saveProfile} />

      {quickWins.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
            <Sparkles size={18} className="text-accent-contrast" /> Quick Wins
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Your best-matched, smaller-pool scholarships. (Hyperlocal school/city/county awards are usually the
            highest-odds quick wins of all — see "Unlock More" below, since those aren't in any national database.)
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickWins.map((s) => (
              <ScholarshipCard key={s.id} s={s} tag="Quick Win" />
            ))}
          </div>
        </section>
      )}

      {highValue.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
            <TrendingUp size={18} className="text-accent-contrast" /> High Value
          </h3>
          <p className="mt-1 text-sm text-text-secondary">Largest awards within realistic reach.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {highValue.map((s) => (
              <ScholarshipCard key={s.id} s={s} tag="High Value" />
            ))}
          </div>
        </section>
      )}

      {essayClusters.length > 0 && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
            <Layers size={18} className="text-accent-contrast" /> Essay Clusters
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            These scholarships share a similar essay theme — draft once, adapt for each.
          </p>
          <div className="mt-4 space-y-4">
            {essayClusters.map(({ theme, scholarships }) => (
              <div key={theme} className="rounded-2xl border border-border bg-surface-raised p-4">
                <p className="text-sm font-semibold text-text-primary">{ESSAY_THEME_LABELS[theme] || theme}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {scholarships.map((s) => (
                    <span key={s.id} className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-contrast">
                      {s.name}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
          <Unlock size={18} className="text-accent-contrast" /> Unlock More
        </h3>
        {unlockFields.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">Your profile is fully filled in for scholarship matching — nice work.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-secondary">
              Fill in these profile fields (via the panel above or your{' '}
              <Link to="/profile" className="text-accent-contrast hover:underline">
                Profile page
              </Link>
              ) to surface more matches:
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {unlockFields.map((f) => (
                <li key={f.key} className="rounded-2xl border border-border bg-surface-raised px-4 py-2.5 text-sm">
                  <span className="font-medium text-text-primary">{f.label}</span>
                  <span className="text-text-secondary"> — {f.why}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface-raised px-4 py-3 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5 font-medium text-text-primary">
            <MapPin size={14} /> Hyperlocal & state scholarships aren't listed here
          </span>
          <p className="mt-1">
            School-district, city, county, and state-foundation scholarships have the smallest applicant pools of
            all — but they're specific to where you live and aren't in any national database. Check with your
            school counselor, local library, community foundation, and your state's higher-education agency
            directly.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="font-display text-lg font-bold text-text-primary">Full List</h3>
        <div className="mt-4 space-y-8">
          {Object.entries(byCategory).map(([category, list]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {CATEGORIES[category] || category}
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((s) => (
                  <ScholarshipCard key={s.id} s={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
          <CalendarClock size={18} className="text-accent-contrast" /> Timeline
        </h3>
        <div className="mt-4 space-y-3">
          {timeline.map(([month, list]) => (
            <div key={month} className="rounded-2xl border border-border bg-surface-raised p-4">
              <p className="text-sm font-semibold text-text-primary">{month}</p>
              <ul className="mt-2 space-y-1.5">
                {list.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-text-secondary">{s.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getDeadlineBadge(s.deadline)}`}>
                      {formatDeadline(s.deadline)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

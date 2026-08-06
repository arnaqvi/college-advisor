import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import { buildProgramSearchUrl } from '../lib/programLinks.js'

const TIER_STYLES = {
  Reach: 'bg-reach-bg text-reach',
  Target: 'bg-target-bg text-target',
  Safety: 'bg-safety-bg text-safety',
  Incomplete: 'bg-surface text-text-secondary',
}

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'type', label: 'Group by Public/Private' },
  { value: 'state', label: 'Group by State' },
]

// Section 3.9 / Section 4 of the master spec: show each program's
// accepted-student GPA range and SAT range on the College List. `gpaBand`
// (backend-sourced — see lib/api/colleges.js — always manually curated,
// never touched by the Scorecard sync, see backend/app/models/college.py)
// is currently a single blended figure for these seed schools (no weighted/
// unweighted split published) — if a future record adds
// `gpaBand.weighted`/`gpaBand.unweighted` sub-bands, this renders those
// instead. Never fabricate a split that isn't in the data.
function formatGpaRange(gpaBand) {
  if (!gpaBand) return 'Not published'
  const { weighted, unweighted, p25, p75, scale } = gpaBand
  if (weighted && unweighted) {
    return `${weighted.p25.toFixed(1)}–${weighted.p75.toFixed(1)} weighted / ${unweighted.p25.toFixed(1)}–${unweighted.p75.toFixed(1)} unweighted`
  }
  if (typeof p25 === 'number' && typeof p75 === 'number') {
    return `${p25.toFixed(1)}–${p75.toFixed(1)} (blended, ${scale?.toFixed?.(1) ?? scale} scale)`
  }
  return 'Not published'
}

// `satBand` is absent (rather than fabricated) for test-optional schools with
// no published percentile range.
function formatSatRange(satBand) {
  if (!satBand || typeof satBand.p25 !== 'number' || typeof satBand.p75 !== 'number') {
    return 'Test-optional — no range published'
  }
  return `${satBand.p25}–${satBand.p75}`
}

// State column: prefix each row's 2-letter state with "In State" / "Out of
// State" relative to the student's home state (Profile > Background &
// Eligibility > Home State, `studentProfile.homeState` — 2-letter code,
// same format as `college.state`, see data/collegePreferenceOptions.js).
// Never hardcode a state — always derive from the live profile so this stays
// correct as the student edits Profile. No home state saved yet -> no label,
// just the plain state code (nothing to compare against).
function formatStateLabel(rowState, homeState) {
  if (!rowState) return rowState
  if (!homeState) return rowState
  return rowState === homeState ? `In State · ${rowState}` : `Out of State · ${rowState}`
}

// Best-fit-first ordering. Higher fitScore wins; ties break by prestige rank
// (nulls last — imported Scorecard directory rows carry no ranking) then name.
function byFit(a, b) {
  const fa = typeof a.fitScore === 'number' ? a.fitScore : 0
  const fb = typeof b.fitScore === 'number' ? b.fitScore : 0
  if (fb !== fa) return fb - fa
  const ra = typeof a.ranking === 'number' ? a.ranking : Number.POSITIVE_INFINITY
  const rb = typeof b.ranking === 'number' ? b.ranking : Number.POSITIVE_INFINITY
  if (ra !== rb) return ra - rb
  return (a.name || '').localeCompare(b.name || '')
}

export default function CollegeDirectory() {
  const { derivedPlan, studentProfile } = useAppContext()
  const { classifiedPrograms, collegeList } = derivedPlan
  const incompleteCount = classifiedPrograms.filter((c) => c.tier === 'Incomplete').length
  const [category, setCategory] = useState('All Categories')
  const [department, setDepartment] = useState('All Departments')
  const [state, setState] = useState('All States')
  const [groupBy, setGroupBy] = useState('none')

  // Filter dropdown options are derived from what's actually in the fetched
  // directory rather than a hand-maintained static list — this is what
  // structurally prevents the recurring "forgot to add a state/dept to the
  // list" class of bug (e.g. the 2026-07-28 missing-Texas-schools /
  // Tulsa-tagged-TX incidents): the options can never drift out of sync with
  // the real data because they're computed from it every render.
  const categories = useMemo(
    () => [...new Set(classifiedPrograms.map((c) => c.category).filter(Boolean))].sort(),
    [classifiedPrograms]
  )
  const departments = useMemo(
    () => [...new Set(classifiedPrograms.map((c) => c.dept).filter(Boolean))].sort(),
    [classifiedPrograms]
  )
  const states = useMemo(
    () => [...new Set(classifiedPrograms.map((c) => c.state).filter(Boolean))].sort(),
    [classifiedPrograms]
  )

  useRevealOnMount([derivedPlan])

  const filtered = useMemo(
    () =>
      classifiedPrograms
        .filter((c) => {
          if (category !== 'All Categories' && c.category !== category) return false
          if (department !== 'All Departments' && c.dept !== department) return false
          if (state !== 'All States' && c.state !== state) return false
          return true
        })
        // Personalized ordering (Spec 4): best fit for THIS student first, so
        // the list visibly re-ranks whenever the profile changes. fitScore is
        // computed per-program in lib/engine/classification.js from the tier +
        // academic closeness + target-state preference. Ties break by prestige
        // rank (nulls last, e.g. imported directory rows) then name.
        .slice()
        .sort(byFit),
    [classifiedPrograms, category, department, state]
  )

  const groups = useMemo(() => {
    if (groupBy === 'none') return { 'All Colleges': filtered }
    const source = groupBy === 'type' ? collegeList.byType : collegeList.byState
    return Object.fromEntries(
      Object.entries(source).map(([key, list]) => [
        key,
        list.filter((c) => filtered.includes(c)).slice().sort(byFit),
      ])
    )
  }, [groupBy, filtered, collegeList])

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">College List</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Explore Your Plan across reach, target, and safety schools.
        {incompleteCount < classifiedPrograms.length && (
          <span className="text-text-secondary"> Ranked by best fit for your profile — update your <Link to="/profile" className="font-semibold text-accent-contrast hover:underline">Profile</Link> and the list re-orders.</span>
        )}
      </p>

      {incompleteCount > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm text-text-secondary">
          <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
          <p>
            {incompleteCount === classifiedPrograms.length
              ? "Every school below shows as Incomplete because your GPA and test scores aren't saved yet."
              : `${incompleteCount} school${incompleteCount === 1 ? '' : 's'} still show${incompleteCount === 1 ? 's' : ''} as Incomplete because your GPA and test scores aren't saved yet.`}{' '}
            <Link to="/profile" className="font-semibold text-accent-contrast hover:underline">
              Add them in Profile
            </Link>{' '}
            to see real Reach/Target/Safety classifications for each school.
          </p>
        </div>
      )}

      {collegeList.stateCoverageGaps.length > 0 && (
        <p className="mt-3 rounded-2xl border border-target/30 bg-target-bg px-3 py-2 text-xs text-target">
          No colleges yet in your target state(s): {collegeList.stateCoverageGaps.join(', ')}.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Select label="All Categories" value={category} onChange={setCategory} options={categories} />
        <Select label="All Departments" value={department} onChange={setDepartment} options={departments} />
        <Select label="All States" value={state} onChange={setState} options={states} />
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        >
          {GROUP_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {Object.entries(groups).map(([groupName, list], i) => (
        <Reveal key={groupName} delay={`${i * 0.05}s`} className="landing-stagger mt-6">
          {groupBy !== 'none' && (
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              {groupName} ({list.length})
            </h3>
          )}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-text-secondary">
                <tr>
                  <Th>Name</Th>
                  <Th>State</Th>
                  <Th>Type</Th>
                  <Th>Size</Th>
                  <Th>Dept</Th>
                  <Th>Tier</Th>
                  <Th>Ranking</Th>
                  <Th>Admit Rate</Th>
                  <Th>GPA Range</Th>
                  <Th>SAT Range</Th>
                  <Th>Look Up</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => (
                  <tr key={c.id} className="bg-surface-raised hover:bg-surface">
                    <Td className="font-medium text-text-primary">{c.name}</Td>
                    <Td className="whitespace-nowrap">{formatStateLabel(c.state, studentProfile.homeState)}</Td>
                    <Td>{c.type}</Td>
                    <Td>{c.size}</Td>
                    <Td>{c.dept}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_STYLES[c.tier]}`}>
                        {c.tier}
                      </span>
                    </Td>
                    <Td>{typeof c.ranking === 'number' ? `#${c.ranking}` : '—'}</Td>
                    <Td>{typeof c.admitRate === 'number' ? `${Math.round(c.admitRate * 100)}%` : '—'}</Td>
                    <Td className="whitespace-nowrap">{formatGpaRange(c.gpaBand)}</Td>
                    <Td className="whitespace-nowrap">{formatSatRange(c.satBand)}</Td>
                    <Td className="whitespace-nowrap">
                      <a
                        href={buildProgramSearchUrl(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-accent-contrast hover:underline"
                      >
                        Search
                      </a>
                    </Td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <Td colSpan={11} className="py-6 text-center text-text-secondary">
                      No programs match your filters.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Reveal>
      ))}
    </Reveal>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
    >
      <option>{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>
}

function Td({ children, className = '', colSpan }) {
  return (
    <td className={`px-4 py-3 text-text-secondary ${className}`} colSpan={colSpan}>
      {children}
    </td>
  )
}

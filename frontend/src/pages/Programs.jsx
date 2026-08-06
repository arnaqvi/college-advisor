import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import { buildProgramSearchUrl } from '../lib/programLinks.js'

export default function Programs() {
  const { derivedPlan } = useAppContext()
  const [category, setCategory] = useState('All Categories')
  const [department, setDepartment] = useState('All Departments')
  const [hiddenGemsOnly, setHiddenGemsOnly] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // See CollegeDirectory.jsx for why these are derived from live data
  // instead of a hand-maintained static list.
  const categories = useMemo(
    () => [...new Set(derivedPlan.programDeepDive.map((c) => c.category).filter(Boolean))].sort(),
    [derivedPlan.programDeepDive]
  )
  const departments = useMemo(
    () => [...new Set(derivedPlan.programDeepDive.map((c) => c.dept).filter(Boolean))].sort(),
    [derivedPlan.programDeepDive]
  )

  useRevealOnMount([derivedPlan])

  const filtered = useMemo(
    () =>
      derivedPlan.programDeepDive.filter((c) => {
        if (category !== 'All Categories' && c.category !== category) return false
        if (department !== 'All Departments' && c.dept !== department) return false
        if (hiddenGemsOnly && !c.gemProfile) return false
        return true
      }),
    [derivedPlan.programDeepDive, category, department, hiddenGemsOnly]
  )

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Program Directory</h2>
      <p className="mt-1 text-sm text-text-secondary">Explore degree programs across every school in your list.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        >
          <option>All Categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary"
        >
          <option>All Departments</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={hiddenGemsOnly}
            onChange={(e) => setHiddenGemsOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface-raised"
          />
          Hidden gems only
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => {
          const isExpanded = expandedId === p.id
          return (
            <Reveal
              key={p.id}
              delay={`${i * 0.05}s`}
              className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <div>
                  <h3 className="font-semibold text-text-primary">{p.dept}</h3>
                  <p className="text-sm text-text-secondary">{p.name}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">{p.category}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp size={16} className="mt-1 shrink-0 text-text-secondary" />
                ) : (
                  <ChevronDown size={16} className="mt-1 shrink-0 text-text-secondary" />
                )}
              </button>
              {isExpanded && (
                <div className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">
                  <p>{p.alignment.note}</p>
                  {p.alignment.satisfiedCourses.length > 0 && (
                    <p className="mt-2">
                      <span className="font-medium text-text-primary">Satisfied: </span>
                      {p.alignment.satisfiedCourses.join(', ')}
                    </p>
                  )}
                  {p.alignment.gapCourses.length > 0 && (
                    <p className="mt-1">
                      <span className="font-medium text-text-primary">Gaps: </span>
                      {p.alignment.gapCourses.join(', ')}
                    </p>
                  )}
                  <a
                    href={buildProgramSearchUrl(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 font-medium text-accent-contrast hover:underline"
                  >
                    Look up this program <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </Reveal>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-text-secondary">No programs match your filters.</p>
        )}
      </div>
    </Reveal>
  )
}

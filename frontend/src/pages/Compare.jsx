import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { compareColleges } from '../lib/engine/comparisonTool.js'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

const MAX_SELECTED = 3

export default function Compare() {
  const { studentProfile, derivedPlan } = useAppContext()
  const options = derivedPlan.comparisonShortlist
  const [selectedIds, setSelectedIds] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // Same click-outside-closes pattern as MultiSelect.jsx, for consistency.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = useMemo(
    () => selectedIds.map((id) => options.find((c) => c.id === id)).filter(Boolean),
    [selectedIds, options]
  )

  // The full shortlist can run into the hundreds (every non-Incomplete
  // college on the student's list) — a bare pill-per-college wall doesn't
  // scale past a few dozen, so this only ever shows a short, name-filtered
  // list instead of everything at once.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return options.filter((c) => !selectedIds.includes(c.id) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, options, selectedIds])

  const result = useMemo(
    () => compareColleges(studentProfile, selectedIds, derivedPlan.classifiedPrograms),
    [studentProfile, selectedIds, derivedPlan.classifiedPrograms]
  )

  // Deps include result.columns.length, not just derivedPlan — the result
  // table only enters the DOM once the user has picked colleges, well after
  // the initial mount-time scan, so the scroll-reveal observer must re-scan
  // whenever the table appears or its selection changes.
  useRevealOnMount([derivedPlan, result.columns.length])

  function addCollege(id) {
    if (selectedIds.length >= MAX_SELECTED || selectedIds.includes(id)) return
    setSelectedIds((prev) => [...prev, id])
    setQuery('')
    setOpen(false)
  }

  function removeCollege(id) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  const atLimit = selectedIds.length >= MAX_SELECTED

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Compare Colleges</h2>
      <p className="mt-1 text-sm text-text-secondary">Search your list and pick up to 3 colleges to compare side by side.</p>

      <div className="relative mt-6 max-w-md" ref={rootRef}>
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selected.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast"
              >
                {c.name}
                <button type="button" onClick={() => removeCollege(c.id)} aria-label={`Remove ${c.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          disabled={atLimit}
          placeholder={atLimit ? 'Remove one to add another' : 'Search colleges to compare…'}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary disabled:opacity-50"
        />

        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addCollege(c.id)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-accent/10"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && suggestions.length === 0 && (
          <p className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-secondary shadow-lg">
            No matches on your list.
          </p>
        )}

        {options.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Add your GPA and test scores in Profile to build a comparison shortlist.</p>
        )}
      </div>

      {result.columns.length > 0 ? (
        <Reveal className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <Th>Metric</Th>
                {result.columns.map((c) => (
                  <Th key={c.id}>{c.name}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-raised">
              <Row label="Dept" columns={result.columns} field="dept" />
              <Row label="Tier" columns={result.columns} field="tier" />
              <Row label="Type" columns={result.columns} field="type" />
              <Row label="Ranking" columns={result.columns} field="ranking" render={(v) => `#${v}`} />
              <Row label="Admit Rate" columns={result.columns} field="admitRate" render={(v) => `${Math.round(v * 100)}%`} />
              <Row label="Cost" columns={result.columns} field="cost" />
              <Row label="Deadlines" columns={result.columns} field="deadlines" />
            </tbody>
          </table>
        </Reveal>
      ) : (
        <p className="mt-6 text-sm text-text-secondary">{result.synthesisLine}</p>
      )}
      {result.columns.length > 0 && <p className="mt-3 text-sm text-text-secondary">{result.synthesisLine}</p>}
    </Reveal>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>
}

function Row({ label, columns, field, render }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-primary">{label}</td>
      {columns.map((c) => (
        <td key={c.id} className="px-4 py-3 text-text-secondary">
          {render ? render(c[field]) : c[field]}
        </td>
      ))}
    </tr>
  )
}

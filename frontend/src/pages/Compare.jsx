import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import { compareColleges } from '../lib/engine/comparisonTool.js'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

export default function Compare() {
  const { studentProfile, derivedPlan } = useAppContext()
  const options = derivedPlan.comparisonShortlist
  const [selectedIds, setSelectedIds] = useState([])

  const result = useMemo(
    () => compareColleges(studentProfile, selectedIds, derivedPlan.classifiedPrograms),
    [studentProfile, selectedIds, derivedPlan.classifiedPrograms]
  )

  // Deps include result.columns.length, not just derivedPlan — the result
  // table only enters the DOM once the user has picked colleges, well after
  // the initial mount-time scan, so the scroll-reveal observer must re-scan
  // whenever the table appears or its selection changes.
  useRevealOnMount([derivedPlan, result.columns.length])

  function toggleSelection(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Compare Colleges</h2>
      <p className="mt-1 text-sm text-text-secondary">Pick up to 3 colleges from your list to compare side by side.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c.id}
            onClick={() => toggleSelection(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              selectedIds.includes(c.id)
                ? 'border-accent bg-accent text-accent-contrast'
                : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
            }`}
          >
            {c.name}
          </button>
        ))}
        {options.length === 0 && (
          <p className="text-sm text-text-secondary">Add your GPA and test scores in Profile to build a comparison shortlist.</p>
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

import { ClipboardCheck } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

export default function GapAnalysis() {
  const { derivedPlan } = useAppContext()

  useRevealOnMount([derivedPlan])

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
        Application Gap Analysis
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Per-college benchmark against verified applicant outcomes, plus how complete your own application materials are.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {derivedPlan.gapAnalysis.map((g, i) => (
          <Reveal
            key={g.programId}
            delay={`${i * 0.05}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <h3 className="font-semibold text-text-primary">{g.programName}</h3>
            <p className="mt-2 flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
              <ClipboardCheck size={14} />
              {g.message}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {g.completenessChecklist.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 ${item.complete ? 'text-safety' : 'text-text-secondary'}`}
                >
                  <span>{item.complete ? '✓' : '○'}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Reveal>
  )
}

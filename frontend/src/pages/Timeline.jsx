import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

export default function Timeline() {
  const { derivedPlan } = useAppContext()

  useRevealOnMount([derivedPlan])

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
        Month-by-Month Timeline
      </h2>
      <p className="mt-1 text-sm text-text-secondary">Student and parent action items across the application season.</p>

      <div className="mt-6 space-y-4">
        {derivedPlan.roadmap.map((m, i) => (
          <Reveal
            key={m.month}
            delay={`${i * 0.04}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <h3 className="font-semibold text-text-primary">
              {m.month}
              {m.year ? ` ${m.year}` : ''}
            </h3>
            {m.hardDeadlines.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-medium text-reach">
                {m.hardDeadlines.map((d) => (
                  <li key={d.label}>
                    {d.date ? `${d.date} — ` : ''}
                    {d.label}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Student Tasks</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                  {m.studentTasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Parent Tasks</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                  {m.parentTasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Reveal>
  )
}

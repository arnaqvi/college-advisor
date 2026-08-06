import { SCHOLARSHIPS } from '../data/scholarships.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const { derivedPlan } = useAppContext()
  const { snapshot, roadmap, classifiedPrograms } = derivedPlan
  const hasProfile = Boolean(snapshot.gpa || snapshot.testScores)

  useRevealOnMount([derivedPlan])

  const stats = [
    { label: 'Colleges Tracked', value: classifiedPrograms.length },
    { label: 'Reach Schools', value: snapshot.tierCounts.Reach || 0 },
    { label: 'Target Schools', value: snapshot.tierCounts.Target || 0 },
    { label: 'Safety Schools', value: snapshot.tierCounts.Safety || 0 },
    { label: 'Open Scholarships', value: SCHOLARSHIPS.length },
    { label: 'Timeline Months', value: roadmap.length },
  ]

  return (
    <Reveal>
      {user && (
        <p className="mb-4 inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-medium capitalize text-accent-contrast">
          Welcome back, {user.name || user.email} · {user.role}
        </p>
      )}
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
        Your Personalized Roadmap
      </h2>
      <p className="mt-1 text-sm text-text-secondary">Overview of the student's college admissions plan.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <Reveal
            key={s.label}
            delay={`${i * 0.05}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <p className="text-2xl font-semibold text-text-primary">{s.value}</p>
            <p className="mt-1 text-xs text-text-secondary">{s.label}</p>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="landing-hover rounded-2xl border border-border bg-surface-raised p-4">
          <h3 className="font-display font-bold text-text-primary">Snapshot — Strengths</h3>
          {hasProfile ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
              {snapshot.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              Add your GPA and test scores in Profile to see your snapshot.
            </p>
          )}
        </div>
        <div className="landing-hover rounded-2xl border border-border bg-surface-raised p-4">
          <h3 className="font-display font-bold text-text-primary">Snapshot — Gaps to Close</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
            {snapshot.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  )
}

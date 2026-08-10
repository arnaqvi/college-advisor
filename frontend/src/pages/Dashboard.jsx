import { Link, useNavigate } from 'react-router-dom'
import { Bot, Gem } from 'lucide-react'
import { SCHOLARSHIPS } from '../data/scholarships.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import ProfileCompletionMeter from '../components/ProfileCompletionMeter.jsx'
import { pickAdvisorPrompt } from '../lib/engine/advisorNudge.js'
import { pickWeeklyGem } from '../lib/engine/weeklyPick.js'

export default function Dashboard() {
  const { user } = useAuth()
  const { derivedPlan } = useAppContext()
  const navigate = useNavigate()
  const { snapshot, roadmap, classifiedPrograms, hiddenGems } = derivedPlan
  const hasProfile = Boolean(snapshot.gpa || snapshot.testScores)
  const advisorPrompt = pickAdvisorPrompt(snapshot, roadmap)
  const weeklyGem = pickWeeklyGem(hiddenGems)

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

      <Reveal delay="0.02s" className="landing-stagger mt-6">
        <ProfileCompletionMeter />
      </Reveal>

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

      <Reveal delay="0.1s" className="landing-stagger mt-8">
        <button
          type="button"
          onClick={() => navigate('/profile', { state: { advisorPrompt } })}
          className="landing-hover flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised p-4 text-left"
        >
          <Bot size={20} className="shrink-0 text-accent-contrast" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Ask your AI Advisor</p>
            <p className="mt-1 text-sm font-medium text-text-primary">{advisorPrompt}</p>
          </div>
        </button>
      </Reveal>

      {weeklyGem && (
        <Reveal delay="0.14s" className="landing-stagger mt-4">
          <Link
            to="/hidden-gems"
            className="landing-hover flex items-center gap-3 rounded-2xl border border-[var(--mint-tint)] bg-[var(--mint-tint)]/40 p-4"
          >
            <Gem size={20} className="shrink-0 text-[var(--mint-deep)]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--mint-deep)]">
                This Week's Hidden Gem
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">{weeklyGem.name}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{weeklyGem.whyFits}</p>
            </div>
          </Link>
        </Reveal>
      )}

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

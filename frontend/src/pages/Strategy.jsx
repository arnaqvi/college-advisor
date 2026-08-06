import { TIERS, DECISION_SEASONS, KEY_DIFFERENTIATORS } from '../data/strategy.js'
import StrategyCard from '../components/StrategyCard.jsx'
import { Gem, Target, Award, CalendarClock, Clock } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

const TIER_STYLES = {
  Reach: 'border-reach/30 bg-reach-bg text-reach',
  Target: 'border-target/30 bg-target-bg text-target',
  Safety: 'border-safety/30 bg-safety-bg text-safety',
}

export default function Strategy() {
  const { derivedPlan } = useAppContext()
  const tierCounts = derivedPlan.snapshot.tierCounts

  useRevealOnMount([derivedPlan])

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">
        College Admission Strategy
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Reach, Target &amp; Safety tiers and how to sequence your applications.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.tier} delay={`${i * 0.05}s`} className="landing-stagger">
            <StrategyCard
              tier={t.tier}
              title={t.tier}
              className={`landing-hover border ${TIER_STYLES[t.tier]}`}
              cta={{ label: 'View schools', to: '/colleges' }}
              icon={t.tier === 'Reach' ? Gem : t.tier === 'Target' ? Target : Award}
              badge={`${tierCounts[t.tier] || 0} on your list`}
            >
              <p className="text-sm text-text-secondary">{t.description}</p>
            </StrategyCard>
          </Reveal>
        ))}
      </div>

      <h3 className="font-display mt-8 text-lg font-bold text-text-primary">Per-Program Strategy</h3>
      <p className="mt-1 text-sm text-text-secondary">What to emphasize for each program on your list.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {derivedPlan.perProgramStrategy.map((s, i) => (
          <Reveal
            key={s.programId}
            delay={`${i * 0.04}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <h4 className="font-semibold text-text-primary">{s.programName}</h4>
            <p className="mt-1 text-sm text-text-secondary">{s.note}</p>
          </Reveal>
        ))}
      </div>

      <h3 className="font-display mt-8 text-lg font-bold text-text-primary">Decision Season</h3>
      <p className="mt-1 text-sm text-text-secondary">
        Early Action, Early Decision or Regular Decision — and Rolling Admission.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {DECISION_SEASONS.map((d, i) => (
          <Reveal key={d.label} delay={`${i * 0.05}s`} className="landing-stagger">
            <StrategyCard
              title={d.label}
              className="landing-hover border border-border bg-surface-raised"
              icon={d.label === 'Early Decision' ? Clock : CalendarClock}
              badge={d.label === 'Early Decision' ? 'Binding' : d.label === 'Rolling Admission' ? 'Rolling' : undefined}
            >
              <p className="mt-1 text-sm text-text-secondary">{d.description}</p>
            </StrategyCard>
          </Reveal>
        ))}
      </div>

      <h3 className="font-display mt-8 text-lg font-bold text-text-primary">Key Differentiators</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-text-secondary">
        {KEY_DIFFERENTIATORS.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
    </Reveal>
  )
}

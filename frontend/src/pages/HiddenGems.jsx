import { Gem, ExternalLink } from 'lucide-react'
import { useAppContext } from '../context/AppContext.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'
import { buildProgramSearchUrl } from '../lib/programLinks.js'

export default function HiddenGems() {
  const { derivedPlan } = useAppContext()
  const gems = derivedPlan.hiddenGems

  useRevealOnMount([derivedPlan])

  return (
    <Reveal>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-text-primary">Hidden Gem Programs</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Lesser-known schools with strong outcomes and higher odds of admission.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gems.map((g, i) => (
          <Reveal
            key={g.id}
            delay={`${i * 0.05}s`}
            className="landing-hover landing-stagger rounded-2xl border border-border bg-surface-raised p-4"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--mint-tint)] px-2.5 py-1 text-[var(--mint-deep)]">
              <Gem size={14} />
              <span className="text-xs font-semibold uppercase tracking-wide">Hidden Gem</span>
            </div>
            <h3 className="mt-2 font-semibold text-text-primary">{g.name}</h3>
            <p className="text-sm text-text-secondary">{g.location}</p>
            <p className="mt-2 text-sm text-text-secondary">
              {[
                g.dept,
                typeof g.admitRate === 'number' ? `Admit rate ${Math.round(g.admitRate * 100)}%` : null,
                typeof g.ranking === 'number' ? `Ranked #${g.ranking}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Why overlooked: </span>
              {g.whyOverlooked}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Why it fits: </span>
              {g.whyFits}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Angle: </span>
              {g.angle}
            </p>
            <a
              href={buildProgramSearchUrl(g)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-contrast hover:underline"
            >
              Look up this program <ExternalLink size={14} />
            </a>
          </Reveal>
        ))}
        {gems.length === 0 && (
          <p className="col-span-full py-6 text-center text-text-secondary">No hidden gems match your profile yet.</p>
        )}
      </div>
    </Reveal>
  )
}

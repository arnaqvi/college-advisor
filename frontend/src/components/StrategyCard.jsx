import { Link } from 'react-router-dom'
import { Star, Target, Shield, CalendarClock } from 'lucide-react'

function IconRenderer({ Icon }) {
  if (!Icon) return null
  return <Icon size={20} className="text-ink" />
}

export default function StrategyCard({ tier, title, children, className = '', cta, icon: Icon, badge }) {
  return (
    <article
      className={`relative rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${className}`}
      aria-labelledby={`strategy-${tier || title}`}
    >
      {/* badge */}
      {badge && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm">
          <span className="uppercase tracking-wide text-[10px]">{badge}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="rounded-md bg-accent/20 p-2 text-accent-contrast">
              <Icon size={18} />
            </div>
          )}
          <div>
            <h4 id={`strategy-${tier || title}`} className="text-sm font-semibold text-text-primary">
              {title}
            </h4>
            {tier && <p className="mt-1 text-xs text-text-secondary capitalize">{tier}</p>}
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-text-secondary">{children}</div>

      {cta && (
        <div className="mt-4">
          {cta.to ? (
            <Link
              to={cta.to}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast hover:bg-accent/90"
            >
              {cta.label}
            </Link>
          ) : (
            <button className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast hover:bg-accent/90">
              {cta.label}
            </button>
          )}
        </div>
      )}
    </article>
  )
}


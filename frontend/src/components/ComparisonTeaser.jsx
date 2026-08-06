import { ArrowRight, Columns } from 'lucide-react'

export default function ComparisonTeaser() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
      <div className="rounded-[28px] border border-border bg-surface p-7 shadow-sm shadow-ink/5 sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-aquamarine">
              Comparison tool
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Compare two schools in seconds and choose the plan that fits.
            </h2>
            <p className="mt-4 text-base leading-7 text-text-secondary">
              View tuition, outcomes, campus energy, and scholarship fit all on one clean card.
            </p>
          </div>
          <div className="rounded-[28px] border border-border bg-surface-raised p-5 shadow-sm shadow-ink/5 sm:p-7">
            <div className="flex items-center justify-between rounded-3xl bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-sm shadow-ink/5">
              <span>College comparison</span>
              <Columns size={18} className="text-aquamarine" />
            </div>
            <div className="mt-5 space-y-4">
              {['University Lakeview', 'North Coastal College'].map((school, index) => (
                <div key={school} className="rounded-3xl bg-surface px-4 py-4 shadow-sm shadow-ink/5">
                  <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>{school}</span>
                    <span className="rounded-full bg-aquamarine/10 px-3 py-1 text-xs font-semibold text-aquamarine">
                      {index === 0 ? 'Top choice' : 'Strong fit'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">Match</p>
                      <p className="mt-2 text-lg font-semibold text-ink">{index === 0 ? '89%' : '82%'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">Cost</p>
                      <p className="mt-2 text-lg font-semibold text-ink">{index === 0 ? '$27K' : '$23K'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">Program fit</p>
                      <p className="mt-2 text-lg font-semibold text-ink">{index === 0 ? 'STEM' : 'Design'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-aquamarine px-5 py-3 text-sm font-semibold text-ink transition hover:bg-aquamarine/90">
              Open comparison tool
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

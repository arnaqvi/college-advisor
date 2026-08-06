import { GraduationCap, MapPin, CalendarDays, FileText, Sparkles, Columns } from 'lucide-react'

const features = [
  {
    icon: GraduationCap,
    title: 'College Matching',
    description: 'Group reach, target, and safety schools with confidence signals and fit metrics.',
  },
  {
    icon: MapPin,
    title: 'Program Alignment',
    description: 'Compare majors, campus culture, and career fit across each school plan.',
  },
  {
    icon: CalendarDays,
    title: 'Month-by-Month Roadmap',
    description: 'Keep every deadline, interview prep task, and event reminder on track.',
  },
  {
    icon: FileText,
    title: 'Essay Tracker',
    description: 'Organize prompts, drafts, reviews, and submission status in one place.',
  },
  {
    icon: Sparkles,
    title: 'Extracurricular Recommendations',
    description: 'See high-value activities that strengthen your personal story and profile.',
  },
  {
    icon: Columns,
    title: 'University Comparison Tool',
    description: 'Side-by-side views of tuition, outcomes, campus vibe, and program strength.',
  },
]

export default function FeatureGrid() {
  return (
    <section id="product" className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-aquamarine">Product</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          The planning toolkit that keeps every step of your path visible.
        </h2>
        <p className="mt-4 text-lg leading-8 text-text-secondary">
          A streamlined home for strategy, essays, deadlines, and the comparison tools families need.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <div key={feature.title} className="group overflow-hidden rounded-3xl border border-border bg-surface p-7 shadow-sm shadow-ink/5 transition hover:-translate-y-1 hover:border-aquamarine/40">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-aquamarine/10 text-aquamarine transition group-hover:bg-aquamarine/15">
                <Icon size={24} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-ink">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{feature.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

import { CheckCircle2, LayoutDashboard, ShieldCheck, Trophy } from 'lucide-react'

const sections = [
  {
    title: 'Match schools to your profile with confidence',
    description:
      'College Matching surfaces reach, target, and safety pairings while showing where you fit academically and financially. Choose the mix that keeps options open without losing focus.',
    bullets: ['GPA and test score fit bands', 'Tuition and timeline clarity', 'Early action vs regular decision guidance'],
    direction: 'left',
  },
  {
    title: 'A unified roadmap for essays, activities, and deadlines',
    description:
      'One view tracks essay drafts, recommendation requests, test dates, and completed milestones so students stay ahead without juggling spreadsheets.',
    bullets: ['Deadline alerts', 'Essay prompt status', 'Progress across every application'],
    direction: 'right',
  },
  {
    title: 'Compare top schools side-by-side',
    description:
      'A compact comparison teaser helps families evaluate academic programs, campus experience, and offer odds before making the final shortlist.',
    bullets: ['Cost and outcome signals', 'Program strengths', 'Best-fit recommendations'],
    direction: 'left',
  },
]

function SectionCard({ title, description, bullets, direction }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <div className={`order-1 rounded-[28px] border border-border bg-surface p-8 shadow-sm shadow-ink/5 ${direction === 'right' ? 'lg:order-2' : ''}`}>
        <div className="rounded-3xl bg-[#86E7B8] p-6 text-[#173126] shadow-lg shadow-[#86E7B8]/25">
          <div className="mb-6 flex items-center gap-3 text-[#173126]/75">
            <LayoutDashboard size={20} />
            Live plan preview
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl bg-[#93FF96]/70 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[#173126]/65">Progress</p>
              <p className="mt-3 text-3xl font-semibold">82%</p>
            </div>
            <div className="grid gap-3">
              {['Reach', 'Target', 'Safety'].map((label) => (
                <div key={label} className="rounded-3xl bg-[#F2F5DE]/75 px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-[#173126]/80">
                    <span>{label}</span>
                    <span>{label === 'Reach' ? '3' : label === 'Target' ? '4' : '2'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`order-2 space-y-6 ${direction === 'right' ? 'lg:order-1' : ''}`}>
        <div className="rounded-3xl bg-surface p-8 shadow-sm shadow-ink/5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-aquamarine">CollegePath module</p>
          <h3 className="mt-4 text-3xl font-semibold text-ink">{title}</h3>
          <p className="mt-5 text-base leading-7 text-text-secondary">{description}</p>
          <ul className="mt-6 space-y-4">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
                <CheckCircle2 size={18} className="mt-1 text-aquamarine" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function DeepDiveSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
      <div className="space-y-20">
        {sections.map((section) => (
          <SectionCard key={section.title} {...section} />
        ))}
      </div>
    </section>
  )
}

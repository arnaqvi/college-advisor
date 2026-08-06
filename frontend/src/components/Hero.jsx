import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-[88px]">
      <div className="mx-auto px-5 md:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--ink)]">
              Personalized admissions planning built for North America
            </div>
            <h1 className="font-display mt-8 text-[42px] font-extrabold leading-[1.04] tracking-tight text-[var(--ink)] sm:text-[56px]">
              Build a smarter college roadmap with the confidence of a guided plan.
            </h1>
            <p className="mt-6 max-w-[480px] text-[17px] leading-8 text-[var(--ink-soft)]">
              CollegePath brings your reach, target, and safety strategy together with essay deadlines, activity guidance, and side-by-side school comparison.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                to="/login"
                className="landing-button-dark inline-flex items-center justify-center rounded-full bg-[#0E0F0C] px-6 py-3.5 text-sm font-semibold text-white"
              >
                Get Started
              </Link>
              <Link
                to="#product"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition-colors duration-300 hover:bg-[var(--bg)]"
              >
                <Play size={16} />
                See how it works
              </Link>
            </div>
          </div>

          <div className="w-full rounded-2xl bg-gradient-to-b from-white to-[var(--bg-card)] p-6 shadow-[0_20px_40px_rgba(16,18,16,0.08)]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--ink)]">Application pulse</span>
                  <span className="text-xs font-medium text-[var(--ink-faint)]">Updated 2 min ago</span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {['SAT Fit', 'Essay Readiness', 'Deadline Health'].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-safety/15 bg-gradient-to-br from-safety-bg to-[#D9EFE1] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">{item}</p>
                      <p className="mt-3 text-base font-semibold text-safety">On track</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-gradient-to-b from-white to-[#F1F3EE] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">My plan</p>
                  <h2 className="font-display mt-3 text-xl font-bold text-[var(--ink)]">Month-by-month roadmap</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                    Progress through target tasks and keep every deadline in one view.
                  </p>
                </div>
                <div className="rounded-xl bg-gradient-to-b from-white to-[#F1F3EE] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">Next milestone</p>
                  <p className="font-display mt-3 text-xl font-bold text-[var(--ink)]">Finalize draft 1</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                    Due in 4 days for your top-choice essays.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

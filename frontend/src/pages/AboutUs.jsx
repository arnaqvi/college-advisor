import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const offerings = [
  {
    title: 'Personalized Roadmaps',
    description:
      "Guidance tailored to each student's grade level, goals, and interests, from course selection to application strategy.",
  },
  {
    title: 'Deadline & Task Tracking',
    description:
      'Never miss an application, financial aid, or scholarship deadline again.',
  },
  {
    title: 'Essay & Application Support',
    description:
      'Tools and feedback to help students put their best work forward.',
  },
  {
    title: 'Family-Friendly Plans',
    description:
      "Whether you're guiding one student or three, our plans are built to grow with your family.",
  },
]

const values = [
  {
    title: 'Accessibility First',
    description:
      'Every feature we build starts with the question: "Can a working family afford this?"',
  },
  {
    title: 'Student-Centered',
    description:
      "Our guidance is built around what's right for each student, not a one-size-fits-all checklist.",
  },
  {
    title: 'Transparency',
    description:
      'Clear pricing, clear expectations, no hidden fees or surprise upsells.',
  },
  {
    title: 'Trust',
    description:
      "We handle student and family data with the same care we'd want for our own kids.",
  },
]

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />

      <main className="py-[88px]">
        <section className="mx-auto max-w-[1180px] px-5 md:px-8">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-12">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Helping Every Family Navigate the Road to College
            </h1>
            <p className="mt-6 max-w-4xl text-lg leading-8 text-[var(--ink-soft)]">
              Applying to college should not feel like a second full-time job for
              parents and students. Between deadlines, essays, financial aid forms,
              test prep, and school research, most families are left to figure it
              out on their own while private counseling remains out of reach for many.
            </p>
            <p className="mt-4 max-w-4xl text-lg leading-8 text-[var(--ink-soft)]">
              We built CollegePath to change that.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
              <h2 className="font-display text-3xl font-extrabold tracking-tight">Our Story</h2>
              <p className="mt-4 leading-8 text-[var(--ink-soft)]">
                CollegePath started with a simple observation: the best college
                guidance should not depend on your zip code or your budget. Too many
                talented students miss out on scholarships, dream schools, or better-fit
                programs simply because no one showed them the roadmap.
              </p>
              <p className="mt-4 leading-8 text-[var(--ink-soft)]">
                We set out to build a college advisor that is smart enough to give
                personalized guidance, affordable enough for any family, and simple
                enough to actually use from freshman year through the final decision letter.
              </p>
            </article>

            <article className="rounded-2xl border border-[var(--border)] bg-[var(--mint-tint)] p-8">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--mint-deep)]">
                Our Mission
              </h2>
              <p className="mt-4 leading-8 text-[var(--mint-deep)]/90">
                To make expert-level college guidance accessible to every student,
                regardless of their family's income or background, through smart,
                affordable, and personalized advising tools.
              </p>
            </article>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">What We Offer</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {offerings.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
                  <h3 className="font-display text-2xl font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-3 leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Why Families Choose Us</h2>
            <div className="mt-6 space-y-5 text-[var(--ink-soft)]">
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">Affordable for real families.</span>{' '}
                Our plans start free, and paid tiers cost a fraction of traditional counseling.
              </p>
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">Built for the whole family.</span>{' '}
                Our Family Plan supports up to three students under one account because college prep often runs for more than one child.
              </p>
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">No pressure, no gatekeeping.</span>{' '}
                We give students and parents tools to make informed decisions, not a sales pitch for any particular school.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Our Values</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {values.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
                  <h3 className="font-display text-2xl font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-3 leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Our Team</h2>
            <p className="mt-4 leading-8 text-[var(--ink-soft)]">
              CollegePath is built by a team of educators, technologists, and parents
              who have lived through the admissions process themselves as students,
              counselors, and parents supporting their own kids.
            </p>
            <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Founders</p>
            <div className="mt-3 flex flex-wrap gap-4">
              {['Abbas Naqvi', 'Ahsan Naqvi'].map((name) => (
                <div key={name} className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-5 py-3">
                  <p className="font-display text-lg font-bold tracking-tight">{name}</p>
                  <p className="text-sm text-[var(--ink-faint)]">Co-Founder</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-[28px] bg-[var(--mint)] px-8 py-10 text-[var(--mint-deep)] sm:px-10 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                Join Us
              </h2>
              <p className="mt-4 text-lg leading-8 text-[var(--mint-deep)]/90">
                Whether you are just starting to think about college or racing toward
                a submission deadline, we are here to make the process less overwhelming
                and far more successful.
              </p>
            </div>
            <Link
              to="/login"
              className="landing-button-dark mt-8 inline-flex items-center justify-center rounded-full bg-[var(--dark)] px-7 py-4 text-sm font-semibold text-white lg:mt-0"
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const safeguards = [
  {
    title: 'AI disclosure, always',
    description:
      "The AI Advisor tells students at the start of every conversation that they're talking to an AI system, not a person.",
  },
  {
    title: 'Two independent safety layers',
    description:
      'A keyword-based filter checks every message before it ever reaches the AI model. Separately, the AI model itself is instructed to only discuss college-admissions topics and to decline everything else — including if a question is framed as hypothetical, a game, or roleplay. Either layer can stop a message on its own.',
  },
  {
    title: 'A human, not a bot, for anything serious',
    description:
      "If a student asks about something outside admissions — personal issues, mental health, relationships, or anything else — the AI Advisor declines and points them to a school counselor or a trusted adult instead of engaging.",
  },
  {
    title: 'Minimal data, nothing extra',
    description:
      'Only a small set of academic-planning fields (grade level, test scores, GPA, intended major, state) is ever shared with our AI provider for context. Uploaded documents, essays, and file attachments are never sent to the AI. Chat conversations are not stored on our servers.',
  },
]

export default function ChildSafety() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />

      <main className="py-[88px]">
        <section className="mx-auto max-w-[1180px] px-5 md:px-8">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-12">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Child Safety &amp; Responsible AI Use
            </h1>
            <p className="mt-6 max-w-4xl text-lg leading-8 text-[var(--ink-soft)]">
              Most CollegePath students are high schoolers, and many are minors. This page describes,
              in plain language, how our AI Advisor feature is built to be safe for that audience, what
              data it does and doesn't use, and how we approach compliance with children's online
              privacy laws like COPPA.
            </p>
            <p className="mt-4 text-sm text-[var(--ink-faint)]">Last updated August 8, 2026.</p>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">How the AI Advisor is scoped</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {safeguards.map((item) => (
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Our approach to children's privacy</h2>
            <div className="mt-6 space-y-5 text-[var(--ink-soft)]">
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">We collect only what the service needs.</span>{' '}
                A student's profile (academic stats, target schools, application progress) exists to power
                the planning tools they use. We don't sell student data, and we don't use it for advertising.
              </p>
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">Parents and guardians should be involved for younger students.</span>{' '}
                We encourage a parent or guardian to help set up and review an account for any student under 13,
                and to reach out to us with any questions about what information their child's account contains.
              </p>
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">We built the AI Advisor with these principles in mind
                from the start</span>, following Anthropic's (our AI provider's) published guidance for
                organizations serving minors — including content moderation, clear AI disclosure, and
                data minimization, all described above.
              </p>
              <p className="leading-8">
                <span className="font-semibold text-[var(--ink)]">Questions or concerns?</span> Email us at{' '}
                <a href="mailto:privacy@collegepath.io" className="underline hover:text-[var(--ink)]">
                  privacy@collegepath.io
                </a>{' '}
                — including if you're a parent, guardian, or school that wants to know more about how a
                student's account works, or wants an account reviewed or removed.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-[28px] bg-[var(--mint)] px-8 py-10 text-[var(--mint-deep)] sm:px-10 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Want to learn more?</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--mint-deep)]/90">
                Read more about who we are and what we're building on our About page.
              </p>
            </div>
            <Link
              to="/about"
              className="landing-button-dark mt-8 inline-flex items-center justify-center rounded-full bg-[var(--dark)] px-7 py-4 text-sm font-semibold text-white lg:mt-0"
            >
              About CollegePath
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

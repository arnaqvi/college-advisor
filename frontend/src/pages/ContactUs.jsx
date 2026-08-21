import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

const reasons = [
  {
    title: 'General questions',
    description: 'Anything about how CollegePath works, our plans, or getting started.',
  },
  {
    title: 'Account or billing help',
    description: 'Trouble logging in, updating your plan, or a question about a charge.',
  },
  {
    title: 'Feedback & bug reports',
    description: "Something felt off, or you have an idea for what we should build next — we read all of it.",
  },
]

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />

      <main className="py-[88px]">
        <section className="mx-auto max-w-[1180px] px-5 md:px-8">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-12">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Contact Us
            </h1>
            <p className="mt-6 max-w-4xl text-lg leading-8 text-[var(--ink-soft)]">
              Have a question, ran into an issue, or just want to say hello? Email us directly and a
              real person will get back to you.
            </p>
            <a
              href="mailto:admin@collegepath.io"
              className="landing-button-dark mt-8 inline-flex items-center justify-center rounded-full bg-[var(--dark)] px-7 py-4 text-sm font-semibold text-white"
            >
              Email admin@collegepath.io
            </a>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-[1180px] px-5 md:px-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">What can we help with?</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {reasons.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5">
                  <h3 className="font-display text-2xl font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-3 leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </div>
              ))}
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

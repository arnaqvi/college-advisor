import React from 'react'
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Columns, Globe2, GraduationCap, LineChart, MessagesSquare, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Hero from '../components/Hero.jsx'
import BrandMark from '../components/BrandMark.jsx'
import { Reveal, useRevealOnMount } from '../components/Reveal.jsx'

const productCards = [
  {
    icon: GraduationCap,
    title: 'Smart school list building',
    description: 'Create a balanced shortlist with fit signals across academics, cost, geography, and admissions odds.',
  },
  {
    icon: CalendarDays,
    title: 'Every deadline in one runway',
    description: 'Track essays, recommendation requests, campus visits, scholarship windows, and submit dates in a single calendar.',
  },
  {
    icon: Columns,
    title: 'Side-by-side comparison',
    description: 'Compare tuition, campus vibe, majors, aid, and program outcomes before you commit to a final mix.',
  },
  {
    icon: Sparkles,
    title: 'Guided AI support',
    description: 'Get help shaping essays, organizing tasks, and spotting what moves an application forward week by week.',
  },
]

const supportBullets = [
  'Family, student, and counselor views stay aligned without spreadsheet handoffs.',
  'AI nudges keep work moving without replacing real human judgment.',
  'Built around US and Canadian application realities, not generic task lists.',
]

const strategyTiers = [
  {
    label: 'Reach',
    color: 'var(--reach)',
    background: 'var(--reach-bg)',
    heading: 'Ambitious swings you can actually back up.',
    detail: 'Stretch schools that can still make sense with a strong story, standout rigor, and disciplined essay execution.',
  },
  {
    label: 'Target',
    color: 'var(--target)',
    background: 'var(--target-bg)',
    heading: 'Where your odds and your goals finally align.',
    detail: 'Schools where your academics and interests line up well and the application strategy can compound your odds.',
  },
  {
    label: 'Safety',
    color: 'var(--safety)',
    background: 'var(--safety-bg)',
    heading: 'A steady floor for when the cycle gets stressful.',
    detail: 'Reliable options with solid program fit, financial clarity, and momentum when the cycle gets stressful.',
  },
]

const metrics = [
  { value: '23K+', label: 'planning workspaces launched' },
  { value: '120K+', label: 'application milestones tracked' },
  { value: '50+', label: 'states and provinces supported' },
  { value: '87%', label: 'students staying on pace after week four' },
]

// `id` must match backend/frontend/src/data/plans.js's Plan ids exactly —
// that's what Stripe Checkout and registration actually key off. Price/
// student-count copy below is kept in sync with plans.js BY HAND (marketing
// wants its own feature bullets, not the terser copy plans.js uses on the
// real Pricing page) — previously drifted out of sync (this said "$19/mo,
// up to 3 students" while the real Family plan has always been $25/mo for
// up to 4), so if either changes, update both files.
const pricingPlans = [
  {
    id: 'free',
    name: 'Explorer',
    price: 'Free',
    features: ['5 universities tracked', '3 AI questions / month', '2 essays'],
  },
  {
    id: 'individual',
    name: 'Pro Student',
    price: '$9/mo',
    features: ['Unlimited schools and essays', 'Unlimited AI advisor access', 'Full compare tool'],
    featured: true,
  },
  {
    id: 'family',
    name: 'Family Plus',
    price: '$25/mo',
    features: ['Up to 4 students', 'Shared parent dashboard', 'Everything in Pro'],
  },
]

const aboutPoints = [
  {
    icon: Globe2,
    title: 'Built for North America',
    description: 'Designed for the differences between US and Canadian admissions planning, not a one-size-fits-all checklist.',
  },
  {
    icon: ShieldCheck,
    title: 'Clear, calm workflows',
    description: 'Students know what matters now, families stay informed, and counselors spend less time reconciling updates.',
  },
  {
    icon: LineChart,
    title: 'Signal over noise',
    description: 'Every section is meant to reduce uncertainty and make the next best action obvious.',
  },
]

export default function Homepage() {
  useRevealOnMount()

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Navbar />
      <Hero />
      <main>
        <section className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="rounded-[28px] bg-[var(--dark)] px-6 py-[76px] text-white sm:px-10 lg:px-12">
              <div className="grid gap-[60px] lg:grid-cols-[0.98fr_1.02fr] lg:items-center">
                <div>
                  <p className="font-display text-[12.5px] font-bold uppercase tracking-[0.24em] text-[var(--mint)]">
                    AI advisor
                  </p>
                  <h2 className="font-display mt-4 max-w-xl text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[34px]">
                    An admissions expert on call, day or night.
                  </h2>
                  <p className="mt-5 max-w-xl text-[15.5px] leading-8 text-[#c7c9c1]">
                    Ask a question about your list, your essay, or your odds — and get guidance built around your actual profile, not generic advice.
                  </p>

                  <div className="mt-8 space-y-4 text-[15px] leading-7 text-white/82">
                    {[
                      'Personalized to GPA, courses, and activities',
                      'Available 24/7 — no appointment needed',
                      'Grounded in your real college list, not guesses',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <span className="mt-[9px] inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--mint)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/8 bg-[#181A13] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)] sm:p-6">
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[78%] rounded-[18px] rounded-br-[6px] bg-[#2A2D24] px-4 py-3 text-[14px] leading-6 text-white/92">
                        Is Georgia Tech still a reach for me with a 3.8 GPA?
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div className="max-w-[86%] rounded-[18px] rounded-bl-[6px] bg-[var(--mint-tint)] px-4 py-3 text-[14px] leading-6 text-[var(--mint-deep)]">
                        Yes — it's a 16% acceptance rate program, so I'd keep it as a reach even with a strong profile. Your target list already covers that gap well.
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2">
                        <span className="typing-dot h-2 w-2 rounded-full bg-[var(--mint)]" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-[var(--mint)]" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-[var(--mint)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="product" className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--mint-deep)]">
                  Product
                </p>
                <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-5xl">
                  Everything after the shortlist becomes easier when the plan lives in one place.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
                CollegePath combines roadmap planning, comparison, family collaboration, and guided AI support into one application workspace.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {productCards.map((card, index) => {
                const Icon = card.icon

                return (
                  <Reveal
                    key={card.title}
                    delay={`${0.08 * (index + 1)}s`}
                    className="landing-stagger landing-hover rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-7"
                  >
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mint-tint)] text-[var(--mint-deep)]">
                      <Icon size={22} />
                    </div>
                    <h3 className="font-display mt-6 text-[24px] font-extrabold tracking-tight text-[var(--ink)]">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-7 text-[var(--ink-soft)]">{card.description}</p>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        <section className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <div className="rounded-[28px] bg-[var(--dark)] px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12 lg:py-12">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <Reveal as="div">
                    <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--mint)]">
                      Advisor-mode planning
                    </p>
                    <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                      Built for the real handoff between student effort, family oversight, and counselor guidance.
                    </h2>
                  </Reveal>
                  <div className="mt-8 space-y-4 text-[15px] leading-7 text-white/72">
                    {supportBullets.map((item, index) => (
                      <Reveal
                        key={item}
                        delay={`${0.12 * (index + 1)}s`}
                        className="landing-stagger flex items-start gap-3"
                      >
                        <CheckCircle2 size={18} className="mt-1 shrink-0 text-[var(--mint)]" />
                        <span>{item}</span>
                      </Reveal>
                    ))}
                  </div>
                </div>

                <Reveal delay="0.18s" className="landing-grid rounded-[28px] border border-white/10 bg-[var(--dark-2)] p-4 sm:p-6">
                  <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
                    <div className="rounded-2xl bg-white px-5 py-5 text-[var(--ink)]">
                      <div className="flex items-center gap-3 text-sm font-semibold text-[var(--ink-soft)]">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mint-tint)] text-[var(--mint-deep)]">
                          <Bot size={18} />
                        </span>
                        AI planning assistant
                      </div>
                      <div className="mt-6 rounded-2xl bg-[var(--mint-tint)] p-4 text-[15px] leading-7 text-[var(--mint-deep)]">
                        Your Early Action essays are 70% done. Shift this week toward counselor rec requests and scholarship deadlines.
                      </div>
                      <div className="mt-4 rounded-2xl border border-[var(--border)] p-4 text-[15px] leading-7 text-[var(--ink-soft)]">
                        Suggested next move: compare your top three target schools against program outcomes before finalizing ED.
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-white/6 p-5">
                        <div className="flex items-center gap-3 text-sm font-semibold text-white/78">
                          <MessagesSquare size={18} className="text-[var(--mint)]" />
                          Shared activity feed
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-white/70">
                          <div className="rounded-2xl bg-white/6 p-4">Parent approved campus visits for two Ontario schools.</div>
                          <div className="rounded-2xl bg-white/6 p-4">Counselor flagged one essay prompt that overlaps your Common App draft.</div>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[var(--mint)] px-5 py-5 text-[var(--mint-deep)]">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>Weekly readiness</span>
                          <Target size={18} />
                        </div>
                        <p className="font-display mt-4 text-4xl font-extrabold">87%</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--mint-deep)]/80">
                          Strong pace across essays, shortlist balance, and deadline prep.
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        <section className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="grid gap-8 lg:grid-cols-[0.76fr_1.24fr] lg:items-end">
              <div>
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--ink-faint)]">
                  Strategy engine
                </p>
                <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-5xl">
                  Reach, target, and safety decisions become easier when each tier has context.
                </h2>
              </div>
              <p className="text-lg leading-8 text-[var(--ink-soft)]">
                Instead of generic labels, each school sits inside a planning framework that balances ambition, affordability, and timeline pressure.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {strategyTiers.map((tier, index) => (
                <Reveal
                  key={tier.label}
                  delay={`${0.1 * (index + 1)}s`}
                  className="landing-stagger landing-hover rounded-2xl border border-[var(--border)] p-7"
                  style={{ '--reveal-delay': `${0.1 * (index + 1)}s`, background: tier.background }}
                >
                  <div className="inline-flex rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.72)', color: tier.color }}>
                    {tier.label}
                  </div>
                  <h3 className="font-display mt-6 text-[28px] font-extrabold tracking-tight text-[var(--ink)]">
                    {tier.heading}
                  </h3>
                  <p className="mt-4 text-[15px] leading-7 text-[var(--ink-soft)]">{tier.detail}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-[88px]">
          <div className="mx-auto grid gap-6 px-5 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="landing-hover rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--mint-deep)]">
                Execution
              </p>
              <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-[44px]">
                Move from planning to action without losing momentum.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  'Personalized monthly roadmap',
                  'Essay status across every application',
                  'Aid and scholarship tracking',
                  'One source of truth for everyone involved',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay="0.14s" className="landing-hover rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--ink-faint)]">
                    Comparison workspace
                  </p>
                  <h3 className="font-display mt-3 text-[32px] font-extrabold tracking-tight text-[var(--ink)]">
                    Decide with side-by-side clarity.
                  </h3>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mint-tint)] text-[var(--mint-deep)]">
                  <Columns size={20} />
                </span>
              </div>
              <div className="mt-8 space-y-4">
                {[
                  ['Program fit', 'Engineering vs business outcomes'],
                  ['Net cost', 'Scholarships, aid, and total annual spend'],
                  ['Campus feel', 'Urban access, size, and student energy'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl bg-[var(--bg)] px-4 py-4"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink-faint)]">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{value}</p>
                    </div>
                    <ArrowRight size={18} className="text-[var(--mint-deep)]" />
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="rounded-[28px] bg-[var(--dark)] px-6 py-10 text-white sm:px-10 lg:px-12">
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="border-t border-white/10 pt-6 first:border-t-0 first:pt-0 md:first:border-t md:first:pt-6 xl:border-t-0 xl:pt-0 xl:first:border-t-0 xl:first:pt-0"
                  >
                    <p className="font-display text-5xl font-extrabold tracking-tight text-white">{metric.value}</p>
                    <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/62">{metric.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="text-center">
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--mint-deep)]">
                Pricing
              </p>
              <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-5xl">
                A plan for every family.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
                Private counselors average $6,500. CollegePath starts free.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-[22px] lg:grid-cols-3">
              {pricingPlans.map((plan, index) => (
                <Reveal
                  key={plan.name}
                  delay={`${0.08 * (index + 1)}s`}
                  className={`landing-stagger landing-hover relative rounded-2xl p-8 ${
                    plan.featured
                      ? 'border-2 border-[var(--mint-deep)] bg-[var(--mint-tint)] pt-12'
                      : 'border border-[var(--border)] bg-[var(--bg-card)]'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--mint-deep)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_12px_30px_rgba(15,59,51,0.22)]">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-[28px] font-extrabold tracking-tight text-[var(--ink)]">{plan.name}</h3>
                    </div>
                  </div>
                  <div className="mt-8 flex items-end gap-2">
                    <span className="font-display text-5xl font-extrabold tracking-tight text-[var(--ink)]">{plan.price}</span>
                  </div>
                  <div className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 rounded-2xl bg-white/60 px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
                        <CheckCircle2 size={18} className="mt-1 shrink-0 text-[var(--mint-deep)]" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    to={`/register/student?plan=${plan.id}`}
                    className={`mt-8 block w-full rounded-full px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-95 ${
                      plan.featured
                        ? 'bg-[var(--mint-deep)] text-white hover:bg-[var(--mint-deep)]/90'
                        : 'border border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--mint-deep)]'
                    }`}
                  >
                    {plan.id === 'free' ? 'Get Started Free' : `Choose ${plan.name}`}
                  </Link>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-[var(--ink-faint)]">
              No payment required to sign up — pick a plan now or change it anytime from Pricing.
            </p>
          </div>
        </section>

        <section id="about" className="py-[88px]">
          <div className="mx-auto px-5 md:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <Reveal as="div">
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--ink-faint)]">
                  About CollegePath
                </p>
                <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--ink)] sm:text-5xl">
                  A planning platform built to make admissions feel structured instead of chaotic.
                </h2>
              </Reveal>
              <div className="grid gap-6 md:grid-cols-3">
                {aboutPoints.map((point, index) => {
                  const Icon = point.icon

                  return (
                    <Reveal
                      key={point.title}
                      delay={`${0.09 * (index + 1)}s`}
                      className="landing-stagger landing-hover rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-7"
                    >
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mint-tint)] text-[var(--mint-deep)]">
                        <Icon size={22} />
                      </div>
                      <h3 className="font-display mt-6 text-[24px] font-extrabold tracking-tight text-[var(--ink)]">
                        {point.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-7 text-[var(--ink-soft)]">{point.description}</p>
                    </Reveal>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-[88px] pt-0">
          <div className="mx-auto px-5 md:px-8">
            <Reveal className="rounded-[28px] bg-[var(--mint)] px-6 py-10 text-[var(--mint-deep)] sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-12">
              <div className="max-w-2xl">
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--mint-deep)]/72">
                  Ready to start?
                </p>
                <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-[var(--mint-deep)] sm:text-5xl">
                  Build a calmer, smarter admissions plan before deadlines start to pile up.
                </h2>
              </div>
              <div className="mt-8 lg:mt-0">
                <Link
                  to="/login"
                  className="landing-button-dark inline-flex items-center justify-center rounded-full bg-[var(--dark)] px-7 py-4 text-sm font-semibold text-white"
                >
                  Get Started
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-10">
        <Reveal
          as="div"
          className="mx-auto flex flex-col gap-4 px-5 text-sm text-[var(--ink-faint)] md:flex-row md:items-center md:justify-between md:px-8"
        >
          <div className="flex items-center gap-3 text-[var(--ink)]">
            <BrandMark size={28} />
            <span className="font-display text-base font-extrabold">
              College<span className="text-accent-contrast">Path</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#product" className="transition-colors duration-300 hover:text-[var(--ink)]">
              Product
            </a>
            <a href="#pricing" className="transition-colors duration-300 hover:text-[var(--ink)]">
              Pricing
            </a>
            <Link to="/about" className="transition-colors duration-300 hover:text-[var(--ink)]">
              About
            </Link>
            <Link to="/child-safety" className="transition-colors duration-300 hover:text-[var(--ink)]">
              Child Safety &amp; AI Use
            </Link>
          </div>
        </Reveal>
      </footer>
    </div>
  )
}

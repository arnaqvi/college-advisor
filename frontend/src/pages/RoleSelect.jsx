import { Link } from 'react-router-dom'
import { GraduationCap, Users, Briefcase } from 'lucide-react'
import { trackEvent } from '../lib/trackEvent.js'

const ROLES = [
  {
    id: 'student',
    label: 'Student',
    icon: GraduationCap,
    body: 'Plan for college, manage applications, and stay on track with your goals.',
    cta: 'Continue as Student',
  },
  {
    id: 'parent',
    label: 'Parent',
    icon: Users,
    body: "Follow your student's progress, deadlines, and college planning journey.",
    cta: 'Continue as Parent',
  },
  {
    id: 'counselor',
    label: 'Counselor',
    icon: Briefcase,
    body: 'Manage students, track progress, and provide personalized guidance.',
    cta: 'Continue as Counselor',
  },
]

function handleRoleClick(role) {
  trackEvent({ component: 'role_select', eventType: 'click', metadata: { role } })
}

export default function RoleSelect() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-[var(--bg)] px-6 py-16">
      <div className="text-center">
        <h1 className="font-display text-[42px] font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)]">Welcome Back</h1>
        <p className="mt-4 text-[15px] leading-6 text-[var(--text-secondary)] max-w-md">Choose how you would like to access your account.</p>
      </div>

      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {ROLES.map(({ id, label, icon: Icon, body, cta }) => (
          <Link
            key={id}
            to={`/login/${id}`}
            onClick={() => handleRoleClick(id)}
            className="group flex flex-col items-start rounded-[20px] border border-[var(--border)] bg-[var(--surface-raised)] p-8 transition-all duration-300 hover:border-[var(--accent)] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(16,18,16,0.08)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--mint-tint)] text-[var(--mint-deep)] transition-transform duration-300 group-hover:scale-110">
              <Icon size={28} />
            </div>
            <h2 className="font-display mt-5 text-[20px] font-extrabold text-[var(--text-primary)]">{label}</h2>
            <p className="mt-3 text-[14px] leading-6 text-[var(--text-secondary)]">{body}</p>
            <span className="mt-8 w-full rounded-[12px] bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-contrast transition-all duration-200 group-hover:bg-accent/90 active:scale-95">
              {cta}
            </span>
          </Link>
        ))}
      </div>

      <Link to="/" className="text-sm text-slate-500 hover:underline">
        Back to homepage
      </Link>
    </div>
  )
}

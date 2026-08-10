import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Gem,
  Award,
  CalendarClock,
  Target,
  User,
  LogOut,
  FileText,
  Columns,
  ShieldAlert,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Menu,
  X,
  Lock,
  Sparkles,
} from 'lucide-react'
import ExportButton from './ExportButton.jsx'
import BrandMark from './BrandMark.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useAppContext } from '../context/AppContext.jsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/colleges', label: 'Colleges', icon: Building2 },
  { to: '/programs', label: 'Programs', icon: GraduationCap, premium: true },
  { to: '/hidden-gems', label: 'Hidden Gems', icon: Gem, premium: true },
  { to: '/scholarships', label: 'Scholarships', icon: Award, premium: true },
  { to: '/timeline', label: 'Timeline', icon: CalendarClock, premium: true },
  { to: '/strategy', label: 'Strategy', icon: Target, premium: true },
  { to: '/essays', label: 'Essays', icon: FileText, premium: true },
  { to: '/compare', label: 'Compare', icon: Columns, premium: true },
  { to: '/bias-check', label: 'Bias Check', icon: ShieldAlert, premium: true },
  { to: '/gap-analysis', label: 'Gap Analysis', icon: ClipboardCheck, premium: true },
  { to: '/profile', label: 'Profile', icon: User },
]

// Guided first-run (see ONBOARDING_NEW_USERS_BRIEF.md option 2): a brand-new
// visitor with no GPA/test scores saved yet gets routed to Profile instead of
// landing on an empty Dashboard/Colleges/etc. Mirrors classification.js's own
// "Incomplete" signal so the redirect clears the moment either a real save or
// the sample-profile shortcut gives the student stats. Read-only roles
// (parent/counselor) can't fill the form themselves, so they're left alone.
function hasProfileStats(profile) {
  return Boolean(profile.gpaUnweighted || profile.satTotal || profile.actComposite)
}

// Not a personalized tool — don't force a plan/pricing lookup through Profile first.
const FIRST_RUN_EXEMPT_PATHS = new Set(['/profile', '/pricing'])

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { collegesLoading, collegesError, retryFetchColleges, studentProfile, profileLoading } = useAppContext()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isPaid = user?.tier === 'paid'
  const profileIncomplete = !hasProfileStats(studentProfile)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handlePremiumClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setMobileNavOpen(false)
    navigate('/pricing')
  }

  const isReadOnlyRole = user?.role === 'parent' || user?.role === 'counselor'
  // While a logged-in user's saved profile is still being fetched from the
  // backend, `studentProfile` is momentarily EMPTY_PROFILE — don't bounce a
  // returning user to /profile just because the real data hasn't arrived yet.
  if (
    !isReadOnlyRole &&
    !profileLoading &&
    !FIRST_RUN_EXEMPT_PATHS.has(location.pathname) &&
    !hasProfileStats(studentProfile)
  ) {
    return <Navigate to="/profile" replace />
  }

  return (
    <div className="flex min-h-screen bg-surface text-text-primary">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : ''
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileNavOpen(false)}>
            <BrandMark size={28} />
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-text-primary">
                College<span className="text-accent-contrast">Path</span>
              </h1>
              <p className="text-xs text-text-secondary">Your Personalized Roadmap</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="text-text-secondary md:hidden"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, premium }) => {
            const locked = premium && !isPaid
            const isProfileTab = to === '/profile'
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={locked ? handlePremiumClick : () => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/20 text-accent-contrast'
                      : isProfileTab && profileIncomplete
                        ? 'bg-accent/10 text-text-primary ring-1 ring-accent/40 hover:bg-accent/15'
                        : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  }`
                }
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {isProfileTab && profileIncomplete && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-contrast">
                    <Sparkles size={10} />
                    Complete
                  </span>
                )}
                {locked && (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={handlePremiumClick}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      handlePremiumClick(e)
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-target/30 bg-target-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-target hover:bg-target/20"
                  >
                    <Lock size={10} />
                    Upgrade
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        {user && (
          <div className="mt-auto border-t border-border px-5 py-4">
            <p className="truncate text-xs font-medium text-text-primary">{user.name || user.email}</p>
            <p className="text-xs capitalize text-text-secondary">
              {user.role} · {isPaid ? 'Paid' : 'Free'}
            </p>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-base font-extrabold tracking-tight text-text-primary">
              College<span className="text-accent-contrast">Path</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="text-text-secondary"
          >
            <Menu size={22} />
          </button>
        </header>
        {user && (
          <header className="sticky top-0 z-40 hidden items-center justify-end gap-4 border-b border-border bg-surface px-8 py-3 md:flex">
            <span className="text-sm text-text-secondary">
              Logged in as <span className="font-medium text-text-primary">{user.name || user.email}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-raised"
            >
              <LogOut size={13} />
              Log out
            </button>
          </header>
        )}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-8">
          <ExportButton />
        {collegesLoading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-text-secondary">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Loading your college directory…</p>
          </div>
        ) : (
          <>
            {/* Non-blocking banner, not a full-page replacement — see incident
                2026-07-28: /api/colleges failing (backend connectivity issue,
                not a frontend bug) used to hard-block every single app-shell
                page including /profile, which is a worse regression than the
                original app's own tolerance for API failures (the nginx
                config's own comment says "/api 502s gracefully" was always
                an accepted, expected state — /api/events failing silently
                predates this feature entirely). Every page below already
                handles an empty `colleges` array gracefully (shows
                "Incomplete"/0 results rather than crashing), so degrade to
                that instead of blocking navigation entirely. */}
            {collegesError && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-reach/30 bg-reach-bg px-4 py-3 text-sm text-reach">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>
                    Couldn't load the college directory ({collegesError}). Classifications and college
                    lists below may be empty or incomplete until this is resolved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryFetchColleges}
                  className="shrink-0 rounded-full border border-reach/40 px-3 py-1 text-xs font-semibold hover:bg-reach/10"
                >
                  Retry
                </button>
              </div>
            )}
            <Outlet />
          </>
        )}
        </main>
      </div>
    </div>
  )
}

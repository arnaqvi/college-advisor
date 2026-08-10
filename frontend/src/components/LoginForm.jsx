import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Chrome } from 'lucide-react'
import AuthLayout from './AuthLayout.jsx'
import AuthFormHeader from './AuthFormHeader.jsx'
import PasswordField from './PasswordField.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchAuthConfig, googleLoginUrl } from '../lib/api/auth.js'
import { trackEvent } from '../lib/trackEvent.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Shared login form + card layout for the three role-specific login pages
 * (Student, Parent, Counselor). Role-specific copy, icon, redirect target,
 * and the "create an account" / "request access" link are passed as props.
 */
export default function LoginForm({
  role,
  roleLabel,
  title,
  subtitle,
  icon,
  panelTitle,
  panelBody,
  dashboardPath,
  secondary,
}) {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    fetchAuthConfig().then((config) => setGoogleEnabled(config.google_enabled))
  }, [])

  function validate() {
    const next = {}
    if (!email.trim()) next.email = 'Email address is required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      trackEvent({ component: `${role}_login`, eventType: 'submit', metadata: { role } })
      navigate(dashboardPath, { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout icon={icon} panelTitle={panelTitle} panelBody={panelBody}>
      <AuthFormHeader icon={icon} title={title} subtitle={subtitle} />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">Email Address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            autoComplete="email"
            className="mt-2 w-full rounded-[12px] border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {errors.email && <span className="mt-2 block text-xs text-red-600 font-medium">{errors.email}</span>}
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password}
        />

        {submitError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-end">
          <Link to={`/forgot-password?role=${role}`} className="text-sm font-semibold text-text-primary hover:text-accent transition-colors duration-200">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[12px] bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : `Log In as ${roleLabel}`}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {googleEnabled ? (
        <a
          href={googleLoginUrl(role, 'free')}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-raised px-4 py-3 text-sm font-semibold text-text-secondary transition-all duration-200 hover:bg-surface hover:border-text-secondary/30"
        >
          <Chrome size={18} />
          Continue with Google
        </a>
      ) : (
        <div>
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-raised px-4 py-3 text-sm font-semibold text-text-secondary/50"
          >
            <Chrome size={18} />
            Continue with Google
          </button>
          <p className="mt-2 text-center text-xs text-text-secondary">Google sign-in is coming soon.</p>
        </div>
      )}

      {secondary && (
        <p className="mt-8 text-center text-sm text-text-secondary">
          {secondary.question}{' '}
          <Link to={secondary.to} className="font-semibold text-text-primary hover:text-accent transition-colors duration-200">
            {secondary.linkText}
          </Link>
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-text-secondary hover:text-text-primary transition-colors duration-200 font-medium">
          Back to role selection
        </Link>
      </p>
    </AuthLayout>
  )
}

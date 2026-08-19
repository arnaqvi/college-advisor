import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Users } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import TextField from '../components/TextField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { trackEvent } from '../lib/trackEvent.js'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchAuthConfig, googleLoginUrl } from '../lib/api/auth.js'
import { createCheckoutSession } from '../lib/api/billing.js'
import { PLANS } from '../data/plans.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  studentLink: '',
  plan: 'free',
}

export default function ParentRegister() {
  const [searchParams] = useSearchParams()
  // Same ?plan= pre-selection as StudentRegister.jsx — see that file for why.
  const [form, setForm] = useState(() => {
    const requestedPlan = searchParams.get('plan')
    const plan = PLANS.some((p) => p.id === requestedPlan) ? requestedPlan : EMPTY_FORM.plan
    return { ...EMPTY_FORM, plan }
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchAuthConfig().then((config) => setGoogleEnabled(config.google_enabled))
  }, [])

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function validate() {
    const next = {}
    if (!form.firstName.trim()) next.firstName = 'First name is required.'
    if (!form.lastName.trim()) next.lastName = 'Last name is required.'
    if (!form.email.trim()) next.email = 'Email address is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    else if (form.password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (!form.confirmPassword) next.confirmPassword = 'Please confirm your password.'
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.'
    if (!form.studentLink.trim()) next.studentLink = 'Enter a student invitation code or your student’s email.'
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
      await register({
        email: form.email.trim(),
        password: form.password,
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        role: 'parent',
        plan: form.plan,
      })
      trackEvent({ component: 'parent_register', eventType: 'submit', metadata: { plan: form.plan } })
      setSubmitted(true)

      // The account is always created on `free` (see backend/app/routers/
      // auth.py's register()) — a paid plan selection here only takes
      // effect after real Stripe payment, so send the browser straight to
      // checkout instead of the dashboard. If checkout can't be started,
      // the account still exists as free — stay on the "account created"
      // screen (below) rather than losing the user mid-flow.
      if (form.plan !== 'free') {
        try {
          const { checkout_url: checkoutUrl } = await createCheckoutSession(form.plan)
          window.location.href = checkoutUrl
        } catch (err) {
          setCheckoutError(err.message || 'Could not start checkout — you can upgrade anytime from Pricing.')
        }
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not create your account — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      icon={Users}
      panelTitle="Follow the journey together"
      panelBody="Create an account to stay connected to your student's college planning progress."
      maxWidthClassName="max-w-6xl"
    >
      {submitted ? (
        <div className="space-y-6">
          <AuthFormHeader icon={Users} title="Account Created" subtitle="Your parent account is ready." />
          <p className="rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary">
            Welcome, {form.firstName}! You're signed in and ready to follow along.
          </p>
          {checkoutError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {checkoutError}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('/parent-dashboard')}
            className="block w-full rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-contrast hover:bg-accent/90"
          >
            Go to My Dashboard
          </button>
        </div>
      ) : (
        <>
          <AuthFormHeader
            icon={Users}
            title="Create a Parent Account"
            subtitle="Set up your account to follow your student's college planning journey."
          />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First Name"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="Enter your first name"
                autoComplete="given-name"
                error={errors.firstName}
              />
              <TextField
                label="Last Name"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Enter your last name"
                autoComplete="family-name"
                error={errors.lastName}
              />
            </div>

            <TextField
              type="email"
              label="Email Address"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              error={errors.email}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                label="Password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Create a password"
                autoComplete="new-password"
                error={errors.password}
              />
              <PasswordField
                label="Confirm Password"
                value={form.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                error={errors.confirmPassword}
              />
            </div>

            <TextField
              label="Student Invitation Code or Student Email"
              value={form.studentLink}
              onChange={(e) => handleChange('studentLink', e.target.value)}
              placeholder="Enter invitation code or your student's email"
              error={errors.studentLink}
            />

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Choose your plan</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {PLANS.map((plan) => {
                  const selected = form.plan === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleChange('plan', plan.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selected ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border hover:border-text-secondary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text-primary">{plan.title}</span>
                        {selected && <Check size={16} className="text-accent" />}
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{plan.price}</p>
                      <p className="mt-1 text-xs text-text-secondary">{plan.desc}</p>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-text-secondary/70">
                {form.plan === 'free'
                  ? 'No payment required — you can upgrade anytime from Pricing.'
                  : "You'll be taken to secure checkout after creating your account."}
              </p>
            </div>

            {submitError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <a
                href={googleLoginUrl('parent', form.plan)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-raised"
              >
                Continue with Google
              </a>
            </>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login/parent" className="font-medium text-ink hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

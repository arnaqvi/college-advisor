import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, GraduationCap } from 'lucide-react'
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
const CURRENT_YEAR = new Date().getFullYear()

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  gradYear: '',
  schoolName: '',
  plan: 'free',
}

export default function StudentRegister() {
  const [searchParams] = useSearchParams()
  // Homepage's pricing section links here as e.g. /register/student?plan=individual
  // (see pricingPlans in pages/Homepage.jsx) — honor it if it's a real plan id,
  // otherwise fall back to the normal free default rather than trusting an
  // arbitrary query value.
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
    if (!form.gradYear) next.gradYear = 'Expected graduation year is required.'
    else if (!/^\d{4}$/.test(String(form.gradYear))) next.gradYear = 'Enter a 4-digit year.'
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
        role: 'student',
        plan: form.plan,
      })
      trackEvent({ component: 'student_register', eventType: 'submit', metadata: { gradYear: form.gradYear, plan: form.plan } })
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
      icon={GraduationCap}
      panelTitle="Start your college journey"
      panelBody="Create an account to track colleges, deadlines, and scholarships built around your goals."
      maxWidthClassName="max-w-6xl"
    >
      {submitted ? (
        <div className="space-y-6">
          <AuthFormHeader icon={GraduationCap} title="Account Created" subtitle="Your student account is ready." />
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Welcome, {form.firstName}! You're signed in and ready to start planning.
          </p>
          {checkoutError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {checkoutError}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('/student-dashboard')}
            className="block w-full rounded-md bg-indigo-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Go to My Dashboard
          </button>
        </div>
      ) : (
        <>
          <AuthFormHeader
            icon={GraduationCap}
            title="Create a Student Account"
            subtitle="Set up your account to start planning your college journey."
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

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                type="number"
                label="Expected High School Graduation Year"
                value={form.gradYear}
                onChange={(e) => handleChange('gradYear', e.target.value)}
                placeholder={String(CURRENT_YEAR + 1)}
                error={errors.gradYear}
              />
              <TextField
                label="School Name (optional)"
                value={form.schoolName}
                onChange={(e) => handleChange('schoolName', e.target.value)}
                placeholder="Enter your school name"
                autoComplete="organization"
              />
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Choose your plan</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {PLANS.map((plan) => {
                  const selected = form.plan === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleChange('plan', plan.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{plan.title}</span>
                        {selected && <Check size={16} className="text-indigo-600" />}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{plan.price}</p>
                      <p className="mt-1 text-xs text-slate-500">{plan.desc}</p>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">
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
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <a
                href={googleLoginUrl('student', form.plan)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Continue with Google
              </a>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login/student" className="font-medium text-indigo-600 hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

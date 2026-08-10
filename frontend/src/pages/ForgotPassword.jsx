import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import { requestPasswordReset } from '../lib/api/auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = new Set(['student', 'parent', 'counselor'])

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role')
  const backToLoginPath = VALID_ROLES.has(role) ? `/login/${role}` : '/login'

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email address is required.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      // Backend always returns the same generic {ok: true} whether or not
      // the account exists — intentionally does not reveal which case it was.
      await requestPasswordReset(email.trim())
      setSubmitted(true)
    } catch {
      setError('Something went wrong sending the reset link. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      icon={KeyRound}
      panelTitle="Forgot your password?"
      panelBody="No problem — enter your email and we'll send you instructions to reset it."
    >
      <AuthFormHeader
        icon={KeyRound}
        title="Reset Your Password"
        subtitle="Enter the email address associated with your account."
      />

      {submitted ? (
        <div className="space-y-6">
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            If an account is connected to this email, password reset instructions will be sent shortly.
          </p>
          <Link
            to={backToLoginPath}
            className="block w-full rounded-md bg-indigo-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <label>
            <span className="text-xs font-medium text-slate-500">Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
            {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send Reset Link'}
          </button>

          <Link to={backToLoginPath} className="block text-center text-sm text-slate-500 hover:underline">
            Back to Login
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { resetPassword } from '../lib/api/auth.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const next = {}
    if (!password) next.password = 'Password is required.'
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.'
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.'
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
      await resetPassword(token, password)
      // resetPassword() signs the user in server-side (sets the session
      // cookie) — refresh AuthContext's cached user before navigating.
      await refresh()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'This reset link is invalid or has expired. Request a new one.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout
        icon={KeyRound}
        panelTitle="Reset your password"
        panelBody="Enter a new password to regain access to your account."
      >
        <AuthFormHeader icon={KeyRound} title="Invalid Reset Link" subtitle="This link is missing its reset token." />
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This reset link isn't valid. Request a new one from the forgot password page.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 block w-full rounded-md bg-indigo-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Request a New Link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      icon={KeyRound}
      panelTitle="Reset your password"
      panelBody="Enter a new password to regain access to your account."
    >
      <AuthFormHeader icon={KeyRound} title="Choose a New Password" subtitle="Enter and confirm your new password." />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a new password"
          autoComplete="new-password"
          error={errors.password}
        />
        <PasswordField
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

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
          {submitting ? 'Resetting…' : 'Reset Password'}
        </button>

        <Link to="/login" className="block text-center text-sm text-slate-500 hover:underline">
          Back to Login
        </Link>
      </form>
    </AuthLayout>
  )
}

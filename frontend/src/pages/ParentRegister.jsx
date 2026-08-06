import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import TextField from '../components/TextField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { trackEvent } from '../lib/trackEvent.js'
import { useAuth } from '../context/AuthContext.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  studentLink: '',
}

export default function ParentRegister() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

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

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    trackEvent({ component: 'parent_register', eventType: 'submit', metadata: {} })
    // Establish a real session immediately — see StudentRegister.jsx for why.
    login({
      email: form.email.trim(),
      role: 'parent',
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      remember: false,
    })
    setSubmitted(true)
  }

  return (
    <AuthLayout
      icon={Users}
      panelTitle="Follow the journey together"
      panelBody="Create an account to stay connected to your student's college planning progress."
    >
      {submitted ? (
        <div className="space-y-6">
          <AuthFormHeader icon={Users} title="Account Created" subtitle="Your parent account is ready." />
          <p className="rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary">
            Welcome, {form.firstName}! You're signed in and ready to follow along.
          </p>
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

            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
            >
              Create Account
            </button>
          </form>

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

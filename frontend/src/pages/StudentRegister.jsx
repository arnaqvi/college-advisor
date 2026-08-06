import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import TextField from '../components/TextField.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { trackEvent } from '../lib/trackEvent.js'
import { useAuth } from '../context/AuthContext.jsx'

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
}

export default function StudentRegister() {
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
    if (!form.gradYear) next.gradYear = 'Expected graduation year is required.'
    else if (!/^\d{4}$/.test(String(form.gradYear))) next.gradYear = 'Enter a 4-digit year.'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    trackEvent({ component: 'student_register', eventType: 'submit', metadata: { gradYear: form.gradYear } })
    // Establish a real session immediately — mirrors LoginForm.jsx's login()
    // call. Without this, "creating an account" left the visitor in the same
    // unauthenticated/guest state they started in, which made it look like a
    // brand-new signup was inheriting a previous user's saved profile: it
    // wasn't a different account at all, since no session had ever changed.
    login({
      email: form.email.trim(),
      role: 'student',
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      remember: false,
    })
    setSubmitted(true)
  }

  return (
    <AuthLayout
      icon={GraduationCap}
      panelTitle="Start your college journey"
      panelBody="Create an account to track colleges, deadlines, and scholarships built around your goals."
    >
      {submitted ? (
        <div className="space-y-6">
          <AuthFormHeader icon={GraduationCap} title="Account Created" subtitle="Your student account is ready." />
          <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Welcome, {form.firstName}! You're signed in and ready to start planning.
          </p>
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

            <button
              type="submit"
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              Create Account
            </button>
          </form>

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

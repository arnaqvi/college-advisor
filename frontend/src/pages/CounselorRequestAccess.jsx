import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import AuthFormHeader from '../components/AuthFormHeader.jsx'
import TextField from '../components/TextField.jsx'
import { trackEvent } from '../lib/trackEvent.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  organization: '',
  jobTitle: '',
  studentsServed: '',
  message: '',
}

// Counselors do not have public self-registration — this submits a request
// for the EvolveML/College Advisor team to review and provision an account.
export default function CounselorRequestAccess() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function validate() {
    const next = {}
    if (!form.firstName.trim()) next.firstName = 'First name is required.'
    if (!form.lastName.trim()) next.lastName = 'Last name is required.'
    if (!form.email.trim()) next.email = 'Professional email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.organization.trim()) next.organization = 'School or organization is required.'
    if (!form.jobTitle.trim()) next.jobTitle = 'Job title is required.'
    if (!form.message.trim()) next.message = 'Please describe your request.'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    trackEvent({ component: 'counselor_request_access', eventType: 'submit', metadata: {} })
    setSubmitted(true)
  }

  return (
    <AuthLayout
      icon={Briefcase}
      panelTitle="Guide students at scale"
      panelBody="Request counselor access to manage your caseload and provide personalized guidance."
    >
      {submitted ? (
        <div className="space-y-6">
          <AuthFormHeader icon={Briefcase} title="Request Submitted" subtitle="Thanks for reaching out." />
          <p className="rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary">
            Thanks, {form.firstName} — your request has been submitted. Our team will review it and follow up by
            email at {form.email}.
          </p>
          <Link
            to="/login/counselor"
            className="block w-full rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-contrast hover:bg-accent/90"
          >
            Back to Counselor Login
          </Link>
        </div>
      ) : (
        <>
          <AuthFormHeader
            icon={Briefcase}
            title="Request Counselor Access"
            subtitle="Tell us about yourself and we'll set up your counselor account."
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
              label="Professional Email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Enter your professional email address"
              autoComplete="email"
              error={errors.email}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="School or Organization"
                value={form.organization}
                onChange={(e) => handleChange('organization', e.target.value)}
                placeholder="Enter your school or organization"
                autoComplete="organization"
                error={errors.organization}
              />
              <TextField
                label="Job Title"
                value={form.jobTitle}
                onChange={(e) => handleChange('jobTitle', e.target.value)}
                placeholder="e.g. School Counselor"
                autoComplete="organization-title"
                error={errors.jobTitle}
              />
            </div>

            <TextField
              type="number"
              label="Number of Students Served (optional)"
              value={form.studentsServed}
              onChange={(e) => handleChange('studentsServed', e.target.value)}
              placeholder="e.g. 150"
              min="0"
            />

            <TextField
              multiline
              label="Tell us about your request"
              value={form.message}
              onChange={(e) => handleChange('message', e.target.value)}
              placeholder="Share a bit about your role and why you're requesting access"
              error={errors.message}
            />

            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent/90"
            >
              Submit Access Request
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have access?{' '}
            <Link to="/login/counselor" className="font-medium text-ink hover:underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

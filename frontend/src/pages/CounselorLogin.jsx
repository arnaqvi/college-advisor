import { Briefcase } from 'lucide-react'
import LoginForm from '../components/LoginForm.jsx'

export default function CounselorLogin() {
  return (
    <LoginForm
      role="counselor"
      roleLabel="Counselor"
      title="Counselor Login"
      subtitle="Manage students, track progress, and provide personalized guidance."
      icon={Briefcase}
      panelTitle="Guide every student's journey"
      panelBody="Manage your caseload, track student progress, and provide personalized guidance from one dashboard."
      dashboardPath="/counselor-dashboard"
      secondary={{
        question: 'Need access to the platform?',
        linkText: 'Request access',
        to: '/request-access',
      }}
    />
  )
}

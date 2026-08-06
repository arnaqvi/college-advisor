import { GraduationCap } from 'lucide-react'
import LoginForm from '../components/LoginForm.jsx'

export default function StudentLogin() {
  return (
    <LoginForm
      role="student"
      roleLabel="Student"
      title="Student Login"
      subtitle="Access your college planning dashboard and continue working toward your goals."
      icon={GraduationCap}
      panelTitle="Plan your path to college"
      panelBody="Track applications, deadlines, and scholarships — all in one place built around your goals."
      dashboardPath="/student-dashboard"
      secondary={{
        question: "Don't have a student account?",
        linkText: 'Create an account',
        to: '/register/student',
      }}
    />
  )
}

import { Users } from 'lucide-react'
import LoginForm from '../components/LoginForm.jsx'

export default function ParentLogin() {
  return (
    <LoginForm
      role="parent"
      roleLabel="Parent"
      title="Parent Login"
      subtitle="Follow your student's progress, deadlines, and college planning journey."
      icon={Users}
      panelTitle="Stay close to the process"
      panelBody="See deadlines, application status, and scholarship opportunities as your student works toward college."
      dashboardPath="/parent-dashboard"
      secondary={{
        question: "Don't have a parent account?",
        linkText: 'Create an account',
        to: '/register/parent',
      }}
    />
  )
}

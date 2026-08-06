import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Route guard — renders nested routes (via <Outlet/>) only when the current
 * session's role matches `allowedRole`. Unauthenticated users are sent to
 * role selection; authenticated users with the wrong role are sent back to
 * their own login page rather than the page they tried to access.
 */
export default function ProtectedRoute({ allowedRole }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role !== allowedRole) {
    return <Navigate to={`/login/${user.role}`} replace />
  }

  return <Outlet />
}

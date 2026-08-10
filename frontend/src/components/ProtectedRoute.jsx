import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Route guard — renders nested routes (via <Outlet/>) only for a logged-in
 * session. With no `allowedRole` prop, any authenticated role passes (used to
 * gate the shared app shell now that real accounts exist). With `allowedRole`
 * set, the session's role must match too — unauthenticated users are sent to
 * role selection; authenticated users with the wrong role are sent back to
 * their own login page rather than the page they tried to access.
 */
export default function ProtectedRoute({ allowedRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // AuthContext's own GET /api/auth/me check is still in flight — wait
  // rather than redirecting a returning, already-logged-in user to /login
  // just because the session hasn't resolved yet.
  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={`/login/${user.role}`} replace />
  }

  return <Outlet />
}

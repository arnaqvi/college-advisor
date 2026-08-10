import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Route guard for paid-tier-only pages (Programs, Hidden Gems, Scholarships,
 * Timeline, Strategy, Essays, Compare, Bias Check, Gap Analysis — the same
 * set Layout.jsx's nav already marks `premium: true`). Free-tier users are
 * redirected to Pricing with an upsell message instead of the page they
 * tried to reach. Assumes it's nested inside <ProtectedRoute/>, so a session
 * is already guaranteed to exist by the time this runs.
 */
export default function TierGate() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (user?.tier !== 'paid') {
    return <Navigate to="/pricing" replace state={{ from: location, reason: 'upgrade' }} />
  }

  return <Outlet />
}

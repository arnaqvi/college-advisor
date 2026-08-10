import { createContext, useContext, useEffect, useState } from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../lib/api/auth.js'

// Real, server-validated session — replaces the old client-only version that
// just wrote {email, role, name} to localStorage/sessionStorage with no
// backend check at all (see backend/app/routers/auth.py, backend/docs/
// user-stories.md story 1). Identity lives in a signed httpOnly cookie the
// browser sends automatically; this context's job is just to ask the backend
// "who am I" on load and expose login/register/logout.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function login(email, password) {
    const me = await apiLogin(email, password)
    setUser(me)
    return me
  }

  async function register(payload) {
    const me = await apiRegister(payload)
    setUser(me)
    return me
  }

  async function logout() {
    await apiLogout()
    setUser(null)
  }

  // Re-checks the session with the backend — used after an action that
  // changes something /me returns (e.g. subscribing/canceling a plan changes
  // `tier`) without forcing a full page reload.
  async function refresh() {
    const me = await fetchMe()
    setUser(me)
    return me
  }

  const value = { user, loading, login, register, logout, refresh, isAuthenticated: Boolean(user) }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

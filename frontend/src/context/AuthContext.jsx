import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'collegeAdvisorAuth'

// NOTE: There is no backend auth API yet (see ../../CLAUDE.md — backend has no
// user schema or /api/auth routes). This is a client-only session used to gate
// routes by role in the UI. It does not verify credentials against a real user
// store. Wire this up to `backend/` once an auth API exists.
const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const local = localStorage.getItem(STORAGE_KEY)
    if (local) return JSON.parse(local)
    const session = sessionStorage.getItem(STORAGE_KEY)
    return session ? JSON.parse(session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  function login({ email, role, name, remember = false }) {
    const nextUser = { email, role, name }
    const payload = JSON.stringify(nextUser)
    if (remember) {
      localStorage.setItem(STORAGE_KEY, payload)
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, payload)
      localStorage.removeItem(STORAGE_KEY)
    }
    setUser(nextUser)
    return nextUser
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  const value = { user, login, logout, isAuthenticated: Boolean(user) }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

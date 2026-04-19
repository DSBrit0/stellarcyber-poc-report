import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authenticate } from '../services/auth'

const SESSION_KEY = 'stellar_session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // { token, url, username, tenant, exp } — null when not authenticated
  const [auth, setAuth]             = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError]   = useState(null)

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.exp && saved.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem(SESSION_KEY)
        return
      }
      setAuth(saved)
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [])

  // ── Persist auth state to sessionStorage (token only — never password) ────
  useEffect(() => {
    if (!auth) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    const { password: _omit, ...safe } = auth  // eslint-disable-line no-unused-vars
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe))
  }, [auth])

  // ── Connect: username + password ──────────────────────────────────────────
  const connect = useCallback(async (credentials) => {
    setConnecting(true)
    setAuthError(null)
    try {
      const result = await authenticate(credentials)
      const authData = {
        token:    result.token,
        url:      credentials.url,
        username: credentials.username,
        tenant:   credentials.tenant ?? null,
        exp:      result.exp ?? null,
      }
      setAuth(authData)
      return { success: true }
    } catch (err) {
      setAuthError(err.message || 'Connection failed')
      return { success: false }
    } finally {
      setConnecting(false)
    }
  }, [])

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setAuth(null)
    setAuthError(null)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{
      auth, connecting, authError,
      connect, disconnect,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

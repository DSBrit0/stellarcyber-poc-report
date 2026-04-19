import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authenticate, verifyOTP } from '../services/auth'

const SESSION_KEY = 'stellar_session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // { token, url, username, tenant, exp } — null when not authenticated
  const [auth, setAuth]                       = useState(null)
  const [connecting, setConnecting]           = useState(false)
  const [authError, setAuthError]             = useState(null)
  // 'credentials' | 'otp'
  const [authStep, setAuthStep]               = useState('credentials')
  // Holds credentials between step 1 and step 2 (password never persisted to storage)
  const [pendingCredentials, setPendingCredentials] = useState(null)

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      // Reject if token is expired
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

  // ── Step 1: username + password ───────────────────────────────────────────
  const connect = useCallback(async (credentials) => {
    setConnecting(true)
    setAuthError(null)
    try {
      const result = await authenticate(credentials)

      if (result.mfaRequired) {
        setPendingCredentials(credentials)
        setAuthStep('otp')
        return { mfaRequired: true }
      }

      const authData = {
        token:    result.token,
        url:      credentials.url,
        username: credentials.username,
        tenant:   credentials.tenant ?? null,
        exp:      result.exp ?? null,
      }
      setAuth(authData)
      setAuthStep('credentials')
      return { success: true }

    } catch (err) {
      setAuthError(err.message || 'Connection failed')
      return { success: false }
    } finally {
      setConnecting(false)
    }
  }, [])

  // ── Step 2: OTP/MFA code ─────────────────────────────────────────────────
  const verifyMFA = useCallback(async (otpCode) => {
    if (!pendingCredentials) {
      setAuthError('Session expired. Please log in again.')
      return { success: false }
    }
    setConnecting(true)
    setAuthError(null)
    try {
      const result = await verifyOTP({ ...pendingCredentials, otpCode })
      const authData = {
        token:    result.token,
        url:      pendingCredentials.url,
        username: pendingCredentials.username,
        tenant:   pendingCredentials.tenant ?? null,
        exp:      result.exp ?? null,
      }
      setAuth(authData)
      setPendingCredentials(null)
      setAuthStep('credentials')
      return { success: true }
    } catch (err) {
      setAuthError(err.message || 'Invalid OTP code')
      return { success: false }
    } finally {
      setConnecting(false)
    }
  }, [pendingCredentials])

  // ── Back to step 1 ────────────────────────────────────────────────────────
  const resetAuthStep = useCallback(() => {
    setAuthStep('credentials')
    setPendingCredentials(null)
    setAuthError(null)
  }, [])

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setAuth(null)
    setAuthError(null)
    setAuthStep('credentials')
    setPendingCredentials(null)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{
      auth, connecting, authError, authStep,
      connect, verifyMFA, resetAuthStep, disconnect,
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

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { authenticate } from '../services/auth'
import { info, warn } from '../utils/logger'

const SESSION_KEY = 'stellar_session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth]             = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError]   = useState(null)

  // Password mantido apenas em memória — nunca serializado ou gravado em disco.
  // Necessário para renovar o token automaticamente (expira em 10 min).
  const passwordRef = useRef(null)

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

  // ── Persist auth to sessionStorage (nunca a senha) ───────────────────────
  useEffect(() => {
    if (!auth) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(auth))
  }, [auth])

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setAuth(null)
    setAuthError(null)
    passwordRef.current = null
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  // ── Renovação proativa do token (60s antes de expirar) ───────────────────
  useEffect(() => {
    if (!auth?.exp || !passwordRef.current) return

    const msUntilExpiry = auth.exp * 1000 - Date.now()
    const delay         = Math.max(msUntilExpiry - 60_000, 0)

    info('auth', `Renovação de token agendada em ${Math.round(delay / 1000)}s`)

    const timer = setTimeout(async () => {
      try {
        const result = await authenticate({
          url:      auth.url,
          username: auth.username,
          password: passwordRef.current,
          tenant:   auth.tenant,
        })
        setAuth(prev => ({ ...prev, token: result.token, exp: result.exp ?? prev.exp }))
        info('auth', 'Token renovado automaticamente ✅')
      } catch (err) {
        warn('auth', 'Falha ao renovar token — sessão encerrada', { error: err.message })
        disconnect()
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [auth?.exp, auth?.url, auth?.username, auth?.tenant, disconnect])

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async (credentials) => {
    setConnecting(true)
    setAuthError(null)
    try {
      const result = await authenticate(credentials)
      passwordRef.current = credentials.password  // mantém em memória para renovação
      setAuth({
        token:    result.token,
        url:      credentials.url,
        username: credentials.username,
        tenant:   credentials.tenant ?? null,
        exp:      result.exp ?? null,
      })
      return { success: true }
    } catch (err) {
      setAuthError(err.message || 'Falha na conexão')
      return { success: false }
    } finally {
      setConnecting(false)
    }
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

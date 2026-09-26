import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { authenticate, AUTH_METHODS } from '../services/auth'
import { info, warn } from '../utils/logger'

const SESSION_KEY = 'stellar_session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth]             = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError]   = useState(null)

  // Segredo (senha ou scoped API key) mantido apenas em memória — nunca serializado
  // ou gravado em disco. Necessário para renovar o JWT automaticamente (expira em 10 min).
  const secretRef = useRef(null)

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
    secretRef.current = null
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  // ── Renovação proativa do token (60s antes de expirar) ───────────────────
  useEffect(() => {
    if (!auth?.exp || !secretRef.current) return

    const msUntilExpiry = auth.exp * 1000 - Date.now()
    const delay         = Math.max(msUntilExpiry - 60_000, 0)

    info('auth', `Renovação de token agendada em ${Math.round(delay / 1000)}s`)

    const timer = setTimeout(async () => {
      try {
        const isApiKey = auth.method === AUTH_METHODS.API_KEY
        const result = await authenticate({
          method:   auth.method,
          url:      auth.url,
          username: auth.username,
          ...(isApiKey ? { apiKey: secretRef.current } : { password: secretRef.current }),
        })
        setAuth(prev => ({ ...prev, token: result.token, exp: result.exp ?? prev.exp }))
        info('auth', 'Token renovado automaticamente ✅')
      } catch (err) {
        warn('auth', 'Falha ao renovar token — sessão encerrada', { error: err.message })
        disconnect()
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [auth?.exp, auth?.url, auth?.username, auth?.method, disconnect])

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async (credentials) => {
    setConnecting(true)
    setAuthError(null)
    try {
      const method   = credentials.method ?? AUTH_METHODS.BASIC
      const isApiKey = method === AUTH_METHODS.API_KEY
      const result   = await authenticate({ ...credentials, method })
      // mantém em memória para renovação
      secretRef.current = isApiKey ? credentials.apiKey.trim() : credentials.password
      setAuth({
        token:    result.token,
        url:      credentials.url,
        method,
        username: isApiKey ? null : credentials.username,
        apiKeyId: isApiKey ? apiKeyId(credentials.apiKey) : null,
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

// A scoped API key é um JWT cujo payload traz api_key.key_id — usado só para exibição.
function apiKeyId(key) {
  try {
    const b64 = key.trim().split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='))).api_key?.key_id ?? null
  } catch {
    return null
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

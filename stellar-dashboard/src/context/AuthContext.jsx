import { createContext, useContext, useState, useCallback } from 'react'
import { authenticate } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null) // { token, url, username, tenant }
  const [connecting, setConnecting] = useState(false)
  const [authError, setAuthError] = useState(null)

  const connect = useCallback(async (credentials) => {
    setConnecting(true)
    setAuthError(null)
    try {
      const token = await authenticate(credentials)
      setAuth({ token, ...credentials })
      return true
    } catch (err) {
      setAuthError(err.message || 'Connection failed')
      return false
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAuth(null)
    setAuthError(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, connecting, authError, connect, disconnect }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

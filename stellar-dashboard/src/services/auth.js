import axios from 'axios'
import { ENDPOINTS, HTTP } from './endpoints'
import {
  debug, info, warn, error as logError,
  validateLoginFields, validateAuthResponse, logApiError,
} from '../utils/logger'

/**
 * Testa se a URL é acessível (faz um HEAD request para raiz).
 * Útil para validar antes de tentar autenticar.
 */
export async function testConnectivity(url) {
  const base = url.replace(/\/$/, '')
  try {
    debug('auth', 'Testing connectivity', { url: base })
    const res = await axios.head(base, { timeout: 5000 })
    info('auth', 'URL is reachable', { url: base, status: res.status })
    return { reachable: true, status: res.status }
  } catch (err) {
    const code = err.code || (err.response?.status ? `HTTP${err.response.status}` : 'unknown')
    warn('auth', 'URL not reachable', { url: base, code })
    return { reachable: false, error: err.message, code }
  }
}

export async function authenticate({ url, username, password, jwtToken }) {
  if (jwtToken === 'DEMO_MODE_TOKEN') {
    info('auth', 'Demo mode — skipping real auth')
    return { token: 'DEMO_MODE_TOKEN', exp: null, payload: null }
  }

  if (jwtToken && jwtToken.trim()) {
    info('auth', 'Manual JWT token provided — bypass login')
    return { token: jwtToken.trim(), exp: null, payload: null }
  }

  const { valid, errors } = validateLoginFields({ url, username, password })
  if (!valid) throw new Error(errors[0])

  const base = url.replace(/\/$/, '')

  debug('auth', 'Starting authentication', { base, username, timestamp: new Date().toISOString() })

  try {
    const res = await axios.post(ENDPOINTS.ACCESS_TOKEN, null, {
      baseURL: '/proxy',
      auth: { username: username.trim(), password },
      headers: { 'X-Proxy-Target': base },
      timeout: HTTP.AUTH_TIMEOUT,
    })

    const { token, exp, payload } = validateAuthResponse(res.data, res.status)
    return { token, exp, payload }

  } catch (err) {
    if (err.message && !err.response && !err.code) {
      logError('auth', err.message)
      throw err
    }

    throw new Error(logApiError(err, 'auth'))
  }
}

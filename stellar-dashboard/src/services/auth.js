import axios from 'axios'
import { ENDPOINTS, HTTP } from './endpoints'
import {
  debug, info, warn, error as logError,
  validateLoginFields, validateApiKeyFields, validateAuthResponse, logApiError,
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

export const AUTH_METHODS = { API_KEY: 'apiKey', BASIC: 'basic' }

/**
 * Obtém um JWT via POST /access_token.
 * - apiKey: scoped API key enviada como "Authorization: Bearer <key>" (esquema apiKey do Swagger)
 * - basic:  usuário + token legado via Basic Auth
 * O JWT retornado expira em 10 min e é usado como Bearer em todas as demais chamadas.
 */
export async function authenticate({ method = AUTH_METHODS.BASIC, url, username, password, apiKey, jwtToken }) {
  if (jwtToken && jwtToken.trim()) {
    info('auth', 'Manual JWT token provided — bypass login')
    return { token: jwtToken.trim(), exp: null, payload: null }
  }

  const isApiKey = method === AUTH_METHODS.API_KEY
  const { valid, errors } = isApiKey
    ? validateApiKeyFields({ url, apiKey })
    : validateLoginFields({ url, username, password })
  if (!valid) throw new Error(errors[0])

  const base = url.replace(/\/$/, '')

  debug('auth', 'Starting authentication', {
    base, method, username: isApiKey ? undefined : username, timestamp: new Date().toISOString(),
  })

  try {
    const res = await axios.post(ENDPOINTS.ACCESS_TOKEN, null, {
      baseURL: '/proxy',
      ...(isApiKey ? {} : { auth: { username: username.trim(), password } }),
      headers: {
        'X-Proxy-Target': base,
        ...(isApiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
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

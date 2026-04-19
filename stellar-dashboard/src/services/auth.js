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

/**
 * Step 1 — Authenticate with username + password via HTTP Basic Auth.
 *
 * Returns:
 *   { token, exp, payload, mfaRequired: false }  — auth complete
 *   { token: null, mfaRequired: true, sessionToken? } — MFA challenge received
 */
export async function authenticate({ url, username, password, jwtToken }) {
  if (jwtToken === 'DEMO_MODE_TOKEN') {
    info('auth', 'Demo mode — skipping real auth')
    return { token: 'DEMO_MODE_TOKEN', exp: null, payload: null, mfaRequired: false }
  }

  if (jwtToken && jwtToken.trim()) {
    info('auth', 'Manual JWT token provided — bypass login')
    return { token: jwtToken.trim(), exp: null, payload: null, mfaRequired: false }
  }

  const { valid, errors } = validateLoginFields({ url, username, password })
  if (!valid) throw new Error(errors[0])

  const base     = url.replace(/\/$/, '')
  const endpoint = `${base}${ENDPOINTS.ACCESS_TOKEN}`

  debug('auth', 'Starting authentication', { endpoint, username, timestamp: new Date().toISOString() })

  try {
    const res = await axios.post(endpoint, null, {
      auth: { username: username.trim(), password },
      timeout: HTTP.AUTH_TIMEOUT,
    })

    // Detect explicit MFA requirement in the response body
    if (res.data?.mfa_required || res.data?.otp_required || res.data?.requires_mfa) {
      info('auth', 'MFA required by instance response')
      return { token: null, exp: null, mfaRequired: true, sessionToken: res.data?.session_token ?? null }
    }

    const { token, exp, payload } = validateAuthResponse(res.data, res.status)
    return { token, exp, payload, mfaRequired: false }

  } catch (err) {
    // Some instances signal MFA requirement via a 401 body
    if (err.response?.status === 401) {
      const body   = err.response.data ?? {}
      const errStr = String(body?.error ?? body?.error_description ?? '').toLowerCase()
      if (body?.mfa_required || body?.otp_required || errStr.includes('mfa') || errStr.includes('otp')) {
        info('auth', 'MFA required — detected from 401 response')
        return { token: null, exp: null, mfaRequired: true }
      }
    }

    if (err.message && !err.response && !err.code) {
      logError('auth', err.message)
      throw err
    }

    throw new Error(logApiError(err, 'auth'))
  }
}

/**
 * Step 2 — Submit the OTP/2FA code to complete authentication.
 *
 * Tries two strategies in order:
 *   1. POST access_token with otp as query parameter
 *   2. POST access_token with otp in JSON body
 *
 * Throws a descriptive error if both strategies fail.
 */
export async function verifyOTP({ url, username, password, otpCode }) {
  if (!otpCode?.trim()) throw new Error('Código de autenticação é obrigatório.')

  const base     = url.replace(/\/$/, '')
  const endpoint = `${base}${ENDPOINTS.ACCESS_TOKEN}`
  const otp      = otpCode.trim()

  debug('auth', 'Verifying OTP', { endpoint, username })

  // Strategy 1: OTP as query parameter
  try {
    const res = await axios.post(`${endpoint}?otp=${encodeURIComponent(otp)}`, null, {
      auth: { username: username.trim(), password },
      timeout: HTTP.AUTH_TIMEOUT,
    })
    if (res.data?.access_token) {
      const { token, exp, payload } = validateAuthResponse(res.data, res.status)
      info('auth', 'OTP verified via query param')
      return { token, exp, payload }
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('Código de autenticação inválido. Verifique o código e tente novamente.')
    }
    warn('auth', 'OTP query-param strategy failed', { status: err.response?.status })
  }

  // Strategy 2: OTP in JSON body
  try {
    const res = await axios.post(endpoint, { otp }, {
      auth: { username: username.trim(), password },
      timeout: HTTP.AUTH_TIMEOUT,
    })
    if (res.data?.access_token) {
      const { token, exp, payload } = validateAuthResponse(res.data, res.status)
      info('auth', 'OTP verified via JSON body')
      return { token, exp, payload }
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('Código de autenticação inválido. Verifique o código e tente novamente.')
    }
    warn('auth', 'OTP JSON-body strategy failed', { status: err.response?.status })
  }

  throw new Error(
    'Não foi possível verificar o código MFA via API. ' +
    'Se sua instância usa SSO ou MFA baseado em SAML, acesse via interface web.'
  )
}

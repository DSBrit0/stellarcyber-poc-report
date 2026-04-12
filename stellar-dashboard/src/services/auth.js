import axios from 'axios'
import { debug, info, warn, error as logError, validateLoginFields, validateAuthResponse, logApiError } from '../utils/logger'

/**
 * Autentica na instância Stellar Cyber via HTTP Basic Auth.
 *
 * Endpoint: POST <baseUrl>/connect/api/v1/access_token
 * Auth:     Basic  username:password  (Base64)
 *
 * Resposta: { access_token: "eyJ...", exp: <unix_timestamp> }
 *
 * O access_token JWT é usado como Bearer em todas as chamadas subsequentes.
 * O tenant_id NÃO é utilizado na autenticação — apenas para filtrar dados.
 */
export async function authenticate({ url, username, password, jwtToken }) {
  // Demo mode
  if (jwtToken === 'DEMO_MODE_TOKEN') {
    info('auth', 'Modo demo ativado — sem chamada real à API')
    return 'DEMO_MODE_TOKEN'
  }

  // JWT manual
  if (jwtToken && jwtToken.trim()) {
    info('auth', 'Token JWT manual fornecido — bypass do login')
    return jwtToken.trim()
  }

  // 1. Validar campos antes de chamar a API
  const { valid, errors } = validateLoginFields({ url, username, password })
  if (!valid) {
    throw new Error(errors[0])
  }

  const baseUrl  = url.replace(/\/$/, '')
  const endpoint = `${baseUrl}/connect/api/v1/access_token`

  debug('auth', 'Iniciando autenticação', { endpoint, username })

  try {
    const res = await axios.post(endpoint, null, {
      auth: { username: username.trim(), password },
      timeout: 15000,
    })

    // 2. Validar resposta
    const { token } = validateAuthResponse(res.data, res.status)
    return token

  } catch (err) {
    // Erros já tratados (validação de campos ou validateAuthResponse)
    if (err.message && !err.response && !err.code) {
      logError('auth', err.message)
      throw err
    }

    // 3. Checar e logar erros de API/rede
    const friendly = logApiError(err, 'auth')
    throw new Error(friendly)
  }
}

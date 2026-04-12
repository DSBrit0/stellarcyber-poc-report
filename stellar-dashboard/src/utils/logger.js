/**
 * logger.js — Sistema de logs e debug do Stellar Dashboard
 *
 * Funcionalidades:
 *   - Níveis: DEBUG | INFO | WARN | ERROR
 *   - Validação de campos de login
 *   - Validação de resposta de autenticação
 *   - Detecção e classificação de erros de API
 *   - Histórico em memória (últimos 500 logs)
 *   - Persistência opcional em localStorage
 *   - Export como JSON ou texto
 */

// ─── Configuração ─────────────────────────────────────────────────────────────

const CONFIG = {
  enabled:      true,
  maxEntries:   500,
  persist:      true,               // salvar em localStorage
  storageKey:   'stellar_logs',
  consolePrint: import.meta.env.DEV, // só imprime no console em desenvolvimento
}

// ─── Níveis ───────────────────────────────────────────────────────────────────

export const Level = Object.freeze({
  DEBUG: 'DEBUG',
  INFO:  'INFO',
  WARN:  'WARN',
  ERROR: 'ERROR',
})

const LEVEL_RANK = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

const LEVEL_STYLE = {
  DEBUG: 'color:#7c3aed',
  INFO:  'color:#00d4ff',
  WARN:  'color:#f59e0b',
  ERROR: 'color:#ef4444',
}

// ─── Store em memória ─────────────────────────────────────────────────────────

let _entries = []

function _load() {
  if (!CONFIG.persist) return
  try {
    const raw = localStorage.getItem(CONFIG.storageKey)
    if (raw) _entries = JSON.parse(raw)
  } catch {
    _entries = []
  }
}

function _save() {
  if (!CONFIG.persist) return
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(_entries.slice(-CONFIG.maxEntries)))
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

_load()

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Registra uma entrada de log.
 * @param {string} level   - Level.DEBUG | INFO | WARN | ERROR
 * @param {string} context - Categoria (ex: 'auth', 'api', 'validation')
 * @param {string} message - Mensagem descritiva
 * @param {*}      data    - Dados extras (objeto, string, erro, etc.)
 */
export function log(level, context, message, data = null) {
  if (!CONFIG.enabled) return

  const entry = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    data: sanitize(data),
  }

  _entries.push(entry)
  if (_entries.length > CONFIG.maxEntries) _entries.shift()
  _save()

  if (CONFIG.consolePrint) {
    const style = LEVEL_STYLE[level] || ''
    const prefix = `%c[${level}] [${context}]`
    if (data !== null && data !== undefined) {
      console.groupCollapsed(`${prefix} ${message}`, style)
      console.log(entry.data)
      console.groupEnd()
    } else {
      console.log(`${prefix} ${message}`, style)
    }
  }

  return entry
}

// Atalhos por nível
export const debug = (ctx, msg, data) => log(Level.DEBUG, ctx, msg, data)
export const info  = (ctx, msg, data) => log(Level.INFO,  ctx, msg, data)
export const warn  = (ctx, msg, data) => log(Level.WARN,  ctx, msg, data)
export const error = (ctx, msg, data) => log(Level.ERROR, ctx, msg, data)

// ─── Validação de campos de login ─────────────────────────────────────────────

/**
 * Valida os campos do formulário de login antes de enviar à API.
 * Loga cada campo verificado e retorna lista de erros encontrados.
 *
 * @param {{ url, username, password }} fields
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLoginFields({ url, username, password }) {
  debug('validation', 'Iniciando validação dos campos de login', { url, username, password: password ? '***' : '' })

  const errors = []

  // URL
  if (!url || !url.trim()) {
    errors.push('URL da instância é obrigatória.')
    warn('validation', 'Campo URL vazio')
  } else {
    try {
      const parsed = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('URL deve usar protocolo HTTP ou HTTPS.')
        warn('validation', 'URL com protocolo inválido', { protocol: parsed.protocol })
      } else {
        debug('validation', 'URL válida', { host: parsed.host })
      }
    } catch {
      errors.push('URL inválida — verifique o formato (ex: https://poc.stellarcyber.cloud).')
      warn('validation', 'URL com formato inválido', { url })
    }
  }

  // Usuário
  if (!username || !username.trim()) {
    errors.push('Usuário é obrigatório.')
    warn('validation', 'Campo usuário vazio')
  } else if (username.trim().length < 3) {
    errors.push('Usuário deve ter ao menos 3 caracteres.')
    warn('validation', 'Usuário muito curto', { length: username.trim().length })
  } else {
    debug('validation', 'Usuário válido', { username: username.trim() })
  }

  // Senha
  if (!password) {
    errors.push('Senha / API Key é obrigatória.')
    warn('validation', 'Campo senha vazio')
  } else if (password.length < 6) {
    errors.push('Senha deve ter ao menos 6 caracteres.')
    warn('validation', 'Senha muito curta', { length: password.length })
  } else {
    debug('validation', 'Senha válida', { length: password.length })
  }

  if (errors.length === 0) {
    info('validation', 'Todos os campos de login são válidos ✅')
  } else {
    warn('validation', `Validação falhou — ${errors.length} erro(s) encontrado(s)`, { errors })
  }

  return { valid: errors.length === 0, errors }
}

// ─── Validação de resposta de login ──────────────────────────────────────────

/**
 * Valida a resposta recebida do endpoint de autenticação.
 * Loga o resultado e retorna o token ou lança erro descritivo.
 *
 * @param {*}      responseData - Corpo da resposta HTTP
 * @param {number} httpStatus   - Código HTTP (ex: 200, 401)
 * @returns {{ token: string, exp: number|null }}
 */
export function validateAuthResponse(responseData, httpStatus = 200) {
  debug('auth', 'Validando resposta de autenticação', {
    httpStatus,
    keys: responseData ? Object.keys(responseData) : null,
  })

  // Status HTTP inesperado
  if (httpStatus !== 200) {
    const msg = `Resposta inesperada do servidor: HTTP ${httpStatus}`
    error('auth', msg, { httpStatus, body: responseData })
    throw new Error(msg)
  }

  // access_token ausente
  const token = responseData?.access_token
  if (!token || typeof token !== 'string' || !token.trim()) {
    const msg = 'Resposta inválida: access_token ausente ou vazio.'
    error('auth', msg, { responseData })
    throw new Error(msg)
  }

  // Validar estrutura JWT (3 partes separadas por ".")
  const parts = token.split('.')
  if (parts.length !== 3) {
    const msg = 'access_token não parece ser um JWT válido (esperado 3 segmentos).'
    error('auth', msg, { tokenParts: parts.length })
    throw new Error(msg)
  }

  // Decodificar payload JWT
  let payload = null
  try {
    payload = JSON.parse(atob(parts[1]))
    debug('auth', 'Payload JWT decodificado', {
      user:    payload.name || payload.email,
      profile: payload.priv_profile_id,
      org:     payload.org_id,
      exp:     payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    })
  } catch {
    warn('auth', 'Não foi possível decodificar o payload JWT')
  }

  // Verificar expiração
  if (payload?.exp) {
    const expiresInMs = (payload.exp * 1000) - Date.now()
    if (expiresInMs <= 0) {
      error('auth', 'Token recebido já está expirado', { exp: new Date(payload.exp * 1000).toISOString() })
      throw new Error('O token recebido já está expirado.')
    }
    info('auth', `Token válido por ${Math.round(expiresInMs / 60000)} minutos ✅`, {
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    })
  }

  info('auth', 'Autenticação bem-sucedida ✅', {
    user:      payload?.name || payload?.email || 'desconhecido',
    profile:   payload?.priv_profile_id,
    tokenSize: token.length,
  })

  return {
    token,
    exp:     payload?.exp ?? null,
    payload: payload ?? null,
  }
}

// ─── Detecção e classificação de erros ───────────────────────────────────────

/**
 * Registra e classifica um erro de API ou de rede.
 * Retorna uma mensagem amigável para exibir ao usuário.
 *
 * @param {Error|*} err      - Objeto de erro capturado
 * @param {string}  context  - Contexto onde ocorreu (ex: 'fetchCases')
 * @returns {string}         - Mensagem amigável
 */
export function logApiError(err, context = 'api') {
  // Erro de resposta HTTP (axios)
  if (err?.response) {
    const s   = err.response.status
    const msg = err.response.data?.error_description
              || err.response.data?.message
              || err.response.data?.error
              || `HTTP ${s}`

    error(context, `Erro de API: HTTP ${s}`, {
      status:   s,
      message:  msg,
      url:      err.config?.url,
      method:   err.config?.method?.toUpperCase(),
      response: err.response.data,
    })

    const friendly = {
      400: `Requisição inválida (400): ${msg}`,
      401: 'Sessão expirada ou credenciais inválidas (401).',
      403: 'Acesso negado — permissões insuficientes (403).',
      404: `Recurso não encontrado: ${err.config?.url || context} (404).`,
      422: `Dados inválidos enviados ao servidor (422): ${msg}`,
      429: 'Limite de requisições atingido — aguarde e tente novamente (429).',
      500: 'Erro interno do servidor (500) — tente novamente em instantes.',
      502: 'Gateway inválido (502) — instância pode estar inacessível.',
      503: 'Serviço indisponível (503) — instância pode estar em manutenção.',
    }
    return friendly[s] || `Erro do servidor (${s}): ${msg}`
  }

  // Timeout
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
    error(context, 'Timeout na requisição', { code: err.code, url: err.config?.url })
    return 'Tempo limite excedido — verifique a URL e a conectividade.'
  }

  // Sem rede / CORS / recusado
  if (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNREFUSED') {
    error(context, 'Erro de rede', { code: err.code, url: err.config?.url })
    return 'Não foi possível alcançar a instância — verifique a URL e a rede.'
  }

  // Erro genérico
  error(context, err?.message || 'Erro desconhecido', { err })
  return err?.message || 'Ocorreu um erro inesperado.'
}

// ─── Consulta ao histórico ────────────────────────────────────────────────────

/** Retorna todos os logs armazenados. */
export function getLogs() {
  return [..._entries]
}

/** Filtra logs por nível mínimo, contexto ou texto. */
export function filterLogs({ minLevel, context, search } = {}) {
  return _entries.filter(e => {
    if (minLevel && LEVEL_RANK[e.level] < LEVEL_RANK[minLevel]) return false
    if (context  && !e.context.toLowerCase().includes(context.toLowerCase())) return false
    if (search   && !e.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
}

/** Remove todos os logs da memória e do localStorage. */
export function clearLogs() {
  _entries = []
  if (CONFIG.persist) {
    try { localStorage.removeItem(CONFIG.storageKey) } catch { /* ignore */ }
  }
  info('logger', 'Histórico de logs limpo')
}

// ─── Export ───────────────────────────────────────────────────────────────────

/** Exporta os logs como arquivo JSON para download. */
export function exportLogsJSON(filename = 'stellar_logs.json') {
  const blob = new Blob([JSON.stringify(_entries, null, 2)], { type: 'application/json' })
  _download(blob, filename)
  info('logger', `Logs exportados como JSON (${_entries.length} entradas)`)
}

/** Exporta os logs como arquivo de texto legível para download. */
export function exportLogsText(filename = 'stellar_logs.txt') {
  const lines = _entries.map(e => {
    const ts   = e.timestamp.replace('T', ' ').slice(0, 19)
    const data = e.data ? ` | ${JSON.stringify(e.data)}` : ''
    return `[${ts}] [${e.level.padEnd(5)}] [${e.context}] ${e.message}${data}`
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  _download(blob, filename)
  info('logger', `Logs exportados como TXT (${_entries.length} entradas)`)
}

function _download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sanitização (remove dados sensíveis) ────────────────────────────────────

const SENSITIVE_KEYS = new Set(['password', 'token', 'access_token', 'authorization', 'secret', 'api_key'])

function sanitize(data, depth = 0) {
  if (depth > 4 || data === null || data === undefined) return data
  if (typeof data === 'string') return data.length > 500 ? data.slice(0, 500) + '…' : data
  if (typeof data !== 'object') return data
  if (Array.isArray(data)) return data.slice(0, 20).map(v => sanitize(v, depth + 1))

  const out = {}
  for (const [k, v] of Object.entries(data)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase())
      ? (typeof v === 'string' && v.length > 4 ? `${v.slice(0, 4)}…[redacted]` : '[redacted]')
      : sanitize(v, depth + 1)
  }
  return out
}

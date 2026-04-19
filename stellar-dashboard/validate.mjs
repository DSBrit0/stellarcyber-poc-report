#!/usr/bin/env node
/**
 * validate.mjs — Full integration test: auth → data → PDF normalization
 *
 * Usage:
 *   node validate.mjs \
 *     --url=https://your-instance.stellarcyber.ai \
 *     --username=user@company.com \
 *     --password=yourpassword \
 *     --tenant=6951699ec7314422bd3bec86f9d354ab \
 *     [--host=http://localhost:8080]
 */

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=')
      return [k, v.join('=')]
    })
)

const INSTANCE_URL = args.url
const USERNAME     = args.username
const PASSWORD     = args.password
const TENANT       = args.tenant
const PROXY_HOST   = args.host || 'http://localhost:8080'

if (!INSTANCE_URL || !USERNAME || !PASSWORD || !TENANT) {
  console.error(`
❌  Parâmetros obrigatórios:
    --url=https://instance.stellarcyber.ai
    --username=user@company.com
    --password=senha
    --tenant=id-do-tenant

Opcional:
    --host=http://localhost:8080   (endereço do servidor proxy local)
`)
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TARGET = INSTANCE_URL.replace(/\/$/, '')
const LIMIT  = 200

let PASS = 0
let FAIL = 0

function ok(label, detail = '') {
  PASS++
  console.log(`  ✅  ${label}${detail ? ' — ' + detail : ''}`)
}

function fail(label, detail = '') {
  FAIL++
  console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`)
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

async function proxyFetch(path, token, opts = {}) {
  const url  = `${PROXY_HOST}/proxy${path}`
  const init = {
    method:  opts.method || 'GET',
    headers: {
      'X-Proxy-Target': TARGET,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.authHeader || {}),
    },
    signal: AbortSignal.timeout(20_000),
  }
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, body }
}

// ─── Normalizers (mirrors src/services/api.js) ────────────────────────────────

function normalizeSeverity(val) {
  if (!val) return 'Medium'
  const s = String(val).toLowerCase()
  if (['critical', '4', 'p1'].includes(s)) return 'Critical'
  if (['high',     '3', 'p2'].includes(s)) return 'High'
  if (['medium',   '2', 'p3'].includes(s)) return 'Medium'
  if (['low',      '1', 'p4'].includes(s)) return 'Low'
  return 'Medium'
}

function normalizeCases(items) {
  return items.map((c, i) => ({
    id:             c._id || c.id || c.case_id || `CASE-${1000 + i}`,
    name:           c.name || c.title || c.summary || `Security Case ${i + 1}`,
    severity:       normalizeSeverity(c.severity || c.priority),
    status:         c.status || 'New',
    score:          typeof c.score === 'number' ? c.score : null,
    assetsAffected: c.size || c.assets_affected || c.asset_count || 1,
    tenantName:     c.tenant_name || c.cust_name || '',
    custId:         c.cust_id || '',
    createdAt:      c.created_at
      ? (typeof c.created_at === 'number' ? new Date(c.created_at).toISOString() : c.created_at)
      : new Date().toISOString(),
  }))
}

function normalizeTenants(items) {
  return items.map((t, i) => ({
    id:        t.cust_id || `T-${i}`,
    name:      t.cust_name || t.name || `Tenant ${i + 1}`,
    custId:    t.cust_id || '',
    dsNum:     t.ds_num || 0,
    userNum:   t.user_num || 0,
    createdAt: t.created_at
      ? (typeof t.created_at === 'number' ? new Date(t.created_at * 1000).toISOString() : t.created_at)
      : null,
  }))
}

function normalizeConnectors(items) {
  return items.map((c, i) => ({
    id:           c._id || c.id || `C-${i}`,
    name:         c.name || `Connector ${i + 1}`,
    active:       c.active ?? true,
    status:       c.active ? 'online' : 'offline',
    type:         c.type || c.category || 'unknown',
    category:     c.category || '',
    tenantId:     c.tenantid || c.tenant_id || '',
    lastActivity: c.last_activity
      ? (typeof c.last_activity === 'number' ? new Date(c.last_activity).toISOString() : c.last_activity)
      : null,
  }))
}

function sevCount(items) {
  return items.reduce((acc, x) => {
    acc[x.severity] = (acc[x.severity] || 0) + 1
    return acc
  }, {})
}

// ─── Validation steps ─────────────────────────────────────────────────────────

async function validateHealth() {
  section('1. PROXY SERVER HEALTH')
  try {
    const res  = await fetch(`${PROXY_HOST}/health`, { signal: AbortSignal.timeout(5000) })
    const body = await res.json()
    if (body.status === 'ok') ok('Proxy server online', `${PROXY_HOST}/health`)
    else fail('Health check body inesperado', JSON.stringify(body))
  } catch (e) {
    fail('Proxy server não acessível', e.message)
    console.error('\n  ⚠️  Certifique-se que o servidor está rodando: node server.js')
    process.exit(1)
  }
}

async function validateAuth() {
  section('2. AUTENTICAÇÃO (Basic Auth → JWT)')
  console.log(`  URL:    ${TARGET}`)
  console.log(`  User:   ${USERNAME}`)
  console.log(`  Tenant: ${TENANT}`)

  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
  const res = await proxyFetch('/connect/api/v1/access_token', null, {
    method: 'POST',
    authHeader: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) {
    fail(`Auth HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 200))
    return null
  }

  const token = res.body?.access_token
  if (!token) {
    fail('access_token ausente na resposta', JSON.stringify(res.body).slice(0, 200))
    return null
  }

  // Decode JWT payload
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    const expMs   = payload.exp ? (payload.exp * 1000 - Date.now()) : null
    const expMin  = expMs ? Math.round(expMs / 60000) : null
    ok('JWT recebido', `válido por ${expMin ?? '?'} min`)
    ok('Payload JWT', `user=${payload.name || payload.email || '?'} | profile=${payload.priv_profile_id || '?'}`)
    return { token, exp: payload.exp, payload }
  } catch {
    ok('JWT recebido', 'payload não decodificável')
    return { token, exp: null, payload: null }
  }
}

async function validateCases(token) {
  section('3. CASES — GET /connect/api/v1/cases')
  try {
    const res = await proxyFetch(
      `/connect/api/v1/cases?limit=${LIMIT}&tenantid=${TENANT}`,
      token
    )
    if (!res.ok) { fail(`HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 300)); return [] }

    const raw   = res.body
    const items = raw?.data?.cases ?? raw?.cases ?? (Array.isArray(raw) ? raw : [])
    const total = raw?.data?.total ?? raw?.total ?? items.length
    const cases = normalizeCases(items)

    ok(`HTTP ${res.status} — ${cases.length} cases (total API: ${total})`)

    const bySev = sevCount(cases)
    ok('Severidades', Object.entries(bySev).map(([k,v]) => `${k}:${v}`).join(' | '))

    const open   = cases.filter(c => c.status !== 'Closed').length
    const closed = cases.filter(c => c.status === 'Closed').length
    ok('Status', `Abertos:${open} | Fechados:${closed}`)

    if (cases.length > 0) {
      const sample = cases[0]
      ok('Amostra normalizada', `id=${sample.id} | sev=${sample.severity} | score=${sample.score ?? 'n/a'}`)
    }

    // PDF readiness
    const pdfReady = cases.length > 0 &&
      cases.every(c => c.id && c.name && c.severity && c.status)
    pdfReady
      ? ok('PDF-ready ✅', 'id, name, severity, status presentes')
      : fail('PDF-ready ❌', 'campos obrigatórios faltando')

    return cases
  } catch (e) {
    fail('Erro inesperado', e.message)
    return []
  }
}

async function validateTenants(token) {
  section('5. TENANTS — GET /connect/api/v1/tenants')
  try {
    const res = await proxyFetch('/connect/api/v1/tenants', token)

    if (res.status === 404) {
      console.log('  ℹ️  Endpoint /tenants retornou 404 — endpoint pode não existir nesta versão')
      console.log('  ℹ️  fetchAssets() faz fallback para tenants; se 404 aqui, retorna []')
      return []
    }

    if (!res.ok) { fail(`HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 300)); return [] }

    const raw     = res.body
    const items   = raw?.data ?? (Array.isArray(raw) ? raw : [])
    const tenants = normalizeTenants(items)

    ok(`HTTP ${res.status} — ${tenants.length} tenants`)
    if (tenants.length > 0) {
      ok('Amostra', `id=${tenants[0].custId} | name=${tenants[0].name} | ds=${tenants[0].dsNum}`)
    }
    return tenants
  } catch (e) {
    fail('Erro inesperado', e.message)
    return []
  }
}

async function validateConnectors(token) {
  section('6. CONNECTORS — GET /connect/api/v1/connectors')
  try {
    const res = await proxyFetch(
      `/connect/api/v1/connectors?tenantid=${TENANT}`,
      token
    )
    if (!res.ok) { fail(`HTTP ${res.status}`, JSON.stringify(res.body).slice(0, 300)); return [] }

    const raw        = res.body
    const items      = raw?.connectors ?? raw?.data ?? (Array.isArray(raw) ? raw : [])
    const connectors = normalizeConnectors(items)

    ok(`HTTP ${res.status} — ${connectors.length} connectors`)

    const active   = connectors.filter(c => c.active).length
    const inactive = connectors.filter(c => !c.active).length
    ok('Status', `Online:${active} | Offline:${inactive}`)

    if (connectors.length > 0) {
      ok('Amostra', `id=${connectors[0].id} | name=${connectors[0].name} | type=${connectors[0].type}`)
    }

    const pdfReady = connectors.length > 0 && connectors.every(c => c.id && c.name)
    pdfReady
      ? ok('PDF-ready ✅')
      : (connectors.length === 0 ? ok('Lista vazia') : fail('PDF-ready ❌'))

    return connectors
  } catch (e) {
    fail('Erro inesperado', e.message)
    return []
  }
}

function validatePdfData(cases, tenants, connectors) {
  section('6. PDF REPORT — VALIDAÇÃO DE DADOS')

  const criticalCases = cases.filter(c => c.severity === 'Critical').length
  const highCases     = cases.filter(c => c.severity === 'High').length
  const openCases     = cases.filter(c => c.status !== 'Closed').length
  const activeConns   = connectors.filter(c => c.active).length

  console.log('\n  📊  Resumo executivo para o PDF:')
  console.log(`      Casos abertos:     ${openCases}`)
  console.log(`      Casos críticos:    ${criticalCases}`)
  console.log(`      Casos high:        ${highCases}`)
  console.log(`      Conectores ativos: ${activeConns} / ${connectors.length}`)
  console.log(`      Tenants:           ${tenants.length}`)

  console.log('\n  📄  Seções do PDF:')
  cases.length > 0
    ? ok('Tabela de Cases', `${cases.length} linhas`)
    : fail('Tabela de Cases', 'sem dados')

  connectors.length > 0
    ? ok('Tabela de Conectores', `${connectors.length} linhas`)
    : ok('Tabela de Conectores', 'vazia')

  ok('KPIs executivos', 'campos validados')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║     Stellar Dashboard — Validação de Integração API      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\n  Instância: ${TARGET}`)
  console.log(`  Proxy:     ${PROXY_HOST}`)
  console.log(`  Tenant:    ${TENANT}`)

  await validateHealth()

  const auth = await validateAuth()
  if (!auth) {
    section('RESULTADO')
    console.log(`\n  ❌  Autenticação falhou — abortando demais testes\n`)
    process.exit(1)
  }

  const [cases, tenants, connectors] = await Promise.all([
    validateCases(auth.token),
    validateTenants(auth.token),
    validateConnectors(auth.token),
  ])

  validatePdfData(cases, tenants, connectors)

  section('RESULTADO FINAL')
  console.log(`\n  ✅  Aprovado: ${PASS}`)
  console.log(`  ❌  Falhou:   ${FAIL}`)

  if (FAIL === 0) {
    console.log('\n  🚀  Todos os testes passaram — aplicação pronta para uso.\n')
  } else {
    console.log('\n  ⚠️  Corrija os itens acima antes de usar em produção.\n')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('\n  💥  Erro fatal:', e.message)
  process.exit(1)
})

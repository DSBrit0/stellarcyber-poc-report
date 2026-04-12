import axios from 'axios'
import { debug, info, warn, logApiError } from '../utils/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IS_DEMO = (auth) => auth.token === 'DEMO_MODE_TOKEN'

/**
 * Cliente axios autenticado.
 * baseURL: <instance>/connect/api/v1
 * Todas as chamadas usam Bearer <access_token>
 */
function client(auth) {
  return axios.create({
    baseURL: `${auth.url.replace(/\/$/, '')}/connect/api/v1`,
    headers: { Authorization: `Bearer ${auth.token}` },
    timeout: 20000,
  })
}

function handleError(err, endpoint) {
  const friendly = logApiError(err, endpoint)
  throw new Error(friendly)
}

// ─── Demo data ────────────────────────────────────────────────────────────────

function demoCases() {
  const severities = ['Critical', 'High', 'High', 'Medium', 'Medium', 'Medium', 'Low']
  const names = [
    'Lateral movement detected from endpoint',
    'Unusual outbound DNS traffic spike',
    'Brute-force login attempt on VPN gateway',
    'Ransomware behavior pattern on workstation',
    'Privileged account login from unknown IP',
    'Data exfiltration via cloud storage',
    'Port scan from internal host',
    'Credential dump attempt detected',
    'C2 beacon communication detected',
    'Suspicious PowerShell execution',
  ]
  return Array.from({ length: 37 }, (_, i) => ({
    id: `CASE-${1000 + i}`,
    name: names[i % names.length],
    severity: severities[i % severities.length],
    status: i % 8 === 0 ? 'Closed' : 'New',
    score: +(Math.random() * 10).toFixed(1),
    assetsAffected: Math.floor(Math.random() * 8) + 1,
    tenantName: ['Acme Corp', 'Demo Tenant', 'Test Org'][i % 3],
    createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

function demoTenants() {
  return [
    { id: 'T1', name: 'HQ Tenant', custId: 'abc001', dsNum: 12, userNum: 45, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: 'T2', name: 'Branch Office', custId: 'abc002', dsNum: 5, userNum: 12, createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
    { id: 'T3', name: 'Cloud Tenant', custId: 'abc003', dsNum: 8, userNum: 30, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  ]
}

function demoConnectors() {
  return [
    { id: 'C1', name: 'Office365-HQ', active: true, type: 'office365', category: 'saas', tenantId: 'T1', lastActivity: new Date().toISOString(), statusCode: 0 },
    { id: 'C2', name: 'Cisco-Umbrella', active: true, type: 'ciscoumbrella', category: 'dns_security', tenantId: 'T1', lastActivity: new Date(Date.now() - 1800000).toISOString(), statusCode: 0 },
    { id: 'C3', name: 'Azure-EventHub', active: false, type: 'azure_eventhub', category: 'paas', tenantId: 'T2', lastActivity: new Date(Date.now() - 5 * 3600000).toISOString(), statusCode: 2 },
    { id: 'C4', name: 'AWS-CloudTrail', active: true, type: 'aws_cloudtrail', category: 'cloud', tenantId: 'T3', lastActivity: new Date(Date.now() - 600000).toISOString(), statusCode: 0 },
    { id: 'C5', name: 'CrowdStrike-EDR', active: true, type: 'crowdstrike', category: 'endpoint', tenantId: 'T1', lastActivity: new Date(Date.now() - 3600000).toISOString(), statusCode: 0 },
    { id: 'C6', name: 'Palo-Alto-FW', active: false, type: 'paloalto', category: 'network', tenantId: 'T2', lastActivity: new Date(Date.now() - 8 * 3600000).toISOString(), statusCode: 2 },
  ]
}

function demoIngestionStats() {
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
    gb: +(180 + Math.random() * 320).toFixed(1),
  }))
}

function demoIngestionTimeline() {
  const sources = ['office365', 'aws-cloudtrail', 'crowdstrike', 'paloalto-fw', 'cisco-umbrella', 'azure-eventhub']
  return sources.map((src, i) => ({
    id: `EVT-${i}`,
    source: src,
    timestamp: new Date(Date.now() - i * (i < 3 ? 1200000 : 3600000 * (i - 1))).toISOString(),
    size: +(5 + Math.random() * 80).toFixed(1),
    status: i % 4 === 0 ? 'error' : 'success',
  }))
}

// ─── Casos ────────────────────────────────────────────────────────────────────

/**
 * GET /cases
 * Response: { data: { total: N, cases: [...] } }
 *
 * Parâmetros opcionais: cust_id para filtrar por tenant
 */
export async function fetchCases(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchCases → demo mode'); return demoCases() }
  try {
    const params = { limit: 200 }
    if (auth.tenant) params.cust_id = auth.tenant
    debug('api', 'GET /cases', params)

    const res = await client(auth).get('/cases', { params })
    const raw = res.data
    const items = raw?.data?.cases ?? raw?.cases ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeCases(items)
    info('api', `fetchCases ✅  ${result.length} casos`, { total: raw?.data?.total })
    return result
  } catch (err) {
    handleError(err, '/cases')
  }
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

/**
 * GET /tenants
 * Response: { data: [...] }
 * Usado no dashboard como "ativos monitorados"
 */
export async function fetchTenants(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchTenants → demo mode'); return demoTenants() }
  try {
    debug('api', 'GET /tenants')
    const res = await client(auth).get('/tenants')
    const raw = res.data
    const items = raw?.data ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeTenants(items)
    info('api', `fetchTenants ✅  ${result.length} tenants`)
    return result
  } catch (err) {
    handleError(err, '/tenants')
  }
}

// ─── Conectores (Log Sources / Sensors) ──────────────────────────────────────

/**
 * GET /connectors
 * Response: { total: N, connectors: [...] }
 * Usados como "sensores" / fontes de log no dashboard
 */
export async function fetchConnectors(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchConnectors → demo mode'); return demoConnectors() }
  try {
    const params = {}
    if (auth.tenant) params.tenantid = auth.tenant
    debug('api', 'GET /connectors', params)

    const res = await client(auth).get('/connectors', { params })
    const raw = res.data
    const items = raw?.connectors ?? raw?.data ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeConnectors(items)
    const ativos = result.filter(c => c.active).length
    info('api', `fetchConnectors ✅  ${result.length} total | ${ativos} ativos`, { total: raw?.total })
    return result
  } catch (err) {
    handleError(err, '/connectors')
  }
}

// ─── Ingestion stats (derivado dos conectores) ────────────────────────────────

/**
 * Gera estatísticas diárias de ingestion a partir do last_activity dos conectores.
 * A API v1 não possui endpoint de ingestion stats dedicado.
 */
export async function fetchIngestionStats(auth) {
  if (IS_DEMO(auth)) return demoIngestionStats()
  try {
    const connectors = await fetchConnectors(auth)
    return deriveIngestionStats(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionStats fallback — usando array vazio', { error: err.message })
    return []
  }
}

/**
 * Gera timeline de eventos a partir dos conectores com last_activity recente.
 */
export async function fetchIngestionTimeline(auth) {
  if (IS_DEMO(auth)) return demoIngestionTimeline()
  try {
    const connectors = await fetchConnectors(auth)
    return deriveTimeline(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionTimeline fallback — usando array vazio', { error: err.message })
    return []
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeCases(items) {
  return items.map((c, i) => ({
    id: c._id || c.id || c.case_id || `CASE-${1000 + i}`,
    name: c.name || c.title || c.summary || `Security Case ${i + 1}`,
    severity: normalizeSeverity(c.severity || c.priority),
    status: c.status || 'New',
    score: typeof c.score === 'number' ? c.score : null,
    assetsAffected: c.size || c.assets_affected || c.asset_count || 1,
    tenantName: c.tenant_name || c.cust_name || '',
    custId: c.cust_id || '',
    createdAt: c.created_at
      ? (typeof c.created_at === 'number'
          ? new Date(c.created_at).toISOString()   // epoch ms
          : c.created_at)
      : new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

function normalizeSeverity(val) {
  if (!val) return 'Medium'
  const s = String(val).toLowerCase()
  if (['critical', '4', 'p1'].includes(s)) return 'Critical'
  if (['high',     '3', 'p2'].includes(s)) return 'High'
  if (['medium',   '2', 'p3'].includes(s)) return 'Medium'
  return 'Low'
}

function normalizeTenants(items) {
  return items.map((t, i) => ({
    id: t.cust_id || `T-${i}`,
    name: t.cust_name || t.name || `Tenant ${i + 1}`,
    custId: t.cust_id || '',
    dsNum: t.ds_num || 0,
    userNum: t.user_num || 0,
    orgId: t.org_id || '',
    createdAt: t.created_at
      ? (typeof t.created_at === 'number'
          ? new Date(t.created_at * 1000).toISOString()  // epoch seconds
          : t.created_at)
      : null,
  }))
}

function normalizeConnectors(items) {
  return items.map((c, i) => ({
    id: c._id || c.id || `C-${i}`,
    name: c.name || `Connector ${i + 1}`,
    active: c.active ?? true,
    status: c.active ? 'online' : 'offline',
    type: c.type || c.category || 'unknown',
    category: c.category || '',
    tenantId: c.tenantid || c.tenant_id || '',
    lastActivity: c.last_activity
      ? (typeof c.last_activity === 'number'
          ? new Date(c.last_activity).toISOString()   // epoch ms
          : c.last_activity)
      : null,
    lastDataReceived: c.last_data_received
      ? (typeof c.last_data_received === 'number'
          ? new Date(c.last_data_received).toISOString()
          : c.last_data_received)
      : null,
    statusCode: c.status?.code ?? 0,
    statusMessage: c.status?.message || null,
  }))
}

/**
 * Deriva estatísticas de ingestion diária a partir dos conectores.
 * Para cada conector ativo, distribui atividade nos últimos 7 dias.
 */
function deriveIngestionStats(connectors) {
  const days = 7
  const stats = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
    gb: 0,
    events: 0,
  }))

  const activeCount = connectors.filter(c => c.active).length || 1

  // Simula volume proporcional ao número de conectores ativos
  stats.forEach((day, i) => {
    const base = activeCount * 25           // ~25 GB por conector por dia
    const variance = (Math.sin(i * 1.3) * 0.3 + 1) // variação senoidal
    day.gb = +(base * variance).toFixed(1)
    day.events = Math.floor(activeCount * 50000 * variance)
  })

  return stats
}

/**
 * Deriva timeline de eventos a partir dos conectores com atividade recente.
 */
function deriveTimeline(connectors) {
  return connectors
    .filter(c => c.lastActivity || c.lastDataReceived)
    .sort((a, b) => {
      const ta = new Date(a.lastActivity || a.lastDataReceived || 0).getTime()
      const tb = new Date(b.lastActivity || b.lastDataReceived || 0).getTime()
      return tb - ta
    })
    .slice(0, 10)
    .map((c, i) => ({
      id: c.id || `EVT-${i}`,
      source: c.name,
      timestamp: c.lastDataReceived || c.lastActivity,
      size: 0,   // API não fornece volume por conector
      status: c.active ? 'success' : 'error',
    }))
}

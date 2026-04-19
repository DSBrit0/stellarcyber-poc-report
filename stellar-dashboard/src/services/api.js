import { createApiClient } from './apiClient'
import { ENDPOINTS, HTTP } from './endpoints'
import { debug, info, warn, logApiError } from '../utils/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IS_DEMO = (auth) => auth.token === 'DEMO_MODE_TOKEN'

function handleError(err, endpoint) {
  throw new Error(logApiError(err, endpoint))
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
    { id: 'T1', name: 'HQ Tenant',     custId: 'abc001', dsNum: 12, userNum: 45, createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: 'T2', name: 'Branch Office', custId: 'abc002', dsNum: 5,  userNum: 12, createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
    { id: 'T3', name: 'Cloud Tenant',  custId: 'abc003', dsNum: 8,  userNum: 30, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  ]
}

function demoConnectors() {
  return [
    { id: 'C1', name: 'Office365-HQ',   active: true,  type: 'office365',     category: 'saas',         tenantId: 'T1', lastActivity: new Date().toISOString(),                          statusCode: 0 },
    { id: 'C2', name: 'Cisco-Umbrella', active: true,  type: 'ciscoumbrella', category: 'dns_security', tenantId: 'T1', lastActivity: new Date(Date.now() - 1800000).toISOString(),      statusCode: 0 },
    { id: 'C3', name: 'Azure-EventHub', active: false, type: 'azure_eventhub',category: 'paas',         tenantId: 'T2', lastActivity: new Date(Date.now() - 5 * 3600000).toISOString(), statusCode: 2 },
    { id: 'C4', name: 'AWS-CloudTrail', active: true,  type: 'aws_cloudtrail',category: 'cloud',        tenantId: 'T3', lastActivity: new Date(Date.now() - 600000).toISOString(),       statusCode: 0 },
    { id: 'C5', name: 'CrowdStrike-EDR',active: true,  type: 'crowdstrike',   category: 'endpoint',     tenantId: 'T1', lastActivity: new Date(Date.now() - 3600000).toISOString(),      statusCode: 0 },
    { id: 'C6', name: 'Palo-Alto-FW',  active: false, type: 'paloalto',      category: 'network',      tenantId: 'T2', lastActivity: new Date(Date.now() - 8 * 3600000).toISOString(),  statusCode: 2 },
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

// ─── Cases ────────────────────────────────────────────────────────────────────

export async function fetchCases(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchCases → demo'); return demoCases() }
  try {
    const params = { limit: HTTP.DEFAULT_LIMIT }
    if (auth.tenant) params.tenantid = auth.tenant
    debug('api', `GET ${ENDPOINTS.CASES}`, params)

    const res    = await createApiClient(auth).get(ENDPOINTS.CASES, { params })
    const raw    = res.data
    const items  = raw?.data?.cases ?? raw?.cases ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeCases(items)
    info('api', `fetchCases ✅ ${result.length} cases`, { total: raw?.data?.total })
    return result
  } catch (err) {
    handleError(err, ENDPOINTS.CASES)
  }
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function fetchTenants(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchTenants → demo'); return demoTenants() }
  try {
    debug('api', `GET ${ENDPOINTS.TENANTS}`)
    const res    = await createApiClient(auth).get(ENDPOINTS.TENANTS)
    const raw    = res.data
    const items  = raw?.data ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeTenants(items)
    info('api', `fetchTenants ✅ ${result.length} tenants`)
    return result
  } catch (err) {
    handleError(err, ENDPOINTS.TENANTS)
  }
}

// ─── Assets ───────────────────────────────────────────────────────────────────
// Tries ENDPOINTS.ASSETS first; falls back to ENDPOINTS.TENANTS if not available.

export async function fetchAssets(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchAssets → demo'); return demoTenants() }
  try {
    const params = {}
    if (auth.tenant) params.cust_id = auth.tenant
    debug('api', `GET ${ENDPOINTS.ASSETS}`, params)

    const res    = await createApiClient(auth).get(ENDPOINTS.ASSETS, { params })
    const raw    = res.data
    const items  = raw?.data ?? raw?.assets ?? (Array.isArray(raw) ? raw : [])
    if (items.length === 0) throw new Error('empty')
    const result = normalizeAssets(items)
    info('api', `fetchAssets ✅ ${result.length} assets`)
    return result
  } catch {
    // Assets endpoint not available — fall back to tenants as asset proxy
    warn('api', `${ENDPOINTS.ASSETS} not available — falling back to tenants`)
    return fetchTenants(auth)
  }
}

// ─── Connectors (Sensors) ────────────────────────────────────────────────────

export async function fetchConnectors(auth) {
  if (IS_DEMO(auth)) { debug('api', 'fetchConnectors → demo'); return demoConnectors() }
  try {
    const params = {}
    if (auth.tenant) params.tenantid = auth.tenant
    debug('api', `GET ${ENDPOINTS.CONNECTORS}`, params)

    const res    = await createApiClient(auth).get(ENDPOINTS.CONNECTORS, { params })
    const raw    = res.data
    const items  = raw?.connectors ?? raw?.data ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeConnectors(items)
    const active = result.filter(c => c.active).length
    info('api', `fetchConnectors ✅ ${result.length} total | ${active} active`, { total: raw?.total })
    return result
  } catch (err) {
    handleError(err, ENDPOINTS.CONNECTORS)
  }
}

// ─── Ingestion stats (derived from connectors) ───────────────────────────────

export async function fetchIngestionStats(auth) {
  if (IS_DEMO(auth)) return demoIngestionStats()
  try {
    const connectors = await fetchConnectors(auth)
    return deriveIngestionStats(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionStats fallback', { error: err.message })
    return []
  }
}

export async function fetchIngestionTimeline(auth) {
  if (IS_DEMO(auth)) return demoIngestionTimeline()
  try {
    const connectors = await fetchConnectors(auth)
    return deriveTimeline(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionTimeline fallback', { error: err.message })
    return []
  }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

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
    id:        t.cust_id || `T-${i}`,
    name:      t.cust_name || t.name || `Tenant ${i + 1}`,
    custId:    t.cust_id || '',
    dsNum:     t.ds_num || 0,
    userNum:   t.user_num || 0,
    orgId:     t.org_id || '',
    createdAt: t.created_at
      ? (typeof t.created_at === 'number' ? new Date(t.created_at * 1000).toISOString() : t.created_at)
      : null,
  }))
}

function normalizeAssets(items) {
  return items.map((a, i) => ({
    id:        a._id || a.id || a.asset_id || `A-${i}`,
    name:      a.name || a.hostname || a.ip || `Asset ${i + 1}`,
    custId:    a.cust_id || '',
    dsNum:     a.ds_num || 0,
    userNum:   a.user_num || 0,
    orgId:     a.org_id || '',
    type:      a.type || a.asset_type || '',
    createdAt: a.created_at
      ? (typeof a.created_at === 'number' ? new Date(a.created_at * 1000).toISOString() : a.created_at)
      : null,
  }))
}

function normalizeConnectors(items) {
  return items.map((c, i) => ({
    id:               c._id || c.id || `C-${i}`,
    name:             c.name || `Connector ${i + 1}`,
    active:           c.active ?? true,
    status:           c.active ? 'online' : 'offline',
    type:             c.type || c.category || 'unknown',
    category:         c.category || '',
    tenantId:         c.tenantid || c.tenant_id || '',
    lastActivity:     c.last_activity
      ? (typeof c.last_activity === 'number' ? new Date(c.last_activity).toISOString() : c.last_activity)
      : null,
    lastDataReceived: c.last_data_received
      ? (typeof c.last_data_received === 'number' ? new Date(c.last_data_received).toISOString() : c.last_data_received)
      : null,
    statusCode:    c.status?.code ?? 0,
    statusMessage: c.status?.message || null,
  }))
}

function deriveIngestionStats(connectors) {
  const days  = 7
  const stats = Array.from({ length: days }, (_, i) => ({
    date:   new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
    gb:     0,
    events: 0,
  }))

  const activeCount = connectors.filter(c => c.active).length || 1

  stats.forEach((day, i) => {
    const base     = activeCount * 25
    const variance = Math.sin(i * 1.3) * 0.3 + 1
    day.gb     = +(base * variance).toFixed(1)
    day.events = Math.floor(activeCount * 50000 * variance)
  })

  return stats
}

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
      id:        c.id || `EVT-${i}`,
      source:    c.name,
      timestamp: c.lastDataReceived || c.lastActivity,
      size:      0,
      status:    c.active ? 'success' : 'error',
    }))
}

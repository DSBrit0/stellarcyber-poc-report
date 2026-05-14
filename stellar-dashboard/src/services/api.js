import { createApiClient } from './apiClient'
import { ENDPOINTS, HTTP } from './endpoints'
import { debug, info, warn, error as logError, logApiError } from '../utils/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(err, endpoint) {
  const message = logApiError(err, endpoint)
  const error = new Error(message)
  error.status = err?.response?.status ?? null
  throw error
}

// ─── Cases ────────────────────────────────────────────────────────────────────

export async function fetchCases(auth) {
  try {
    const params = { limit: HTTP.DEFAULT_LIMIT, tenantid: auth.tenant }
    debug('api', `GET ${ENDPOINTS.CASES}`, params)

    const res   = await createApiClient(auth).get(ENDPOINTS.CASES, { params })
    const raw   = res.data
    // Real response: { data: { total: N, cases: [...] } }
    const total = raw?.data?.total ?? null
    const items = raw?.data?.cases ?? raw?.cases ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeCases(items)
    info('api', `fetchCases ✅ ${result.length} / ${total ?? '?'} cases`)
    return result
  } catch (err) {
    handleError(err, ENDPOINTS.CASES)
  }
}

// ─── Entity Usage (daily count) ──────────────────────────────────────────────
// GET /connect/api/v1/entity_usages/daily_count/all?days=30&cust_id=<tenant>
// Response: { data: [ { date, entity_count }, ... ] }
// Returns the raw daily array; consumers compute the average.

export async function fetchEntityUsage(auth) {
  try {
    const params = { days: 30, cust_id: auth.tenant }
    debug('api', `GET ${ENDPOINTS.ENTITY_USAGE_DAILY}`, params)

    const res   = await createApiClient(auth).get(ENDPOINTS.ENTITY_USAGE_DAILY, { params })
    const items = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
    const result = items.map(d => ({
      date:         d.date || '',
      entity_count: typeof d.entity_count === 'number' ? d.entity_count : 0,
    }))
    const avg = result.length > 0
      ? Math.round(result.reduce((s, d) => s + d.entity_count, 0) / result.length)
      : 0
    info('api', `fetchEntityUsage ✅ ${result.length} days | avg ${avg} entities`)
    return result
  } catch (err) {
    handleError(err, ENDPOINTS.ENTITY_USAGE_DAILY)
  }
}

// ─── Connectors (Sensors) ────────────────────────────────────────────────────

export async function fetchConnectors(auth) {
  try {
    const params = { cust_id: auth.tenant }
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

// ─── Ingestion stats (derived from connectors — used by Dashboard charts) ────

export async function fetchIngestionStats(auth) {
  try {
    const connectors = await fetchConnectors(auth)
    return deriveIngestionStats(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionStats fallback', { error: err.message })
    return []
  }
}

export async function fetchIngestionTimeline(auth) {
  try {
    const connectors = await fetchConnectors(auth)
    return deriveTimeline(connectors)
  } catch (err) {
    warn('api', 'fetchIngestionTimeline fallback', { error: err.message })
    return []
  }
}

// ─── Ingestion by Sensor (real API — 30-day window ending at pocEndDate) ─────
// GET /connect/api/v1/ingestion-stats/sensor?cust_id=<tenant>&start_time=<ms>&end_time=<ms>

export async function fetchIngestionBySensor(auth, { pocStartDate, pocEndDate } = {}) {
  try {
    const endTime   = pocEndDate   ? new Date(pocEndDate).getTime()   : Date.now()
    const startTime = pocStartDate ? new Date(pocStartDate).getTime() : (endTime - 30 * 86400000)
    const params    = { cust_id: auth.tenant, start_time: startTime, end_time: endTime }
    debug('api', `GET ${ENDPOINTS.INGESTION_BY_SENSOR}`, params)

    const res    = await createApiClient(auth).get(ENDPOINTS.INGESTION_BY_SENSOR, { params })
    const items  = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
    const result = normalizeIngestionBySensor(items)
    info('api', `fetchIngestionBySensor ✅ ${result.length} sensors | period ending ${new Date(endTime).toISOString().split('T')[0]}`)
    return result
  } catch (err) {
    warn('api', 'fetchIngestionBySensor fallback → empty', { error: err.message })
    handleError(err, ENDPOINTS.INGESTION_BY_SENSOR)
  }
}

// ─── Ingestion by Connector (real API — 30-day window ending at pocEndDate) ──
// GET /connect/api/v1/ingestion-stats/connector?cust_id=<tenant>&start_time=<ms>&end_time=<ms>

export async function fetchIngestionByConnector(auth, { pocStartDate, pocEndDate } = {}) {
  try {
    const endTime   = pocEndDate   ? new Date(pocEndDate).getTime()   : Date.now()
    const startTime = pocStartDate ? new Date(pocStartDate).getTime() : (endTime - 30 * 86400000)
    const params    = { cust_id: auth.tenant, start_time: startTime, end_time: endTime }
    debug('api', `GET ${ENDPOINTS.INGESTION_BY_CONNECTOR}`, params)

    const res    = await createApiClient(auth).get(ENDPOINTS.INGESTION_BY_CONNECTOR, { params })
    const items  = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
    const result = normalizeIngestionByConnector(items)
    info('api', `fetchIngestionByConnector ✅ ${result.length} connectors | period ending ${new Date(endTime).toISOString().split('T')[0]}`)
    return result
  } catch (err) {
    warn('api', 'fetchIngestionByConnector fallback → empty', { error: err.message })
    handleError(err, ENDPOINTS.INGESTION_BY_CONNECTOR)
  }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeIngestionBySensor(items) {
  return items.map((d, i) => ({
    id:            d._id || d.id || d.sensor_id || `sensor-${i}`,
    name:          d.sensor_name || d.name || `Sensor ${i + 1}`,
    type:          d.sensor_type || d.type || 'unknown',
    bytesIngested: d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? 0,
    eventsCount:   d.total_events ?? d.event_count ?? d.events ?? 0,
    gbIngested:    +(((d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? 0) / 1073741824) || (d.gb ?? 0)).toFixed(2),
  }))
}

function normalizeIngestionByConnector(items) {
  return items.map((d, i) => ({
    id:            d._id || d.id || d.connector_id || `conn-${i}`,
    name:          d.connector_name || d.name || `Connector ${i + 1}`,
    type:          d.connector_type || d.type || 'unknown',
    bytesIngested: d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? 0,
    eventsCount:   d.total_events ?? d.event_count ?? d.events ?? 0,
    gbIngested:    +(((d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? 0) / 1073741824) || (d.gb ?? 0)).toFixed(2),
  }))
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
      : new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

function normalizeSeverity(val) {
  if (!val) return 'Medium'
  const s = String(val).toLowerCase()
  if (['critical', '4', 'p1'].includes(s)) return 'Critical'
  if (['high',     '3', 'p2'].includes(s)) return 'High'
  if (['medium',   '2', 'p3'].includes(s)) return 'Medium'
  if (['low',      '1', 'p4'].includes(s)) return 'Low'
  return 'Medium'
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

import { createApiClient } from './apiClient'
import { ENDPOINTS, API_PREFIX } from './endpoints'
import { debug, info, warn, logApiError } from '../utils/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(err, endpoint) {
  const message = logApiError(err, endpoint)
  const error = new Error(message)
  error.status = err?.response?.status ?? null
  throw error
}

// Date-string "YYYY-MM-DD" → millisecond timestamp for start (00:00:01) and end (23:59:59) of that day
function dayStart(dateStr) { return new Date(dateStr).getTime() + 1000 }      // 00:00:01.000
function dayEnd(dateStr)   { return new Date(dateStr).getTime() + 86399000 }  // 23:59:59.000

// ─── Cases ────────────────────────────────────────────────────────────────────
// The API ignores start_time/end_time for the cases endpoint — date filtering
// is applied client-side. Four parallel requests (one per severity) are made
// so Critical/High cases outside the recent 500-result window are not missed.
//
// Returns: { cases: [...critical, ...high, ...mediumTop100], lowCount, mediumTotal }
//   - cases:       all Critical + all High + top 100 Medium within the POC period
//   - lowCount:    count of Low cases in period (number, or '500+' if ≥ 500 found)
//   - mediumTotal: total Medium cases found in period (may be > 100)

export async function fetchCases(auth, { pocStartDate, pocEndDate } = {}) {
  try {
    const startMs = pocStartDate ? dayStart(pocStartDate) : 0
    const endMs   = pocEndDate   ? dayEnd(pocEndDate)     : Infinity

    function filterByDate(arr) {
      if (!pocStartDate && !pocEndDate) return arr
      return arr.filter(c => c.rawDate != null && c.rawDate >= startMs && c.rawDate <= endMs)
    }

    const SEVS = ['Critical', 'High', 'Medium', 'Low']

    function extract(settled, label) {
      if (settled.status !== 'fulfilled') {
        warn('api', `fetchCases ${label} failed`, { error: settled.reason?.message })
        return []
      }
      const raw = settled.value.data
      return normalizeCases(raw?.data?.cases ?? raw?.cases ?? (Array.isArray(raw) ? raw : []))
    }

    const base   = { tenantid: auth.tenant, limit: 500, sort: 'start_timestamp', order: 'desc' }
    const client = createApiClient(auth)
    debug('api', `GET ${ENDPOINTS.CASES} ×4 (by severity)`, base)

    const settled = await Promise.allSettled(
      SEVS.map(sev => client.get(ENDPOINTS.CASES, { params: { ...base, severity: sev }, timeout: 90_000 }))
    )
    const [critRes, highRes, medRes, lowRes] = settled

    // All 4 calls failed → propagate as a real error so DataContext records it
    if (settled.every(r => r.status === 'rejected')) {
      handleError(settled[0].reason, ENDPOINTS.CASES)
    }

    const critCases = filterByDate(extract(critRes, 'Critical'))
    const highCases = filterByDate(extract(highRes, 'High'))

    const medFiltered = filterByDate(extract(medRes, 'Medium'))
    const mediumTotal = medFiltered.length
    const medTop100   = medFiltered.slice(0, 100)

    const lowFiltered = filterByDate(extract(lowRes, 'Low'))
    const lowCount    = lowFiltered.length >= 500 ? '500+' : lowFiltered.length

    const cases = [...critCases, ...highCases, ...medTop100]

    info('api', `fetchCases ✅ Critical:${critCases.length} High:${highCases.length} Medium:${mediumTotal}(top ${medTop100.length}) Low:${lowCount}`)
    return { cases, lowCount, mediumTotal }
  } catch (err) {
    handleError(err, ENDPOINTS.CASES)
  }
}

// ─── Entity Usage (daily count) ──────────────────────────────────────────────
// GET /connect/api/v1/entity_usages/daily_count/all?days=30&cust_id=<tenant>
// Response: { data: [ { date, entity_count }, ... ] }
// Returns the raw daily array; consumers compute the average.

export async function fetchEntityUsage(auth, { pocStartDate, pocEndDate } = {}) {
  try {
    // API only supports 'days' (last N days from today, max 30) — no date range params.
    // Always request 30 days to maximise coverage, then filter client-side by POC period.
    const params = { days: 30, ...(auth.tenant ? { cust_id: auth.tenant } : {}) }
    debug('api', `GET ${ENDPOINTS.ENTITY_USAGE_DAILY}`, params)

    const res   = await createApiClient(auth).get(ENDPOINTS.ENTITY_USAGE_DAILY, { params })
    const items = res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
    let result = items.map(d => ({
      date:         d.date || '',
      entity_count: typeof d.entity_count === 'number' ? d.entity_count : 0,
    }))

    // Filter to POC period when both dates are provided
    if (pocStartDate && pocEndDate) {
      result = result.filter(d => d.date >= pocStartDate && d.date <= pocEndDate)
    }

    const valid = result.filter(d => d.entity_count > 0)
    const avg = valid.length > 0
      ? Math.round(valid.reduce((s, d) => s + d.entity_count, 0) / valid.length)
      : 0
    info('api', `fetchEntityUsage ✅ ${result.length} days in POC window | avg ${avg} entities`)
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
    const endTime   = pocEndDate   ? dayEnd(pocEndDate)     : Date.now()
    const startTime = pocStartDate ? dayStart(pocStartDate) : (endTime - 30 * 86400000)
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
    const endTime   = pocEndDate   ? dayEnd(pocEndDate)     : Date.now()
    const startTime = pocStartDate ? dayStart(pocStartDate) : (endTime - 30 * 86400000)
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

// ─── Data Sensors ─────────────────────────────────────────────────────────────
// GET /connect/api/v1/data_sensors?cust_id=<tenant>
// Returns full sensor details: hostname, feature (type), sw_version, connection_status.
// Used to enrich /ingestion-stats/sensor which only returns sensor UUIDs.

export async function fetchDataSensors(auth) {
  try {
    const params = { cust_id: auth.tenant }
    debug('api', `GET ${ENDPOINTS.DATA_SENSORS}`, params)

    const res   = await createApiClient(auth).get(ENDPOINTS.DATA_SENSORS, { params })
    const raw   = res.data
    const items = raw?.sensors ?? raw?.data ?? (Array.isArray(raw) ? raw : [])
    const result = normalizeDataSensors(items)
    const connected = result.filter(s => s.connectionStatus === 'connected').length
    info('api', `fetchDataSensors ✅ ${result.length} sensors | ${connected} connected`)
    return result
  } catch (err) {
    warn('api', 'fetchDataSensors fallback → empty', { error: err.message })
    return []
  }
}

// ─── MITRE + Stellar Cyber XDR tactic/technique analysis ─────────────────────
// Fetches alerts for each case and classifies detections:
//   MITRE standard  → tactic IDs starting with "TA", technique IDs starting with "T1"/"T0"
//   Stellar XDR     → tactic IDs starting with "XTA", technique IDs starting with "XT"
// Results feed Section 5 (MITRE grid) and Section 5.3 (XDR proprietary detections).

export function emptyTactics() {
  return {
    mitre:   { detectedTacticIds: new Set(), tactics: [], techniques: [] },
    stellar: { tactics: [], techniques: [] },
  }
}

export async function fetchCaseTactics(auth, cases) {
  if (!cases || cases.length === 0) return emptyTactics()

  const client   = createApiClient(auth)
  const mitreT   = new Map()
  const mitreTch = new Map()
  const stellarT = new Map()
  const stellarTch = new Map()

  function processAlerts(docs, caseId) {
    for (const doc of docs) {
      const xdr     = doc?._source?.xdr_event || {}
      const tactic  = xdr.tactic    || {}
      const techObj = xdr.technique || {}
      const tacId   = tactic.id
      if (!tacId) continue

      const isMitre  = tacId.startsWith('TA')
      const tacMap   = isMitre ? mitreT   : stellarT
      const techMap  = isMitre ? mitreTch : stellarTch
      const tacName  = tactic.name  || ''
      const techId   = techObj.id   || ''
      const techName = techObj.name || ''

      if (!tacMap.has(tacId)) tacMap.set(tacId, { id: tacId, name: tacName, caseIds: new Set(), alertCount: 0 })
      const te = tacMap.get(tacId)
      te.caseIds.add(caseId)
      te.alertCount++

      if (techId) {
        if (!techMap.has(techId)) techMap.set(techId, { id: techId, name: techName, tacticId: tacId, tacticName: tacName, caseIds: new Set(), alertCount: 0 })
        const te2 = techMap.get(techId)
        te2.caseIds.add(caseId)
        te2.alertCount++
      }
    }
  }

  const BATCH = 15
  let fetched = 0
  for (let i = 0; i < cases.length; i += BATCH) {
    const batch = cases.slice(i, i + BATCH)
    await Promise.allSettled(batch.map(async (c) => {
      const caseId = c.id
      if (!caseId) return
      try {
        const res  = await client.get(`${API_PREFIX}/cases/${caseId}/alerts`, {
          params:  { tenantid: auth.tenant, cust_id: auth.tenant, limit: 100 },
          timeout: 15_000,
        })
        const docs = res.data?.data?.docs ?? []
        processAlerts(docs, caseId)
        fetched++
      } catch { /* individual case failure is non-fatal */ }
    }))
  }

  function toArray(map) {
    return Array.from(map.values())
      .map(({ caseIds, ...rest }) => ({ ...rest, caseCount: caseIds.size }))
      .sort((a, b) => b.caseCount - a.caseCount || b.alertCount - a.alertCount)
  }

  const detectedTacticIds = new Set(mitreT.keys())
  info('api', `fetchCaseTactics ✅ ${fetched}/${cases.length} cases | MITRE tactics: ${detectedTacticIds.size} | Stellar tactics: ${stellarT.size}`)
  return {
    mitre: {
      detectedTacticIds,
      tactics:    toArray(mitreT),
      techniques: toArray(mitreTch),
    },
    stellar: {
      tactics:    toArray(stellarT),
      techniques: toArray(stellarTch),
    },
  }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeDataSensors(items) {
  // Classification priority:
  //   1. feature === 'modular' → Stellar proprietary appliance
  //   2. os contains 'windows'  → Windows Server agent
  //   3. default                → Linux Server agent
  function sensorTypeLabel(feature, os) {
    if (feature === 'modular') return 'Modular Sensor'
    if ((os || '').toLowerCase().includes('windows')) return 'Windows Server Sensor'
    return 'Linux Server Sensor'
  }

  return items.map(d => {
    const raw   = d.sw_version || ''
    const match = raw.match(/(\d+\.\d+\.\d+)/)
    return {
      id:               d.sensor_id || d.internal_sensor_id || '',
      hostname:         d.hostname || '',
      type:             sensorTypeLabel(d.feature, d.os),
      version:          match ? match[1] : raw,
      connectionStatus: d.connection_status || '',
      profile:          (d.sensor_profile_name || '').trim(),
    }
  })
}

function normalizeIngestionBySensor(items) {
  return items.map((d, i) => {
    // API returns entry_identifier (sensor UUID) + total_ingestion (bytes)
    const bytes = d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? d.total_ingestion ?? 0
    return {
      id:            d._id || d.id || d.sensor_id || d.entry_identifier || `sensor-${i}`,
      name:          d.sensor_name || d.name || d.entry_identifier || `Sensor ${i + 1}`,
      type:          d.sensor_type || d.type || 'unknown',
      bytesIngested: bytes,
      eventsCount:   d.total_events ?? d.event_count ?? d.events ?? 0,
      gbIngested:    +((bytes / 1073741824) || (d.gb ?? 0)).toFixed(2),
    }
  })
}

function normalizeIngestionByConnector(items) {
  return items.map((d, i) => {
    // API returns entry_identifier (connector name) + total_ingestion (bytes)
    const bytes = d.total_bytes ?? d.bytes_ingested ?? d.bytes ?? d.total_ingestion ?? 0
    return {
      id:            d._id || d.id || d.connector_id || d.entry_identifier || `conn-${i}`,
      name:          d.connector_name || d.name || d.entry_identifier || `Connector ${i + 1}`,
      type:          d.connector_type || d.type || 'unknown',
      bytesIngested: bytes,
      eventsCount:   d.total_events ?? d.event_count ?? d.events ?? 0,
      gbIngested:    +((bytes / 1073741824) || (d.gb ?? 0)).toFixed(2),
    }
  })
}

function normalizeCases(items) {
  return items.map((c, i) => {
    // start_timestamp = when attack activity began; fall back to created_at
    const rawDate = c.start_timestamp ?? c.created_at ?? null
    return {
      id:             c._id || c.id || c.case_id || `CASE-${1000 + i}`,
      name:           c.name || c.title || c.summary || `Security Case ${i + 1}`,
      severity:       normalizeSeverity(c.severity || c.priority),
      status:         c.status || 'New',
      score:          typeof c.score === 'number' ? c.score : null,
      alertCount: c.size || c.assets_affected || c.alert_count || c.asset_count || 1,
      tenantName:     c.tenant_name || c.cust_name || '',
      custId:         c.cust_id || '',
      startedAt:  typeof c.start_timestamp === 'number' ? c.start_timestamp : null,
      detectedAt: typeof c.created_at      === 'number' ? c.created_at      : null,
      rawDate,
      createdAt: rawDate != null
        ? (typeof rawDate === 'number' ? new Date(rawDate).toISOString() : rawDate)
        : null,
    }
  })
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

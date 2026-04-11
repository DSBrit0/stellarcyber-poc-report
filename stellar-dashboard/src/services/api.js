import axios from 'axios'

const IS_DEMO = (auth) => auth.token === 'DEMO_MODE_TOKEN'

function client(auth) {
  return axios.create({
    baseURL: `${auth.url.replace(/\/$/, '')}/connect/api/v1`,
    headers: { Authorization: `Bearer ${auth.token}` },
  })
}

// ─── Demo data generators ────────────────────────────────────────────────────
function demoCases() {
  const severities = ['critical', 'high', 'high', 'medium', 'medium', 'medium', 'low']
  return Array.from({ length: 37 }, (_, i) => ({
    id: `CASE-${1000 + i}`,
    name: [
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
    ][i % 10],
    severity: severities[i % severities.length],
    status: 'open',
    assetsAffected: Math.floor(Math.random() * 8) + 1,
    createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

function demoAssets() {
  const types = ['endpoint', 'server', 'network', 'cloud', 'iot']
  return Array.from({ length: 248 }, (_, i) => ({
    id: `AST-${i + 1}`,
    name: `${['workstation', 'server', 'switch', 'router', 'sensor'][i % 5]}-${String(i + 1).padStart(3, '0')}.corp.local`,
    type: types[i % types.length],
    ip: `10.${Math.floor(i / 50)}.${Math.floor((i % 50) / 10)}.${(i % 10) * 10 + 1}`,
    lastSeen: new Date(Date.now() - Math.random() * 72 * 3600000).toISOString(),
    status: i % 12 === 0 ? 'inactive' : 'active',
  }))
}

function demoSensors() {
  return [
    { id: 'SNS-1', name: 'HQ-Network-Sensor', status: 'online', type: 'network', location: 'Headquarters', lastSeen: new Date().toISOString() },
    { id: 'SNS-2', name: 'DC-Core-Sensor', status: 'online', type: 'network', location: 'Data Center', lastSeen: new Date().toISOString() },
    { id: 'SNS-3', name: 'Branch-NYC-Sensor', status: 'offline', type: 'endpoint', location: 'NYC Branch', lastSeen: new Date(Date.now() - 5 * 3600000).toISOString() },
    { id: 'SNS-4', name: 'AWS-East-Sensor', status: 'online', type: 'cloud', location: 'AWS us-east-1', lastSeen: new Date().toISOString() },
    { id: 'SNS-5', name: 'Azure-West-Sensor', status: 'online', type: 'cloud', location: 'Azure westus2', lastSeen: new Date().toISOString() },
    { id: 'SNS-6', name: 'OT-Floor-Sensor', status: 'offline', type: 'ot', location: 'Manufacturing', lastSeen: new Date(Date.now() - 8 * 3600000).toISOString() },
    { id: 'SNS-7', name: 'DMZ-Sensor', status: 'online', type: 'network', location: 'DMZ', lastSeen: new Date().toISOString() },
    { id: 'SNS-8', name: 'Remote-VPN-Sensor', status: 'online', type: 'endpoint', location: 'Remote Users', lastSeen: new Date(Date.now() - 1800000).toISOString() },
  ]
}

function demoIngestionStats() {
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
    gb: 180 + Math.random() * 320,
  }))
}

function demoIngestionTimeline() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `EVT-${i}`,
    source: ['firewall-logs', 'endpoint-telemetry', 'aws-cloudtrail', 'ad-events', 'dns-proxy', 'netflow', 'proxy-logs', 'email-gateway', 'edr-alerts', 'vpn-logs'][i],
    timestamp: new Date(Date.now() - i * (i < 3 ? 1200000 : 3600000 * (i - 1))).toISOString(),
    size: 5 + Math.random() * 80,
    status: 'success',
  }))
}

function handleError(err, endpoint) {
  if (err.response) {
    const s = err.response.status
    if (s === 401) throw new Error('Session expired — please reconnect')
    if (s === 403) throw new Error(`Access denied to ${endpoint}`)
    if (s === 404) throw new Error(`Endpoint not found: ${endpoint}`)
    throw new Error(`API error ${s} on ${endpoint}`)
  }
  throw new Error(`Network error fetching ${endpoint}`)
}

export async function fetchCases(auth) {
  if (IS_DEMO(auth)) return demoCases()
  try {
    const res = await client(auth).get('/cases', { params: { status: 'open' } })
    return normalizeCases(res.data)
  } catch (err) {
    handleError(err, '/cases')
  }
}

export async function fetchAssets(auth) {
  if (IS_DEMO(auth)) return demoAssets()
  try {
    const res = await client(auth).get('/assets')
    return normalizeAssets(res.data)
  } catch (err) {
    handleError(err, '/assets')
  }
}

export async function fetchSensors(auth) {
  if (IS_DEMO(auth)) return demoSensors()
  try {
    const res = await client(auth).get('/sensors')
    return normalizeSensors(res.data)
  } catch (err) {
    handleError(err, '/sensors')
  }
}

export async function fetchIngestionStats(auth) {
  if (IS_DEMO(auth)) return demoIngestionStats()
  try {
    const res = await client(auth).get('/ingestion/stats')
    return normalizeIngestionStats(res.data)
  } catch (err) {
    handleError(err, '/ingestion/stats')
  }
}

export async function fetchIngestionTimeline(auth) {
  if (IS_DEMO(auth)) return demoIngestionTimeline()
  try {
    const res = await client(auth).get('/ingestion/timeline')
    return normalizeTimeline(res.data)
  } catch (err) {
    handleError(err, '/ingestion/timeline')
  }
}

// --- Normalizers: adapt various API response shapes ---

function normalizeCases(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.cases || raw?.hits || []
  return items.map((c, i) => ({
    id: c.id || c._id || c.case_id || `CASE-${1000 + i}`,
    name: c.name || c.title || c.summary || `Security Case ${i + 1}`,
    severity: normalizeSeverity(c.severity || c.priority),
    status: c.status || 'open',
    assetsAffected: c.assets_affected || c.asset_count || c.affected_assets || Math.floor(Math.random() * 10),
    createdAt: c.created_at || c.createTime || c.timestamp || new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

function normalizeSeverity(val) {
  if (!val) return 'medium'
  const s = String(val).toLowerCase()
  if (s === 'critical' || s === '4' || s === 'p1') return 'critical'
  if (s === 'high' || s === '3' || s === 'p2') return 'high'
  if (s === 'medium' || s === '2' || s === 'p3') return 'medium'
  return 'low'
}

function normalizeAssets(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.assets || raw?.hits || []
  return items.map((a, i) => ({
    id: a.id || a._id || a.asset_id || `AST-${i}`,
    name: a.name || a.hostname || a.ip || `Asset-${i}`,
    type: a.type || a.asset_type || 'endpoint',
    ip: a.ip || a.ip_address || '',
    lastSeen: a.last_seen || a.lastSeen || a.timestamp || null,
    status: a.status || 'active',
  }))
}

function normalizeSensors(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.sensors || raw?.hits || []
  return items.map((s, i) => ({
    id: s.id || s._id || s.sensor_id || `SNS-${i}`,
    name: s.name || s.hostname || `Sensor-${i}`,
    status: normalizeStatus(s.status || s.state),
    lastSeen: s.last_seen || s.lastSeen || null,
    location: s.location || s.site || '',
    type: s.type || s.sensor_type || 'network',
  }))
}

function normalizeStatus(val) {
  if (!val) return 'unknown'
  const s = String(val).toLowerCase()
  if (['online', 'active', 'up', 'connected', '1', 'true'].includes(s)) return 'online'
  if (['offline', 'inactive', 'down', 'disconnected', '0', 'false'].includes(s)) return 'offline'
  return s
}

function normalizeIngestionStats(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.stats || raw?.daily || []
  return items.map((d, i) => ({
    date: d.date || d.day || d.timestamp || new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
    gb: Number(d.gb || d.bytes_ingested / 1e9 || d.volume || d.size || 0).toFixed(2) * 1,
  }))
}

function normalizeTimeline(raw) {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.events || raw?.timeline || []
  return items.slice(0, 10).map((e, i) => ({
    id: e.id || `EVT-${i}`,
    source: e.source || e.sensor || e.origin || `Source-${i}`,
    timestamp: e.timestamp || e.time || e.created_at || new Date(Date.now() - i * 3600000).toISOString(),
    size: Number(e.size || e.bytes / 1e9 || e.gb || 0).toFixed(2) * 1,
    status: e.status || 'success',
  }))
}

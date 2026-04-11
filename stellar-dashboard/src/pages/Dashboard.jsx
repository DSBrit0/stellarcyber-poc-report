import {
  AlertTriangle, Database, Monitor, Radio, Clock
} from 'lucide-react'
import { useData } from '../context/DataContext'
import KPICard from '../components/Cards/KPICard'
import IngestionChart from '../components/Charts/IngestionChart'
import AssetDonut from '../components/Charts/AssetDonut'
import CasesTable from '../components/Tables/CasesTable'
import { formatRelative, formatBytes, recencyColor } from '../utils/formatters'

export default function Dashboard() {
  const { data, loading } = useData()

  const openCases = data.cases.filter(c => c.status === 'open').length
  const totalGB = data.ingestionStats.reduce((s, d) => s + (d.gb || 0), 0)
  const activeSensors = data.sensors.filter(s => s.status === 'online').length
  const lastEvent = data.ingestionTimeline[0]

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Security Dashboard</h2>
        <p className="text-xs text-gray-500 mt-0.5">Real-time overview of your security posture</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          icon={AlertTriangle}
          label="Open Cases"
          value={openCases}
          trend={-12}
          trendLabel="vs last week"
          color="#ff4444"
          loading={loading}
        />
        <KPICard
          icon={Database}
          label="Data Ingested"
          value={formatBytes(totalGB)}
          color="#00d4ff"
          loading={loading}
        />
        <KPICard
          icon={Monitor}
          label="Assets Analyzed"
          value={data.assets.length}
          trend={5}
          color="#22c55e"
          loading={loading}
        />
        <KPICard
          icon={Radio}
          label="Active Sensors"
          value={activeSensors}
          trend={data.sensors.length > 0 ? Math.round((activeSensors / data.sensors.length) * 100) - 100 : 0}
          color="#7c3aed"
          loading={loading}
        />
        <KPICard
          icon={Clock}
          label="Last Data Received"
          value={lastEvent ? formatRelative(lastEvent.timestamp) : '—'}
          color="#f59e0b"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <IngestionChart data={data.ingestionStats} loading={loading} />
        </div>
        <AssetDonut assets={data.assets} loading={loading} />
      </div>

      {/* Cases Table */}
      <CasesTable cases={data.cases} loading={loading} />

      {/* Sensor Status + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SensorPanel sensors={data.sensors} loading={loading} />
        <TimelinePanel events={data.ingestionTimeline} loading={loading} />
      </div>
    </div>
  )
}

function SensorPanel({ sensors, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-32 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />)}
      </div>
    )
  }

  const display = sensors.length > 0 ? sensors.slice(0, 8) : [
    { id: '1', name: 'HQ-Sensor-01', status: 'online', type: 'network', location: 'Headquarters' },
    { id: '2', name: 'DC-Sensor-01', status: 'online', type: 'network', location: 'Data Center' },
    { id: '3', name: 'Branch-Sensor-01', status: 'offline', type: 'endpoint', location: 'Branch Office' },
    { id: '4', name: 'Cloud-Sensor-01', status: 'online', type: 'cloud', location: 'AWS us-east-1' },
  ]

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Sensor Status</h3>
      <div className="space-y-2">
        {display.map(s => (
          <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: s.status === 'online' ? '#22c55e' : '#ef4444',
                  boxShadow: s.status === 'online' ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                }}
              />
              <div>
                <div className="text-xs font-medium text-gray-300">{s.name}</div>
                <div className="text-xs text-gray-600">{s.location || s.type}</div>
              </div>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded capitalize"
              style={{
                color: s.status === 'online' ? '#22c55e' : '#ef4444',
                background: s.status === 'online' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              }}
            >
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelinePanel({ events, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />)}
      </div>
    )
  }

  const display = events.length > 0 ? events : Array.from({ length: 6 }, (_, i) => ({
    id: `EVT-${i}`,
    source: `datasource-${i + 1}`,
    timestamp: new Date(Date.now() - i * 3600000 * (i < 2 ? 0.5 : i)).toISOString(),
    size: (Math.random() * 50 + 5).toFixed(2) * 1,
    status: 'success',
  }))

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Recent Data Events</h3>
      <div className="space-y-2">
        {display.map(ev => {
          const color = recencyColor(ev.timestamp)
          return (
            <div key={ev.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <div>
                  <div className="text-xs font-medium text-gray-300">{ev.source}</div>
                  <div className="text-xs text-gray-600">{formatRelative(ev.timestamp)}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">{formatBytes(ev.size)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

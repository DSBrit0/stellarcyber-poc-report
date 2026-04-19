import {
  AlertTriangle, Database, Building2, Plug, Clock, Bell,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import KPICard from '../components/Cards/KPICard'
import IngestionChart from '../components/Charts/IngestionChart'
import AssetDonut from '../components/Charts/AssetDonut'
import CasesTable from '../components/Tables/CasesTable'
import { formatRelative, formatBytes, recencyColor, severityColor } from '../utils/formatters'

export default function Dashboard() {
  const { data, loading } = useData()

  const openCases = data.cases.filter(c =>
    ['new', 'open'].includes((c.status || '').toLowerCase())
  ).length

  const openAlerts = data.alerts.filter(a =>
    ['new', 'open'].includes((a.status || '').toLowerCase())
  ).length

  const totalGB          = data.ingestionStats.reduce((s, d) => s + (d.gb || 0), 0)
  const activeConnectors = data.connectors.filter(c => c.active).length
  const lastEvent        = data.ingestionTimeline[0]

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Security Dashboard</h2>
        <p className="text-xs text-gray-500 mt-0.5">Visão em tempo real da sua postura de segurança</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KPICard
          icon={AlertTriangle}
          label="Casos Abertos"
          value={openCases}
          color="#ff4444"
          loading={loading}
        />
        <KPICard
          icon={Bell}
          label="Alertas Abertos"
          value={openAlerts}
          color="#f97316"
          loading={loading}
        />
        <KPICard
          icon={Database}
          label="Dados Ingeridos"
          value={formatBytes(totalGB)}
          color="#00d4ff"
          loading={loading}
        />
        <KPICard
          icon={Building2}
          label="Tenants"
          value={data.tenants.length}
          color="#22c55e"
          loading={loading}
        />
        <KPICard
          icon={Plug}
          label="Conectores Ativos"
          value={activeConnectors}
          color="#7c3aed"
          loading={loading}
        />
        <KPICard
          icon={Clock}
          label="Último Evento"
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
        <AssetDonut assets={data.connectors} loading={loading} />
      </div>

      {/* Cases Table */}
      <CasesTable cases={data.cases} loading={loading} />

      {/* Alerts + Connectors + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AlertsPanel alerts={data.alerts} loading={loading} />
        <ConnectorsPanel connectors={data.connectors} loading={loading} />
        <TimelinePanel events={data.ingestionTimeline} loading={loading} />
      </div>
    </div>
  )
}

// ─── Painel de Alertas ───────────────────────────────────────────────────────

function AlertsPanel({ alerts, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-32 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="glass rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-32">
        <Bell size={20} style={{ color: '#334155' }} />
        <p className="text-xs" style={{ color: '#475569' }}>Nenhum alerta</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
        <Bell size={14} style={{ color: '#f97316' }} />
        Alertas Recentes
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>
          {alerts.length}
        </span>
      </h3>
      <div className="space-y-2">
        {alerts.slice(0, 6).map(a => {
          const sc = severityColor(a.severity)
          return (
            <div
              key={a.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">{a.name}</div>
                <div className="text-xs text-gray-600 mt-0.5">{formatRelative(a.createdAt)}</div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded ml-2 flex-shrink-0 capitalize"
                style={{ color: sc.text, background: sc.bg, border: `1px solid ${sc.border}` }}
              >
                {a.severity}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Painel de Conectores ────────────────────────────────────────────────────

function ConnectorsPanel({ connectors, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />
        ))}
      </div>
    )
  }

  if (connectors.length === 0) {
    return (
      <div className="glass rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-32">
        <Plug size={20} style={{ color: '#334155' }} />
        <p className="text-xs" style={{ color: '#475569' }}>Nenhum conector</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">
        Conectores / Fontes de Log
      </h3>
      <div className="space-y-2">
        {connectors.slice(0, 6).map(c => (
          <div
            key={c.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: c.active ? '#22c55e' : '#ef4444',
                  boxShadow:  c.active ? '0 0 6px #22c55e' : '0 0 6px #ef4444',
                }}
              />
              <div>
                <div className="text-xs font-medium text-gray-300">{c.name}</div>
                <div className="text-xs text-gray-600 capitalize">{c.type || c.category}</div>
              </div>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded capitalize"
              style={{
                color:      c.active ? '#22c55e' : '#ef4444',
                background: c.active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              }}
            >
              {c.active ? 'ativo' : 'inativo'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Timeline de Eventos ─────────────────────────────────────────────────────

function TimelinePanel({ events, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="glass rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-32">
        <Clock size={20} style={{ color: '#334155' }} />
        <p className="text-xs" style={{ color: '#475569' }}>Nenhum evento recente</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Eventos Recentes</h3>
      <div className="space-y-2">
        {events.map(ev => {
          const color = recencyColor(ev.timestamp)
          return (
            <div
              key={ev.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                />
                <div>
                  <div className="text-xs font-medium text-gray-300">{ev.source}</div>
                  <div className="text-xs text-gray-600">{formatRelative(ev.timestamp)}</div>
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  color:      ev.status === 'success' ? '#22c55e' : '#ef4444',
                  background: ev.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                }}
              >
                {ev.status === 'success' ? 'ok' : 'erro'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

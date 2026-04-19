import { useData } from '../context/DataContext'
import { Radio } from 'lucide-react'
import { formatRelative } from '../utils/formatters'

export default function Sensors() {
  const { data, loading } = useData()

  const sensors = (data.connectors ?? []).map(c => ({
    id:       c.id,
    name:     c.name,
    status:   c.active ? 'online' : 'offline',
    type:     c.type || c.category || 'unknown',
    location: c.category || c.type || '—',
    lastSeen: c.lastActivity || c.lastDataReceived,
  }))

  const online  = sensors.filter(s => s.status === 'online').length
  const offline = sensors.filter(s => s.status !== 'online').length

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-100">Sensors / Conectores</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sensors.length} conectores registrados</p>
        </div>
        {sensors.length > 0 && (
          <div className="flex gap-3">
            <div className="glass rounded-lg px-4 py-2 text-center">
              <div className="text-xl font-bold" style={{ color: '#22c55e' }}>{online}</div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <div className="glass rounded-lg px-4 py-2 text-center">
              <div className="text-xl font-bold" style={{ color: '#ef4444' }}>{offline}</div>
              <div className="text-xs text-gray-500">Offline</div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : sensors.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <Radio size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
          <p className="text-sm" style={{ color: '#475569' }}>Nenhum conector encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sensors.map(s => {
            const isOnline = s.status === 'online'
            return (
              <div key={s.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  <Radio size={16} style={{ color: isOnline ? '#22c55e' : '#ef4444' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200">{s.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.location} · {s.type}</div>
                </div>
                <div className="text-right">
                  <span
                    className="inline-block text-xs px-2.5 py-1 rounded-lg font-medium capitalize"
                    style={{
                      color:      isOnline ? '#22c55e' : '#ef4444',
                      background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    }}
                  >
                    {s.status}
                  </span>
                  <div className="text-xs text-gray-600 mt-1">{formatRelative(s.lastSeen)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useData } from '../context/DataContext'
import { formatRelative, recencyColor } from '../utils/formatters'
import { Monitor } from 'lucide-react'

export default function Assets() {
  const { data, loading } = useData()

  const assets = (data.tenants ?? []).length > 0
    ? data.tenants.map(t => ({
        id: t.id,
        name: t.name,
        type: `${t.dsNum} conector${t.dsNum !== 1 ? 'es' : ''}`,
        ip: t.custId?.slice(0, 8) + '…',
        lastSeen: t.createdAt,
        status: 'active',
      }))
    : Array.from({ length: 12 }, (_, i) => ({
    id: `AST-${i + 1}`,
    name: `Asset-${i + 1}.corp.local`,
    type: ['endpoint', 'server', 'network', 'cloud'][i % 4],
    ip: `10.0.${Math.floor(i / 4)}.${i * 10 + 1}`,
    lastSeen: new Date(Date.now() - Math.random() * 48 * 3600000).toISOString(),
    status: i % 5 === 0 ? 'inactive' : 'active',
  }))

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Assets</h2>
        <p className="text-xs text-gray-500 mt-0.5">{assets.length} monitored assets</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map(a => {
            const color = recencyColor(a.lastSeen)
            return (
              <div key={a.id} className="glass rounded-xl p-4 flex items-start gap-3 hover:bg-white/[0.04] transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                  <Monitor size={15} style={{ color: '#00d4ff' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-200 truncate">{a.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.ip} · {a.type}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs text-gray-500">{formatRelative(a.lastSeen)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

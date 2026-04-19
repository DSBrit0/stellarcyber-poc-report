import { useData } from '../context/DataContext'
import { useLocale } from '../i18n'
import { formatRelative, recencyColor } from '../utils/formatters'
import { Monitor } from 'lucide-react'

export default function Assets() {
  const { data, loading } = useData()
  const { t } = useLocale()

  const assets = (data.tenants ?? []).map(t => ({
    id:      t.id,
    name:    t.name,
    type:    `${t.dsNum} ${t.dsNum === 1 ? '' : ''}`,
    custId:  t.custId?.slice(0, 8) + (t.custId?.length > 8 ? '…' : ''),
    lastSeen: t.createdAt,
    status:  'active',
    dsNum:   t.dsNum,
  }))

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">{t('assets.title')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('assets.monitored', { n: assets.length })}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <Monitor size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
          <p className="text-sm" style={{ color: '#475569' }}>{t('assets.none')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {assets.map(a => {
            const color = recencyColor(a.lastSeen)
            const connLabel = a.dsNum === 1 ? t('assets.conn1') : t('assets.connN')
            return (
              <div key={a.id} className="glass rounded-xl p-4 flex items-start gap-3 hover:bg-white/[0.04] transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                  <Monitor size={15} style={{ color: '#00d4ff' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-200 truncate">{a.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.custId} · {a.dsNum} {connLabel}</div>
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

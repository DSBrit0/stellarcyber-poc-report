import { useData } from '../context/DataContext'
import { useLocale } from '../i18n'
import { Activity } from 'lucide-react'

export default function Assets() {
  const { data, loading } = useData()
  const { t } = useLocale()

  const daily = data.assets ?? []

  const avgEntities = daily.length > 0
    ? Math.round(daily.reduce((s, d) => s + (d.entity_count || 0), 0) / daily.length)
    : 0

  const maxCount = daily.length > 0 ? Math.max(...daily.map(d => d.entity_count)) : 1

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">{t('assets.title')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('assets.subtitle')}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      ) : daily.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center">
          <Activity size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
          <p className="text-sm" style={{ color: '#475569' }}>{t('assets.none')}</p>
        </div>
      ) : (
        <>
          {/* Average KPI */}
          <div className="glass rounded-xl p-5 flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)' }}
            >
              <Activity size={22} style={{ color: '#00d4ff' }} />
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>{avgEntities}</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{t('assets.avgEntities')}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs" style={{ color: '#475569' }}>{t('assets.periodDays', { n: daily.length })}</div>
            </div>
          </div>

          {/* Daily bar chart */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('assets.dailyTitle')}</h3>
            <div className="flex items-end gap-1 h-40">
              {daily.map((d) => {
                const heightPct = maxCount > 0 ? (d.entity_count / maxCount) * 100 : 0
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.entity_count}`}>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height:     `${Math.max(heightPct, 2)}%`,
                        background: 'rgba(0,212,255,0.45)',
                        minHeight:  '3px',
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ color: '#334155' }}>
              <span>{daily[0]?.date?.slice(5)}</span>
              <span>{daily[daily.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>

          {/* Daily table */}
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(31,56,100,0.6)', color: '#94a3b8' }}>
                  <th className="text-left px-4 py-2.5 font-semibold">{t('assets.colDate')}</th>
                  <th className="text-right px-4 py-2.5 font-semibold">{t('assets.colEntities')}</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d, idx) => (
                  <tr
                    key={d.date}
                    style={{
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <td className="px-4 py-2 text-gray-300">{d.date}</td>
                    <td className="px-4 py-2 text-right font-mono" style={{ color: '#00d4ff' }}>
                      {d.entity_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

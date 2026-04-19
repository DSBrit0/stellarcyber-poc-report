import { useData } from '../context/DataContext'
import { useLocale } from '../i18n'
import CasesTable from '../components/Tables/CasesTable'
import { severityColor } from '../utils/formatters'

export default function Cases() {
  const { data, loading } = useData()
  const { t } = useLocale()

  const bySeverity = ['critical', 'high', 'medium', 'low'].map(s => ({
    severity: s,
    count: data.cases.filter(c => c.severity?.toLowerCase() === s).length,
  }))

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">{t('cases.title')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('cases.subtitle')}</p>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-4 gap-3">
        {bySeverity.map(({ severity, count }) => {
          const c = severityColor(severity)
          return (
            <div key={severity} className="glass rounded-xl p-4 text-center"
              style={{ border: `1px solid ${c.border}` }}>
              <div className="text-2xl font-bold" style={{ color: c.text }}>{count}</div>
              <div className="text-xs capitalize mt-1" style={{ color: c.text }}>{severity}</div>
            </div>
          )
        })}
      </div>

      <CasesTable cases={data.cases} loading={loading} />
    </div>
  )
}

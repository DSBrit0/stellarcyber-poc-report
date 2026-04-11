import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { generateRecommendations } from '../utils/recommendations'
import RecommendationCard from '../components/Recommendations/RecommendationCard'
import { Lightbulb, RefreshCw } from 'lucide-react'

export default function Recommendations() {
  const { data, loading, refresh } = useData()

  const recs = useMemo(() => generateRecommendations(data), [data])

  const critical = recs.filter(r => r.priority === 'critical').length
  const warning = recs.filter(r => r.priority === 'warning').length
  const info = recs.filter(r => r.priority === 'info').length

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-100">Recommendations</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            AI-analyzed insights based on your current security data
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Reanalyze
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3">
        {critical > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: '#ff4444', background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)' }}>
            {critical} Critical
          </span>
        )}
        {warning > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
            {warning} Warning
          </span>
        )}
        {info > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: '#00d4ff', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)' }}>
            {info} Info
          </span>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map(rec => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-2 text-xs text-gray-600 pt-2">
        <Lightbulb size={13} className="flex-shrink-0 mt-0.5" />
        <span>Recommendations are generated automatically based on thresholds applied to live data. They refresh every 5 minutes.</span>
      </div>
    </div>
  )
}

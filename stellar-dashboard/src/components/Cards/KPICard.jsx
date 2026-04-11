import { useEffect, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function KPICard({ icon: Icon, label, value, unit = '', trend, trendLabel, color = '#00d4ff', loading }) {
  const countRef = useRef(null)

  useEffect(() => {
    if (loading || !countRef.current || typeof value !== 'number') return
    const target = value
    const duration = 800
    const start = performance.now()
    const startVal = 0

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (target - startVal) * eased)
      if (countRef.current) countRef.current.textContent = current.toLocaleString()
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, loading])

  if (loading) {
    return (
      <div className="glass rounded-xl p-5 flex flex-col gap-3">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-3 w-20" />
      </div>
    )
  }

  const isPositiveTrend = trend > 0
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown

  return (
    <div
      className="glass rounded-xl p-5 flex flex-col gap-2 cursor-default transition-all duration-300 group"
      style={{ '--card-color': color }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 0 24px ${color}33, 0 4px 24px rgba(0,0,0,0.3)`
        e.currentTarget.style.borderColor = `${color}40`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.borderColor = ''
      }}
    >
      {/* Icon + Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide uppercase text-gray-400">{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1">
        <span
          ref={countRef}
          className="text-3xl font-bold tracking-tight"
          style={{ color: '#f1f5f9' }}
        >
          {typeof value === 'number' ? '0' : (value ?? '—')}
        </span>
        {unit && <span className="text-sm text-gray-400 mb-1">{unit}</span>}
      </div>

      {/* Trend */}
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          <TrendIcon size={12} style={{ color: isPositiveTrend ? '#22c55e' : '#ef4444' }} />
          <span style={{ color: isPositiveTrend ? '#22c55e' : '#ef4444' }}>
            {Math.abs(trend)}%
          </span>
          <span className="text-gray-500">{trendLabel || 'vs last period'}</span>
        </div>
      )}
    </div>
  )
}

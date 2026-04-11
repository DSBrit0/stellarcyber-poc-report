import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertOctagon, AlertTriangle, Info, Zap } from 'lucide-react'

const priorityConfig = {
  critical: {
    icon: AlertOctagon,
    label: 'Critical',
    color: '#ff4444',
    bg: 'rgba(255,68,68,0.08)',
    border: 'rgba(255,68,68,0.25)',
    glow: 'rgba(255,68,68,0.15)',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
    glow: 'rgba(251,191,36,0.1)',
  },
  info: {
    icon: Info,
    label: 'Info',
    color: '#00d4ff',
    bg: 'rgba(0,212,255,0.08)',
    border: 'rgba(0,212,255,0.25)',
    glow: 'rgba(0,212,255,0.1)',
  },
}

export default function RecommendationCard({ rec }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = priorityConfig[rec.priority] || priorityConfig.info
  const Icon = cfg.icon

  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 animate-fade-in"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: expanded ? `0 0 30px ${cfg.glow}` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
          >
            <Icon size={15} style={{ color: cfg.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
                style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
              >
                {cfg.label}
              </span>
              <span className="text-xs text-gray-500 px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                {rec.category}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-100 leading-snug">{rec.title}</h3>
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 mt-3 ml-11 leading-relaxed">{rec.description}</p>

      {/* Impact bar */}
      <div className="ml-11 mt-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Zap size={10} />
            <span>Estimated Impact</span>
          </div>
          <span className="text-xs font-medium" style={{ color: cfg.color }}>{rec.impact.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${rec.impact}%`,
              background: `linear-gradient(90deg, ${cfg.color}99, ${cfg.color})`,
            }}
          />
        </div>
      </div>

      {/* Steps (expanded) */}
      {expanded && (
        <div className="ml-11 mt-4 animate-fade-in">
          <div className="text-xs font-medium text-gray-300 mb-2">Suggested Actions:</div>
          <ol className="space-y-2">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${cfg.color}22`, color: cfg.color }}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

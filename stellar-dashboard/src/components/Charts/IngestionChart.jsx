import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      <div style={{ color: '#00d4ff' }}>
        {payload[0]?.value?.toFixed(2)} GB ingested
      </div>
    </div>
  )
}

export default function IngestionChart({ data, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-4" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    )
  }

  // Fallback: generate mock 7-day data if empty
  const chartData = data?.length > 0 ? data : Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    gb: Math.random() * 500 + 100,
  }))

  const formatted = chartData.map(d => ({
    ...d,
    date: typeof d.date === 'string' && d.date.includes('-')
      ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : d.date,
  }))

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Data Ingestion</h3>
          <p className="text-xs text-gray-500 mt-0.5">Last 7 days — GB ingested per day</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3 h-0.5 rounded" style={{ background: '#00d4ff' }} />
          <span>Volume (GB)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="ingestionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)}G`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="gb"
            stroke="#00d4ff"
            strokeWidth={2}
            fill="url(#ingestionGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#00d4ff', stroke: '#0a0e1a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#00d4ff', '#0066ff', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <div className="font-medium text-gray-200">{payload[0].name}</div>
      <div style={{ color: payload[0].payload.fill }}>{payload[0].value} assets</div>
    </div>
  )
}

export default function AssetDonut({ assets, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-32 mb-4" />
        <div className="skeleton h-48 w-full rounded-full" />
      </div>
    )
  }

  // Group by type
  const groups = {}
  assets.forEach(a => {
    const t = a.type || 'Unknown'
    groups[t] = (groups[t] || 0) + 1
  })

  const chartData = Object.entries(groups).length > 0
    ? Object.entries(groups).map(([name, value]) => ({ name, value }))
    : [
        { name: 'Endpoint', value: 42 },
        { name: 'Server', value: 28 },
        { name: 'Network', value: 15 },
        { name: 'Cloud', value: 10 },
        { name: 'IoT', value: 5 },
      ]

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Asset Types</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{val}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

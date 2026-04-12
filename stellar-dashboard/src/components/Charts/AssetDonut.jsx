import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#00d4ff', '#0066ff', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <div className="font-medium text-gray-200">{payload[0].name}</div>
      <div style={{ color: payload[0].payload.fill }}>
        {payload[0].value} conector{payload[0].value !== 1 ? 'es' : ''}
      </div>
    </div>
  )
}

/**
 * Recebe lista de conectores e agrupa por categoria/tipo.
 * Exibe distribuição das fontes de log por categoria.
 */
export default function AssetDonut({ assets: connectors, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-4" />
        <div className="skeleton h-48 w-full rounded-full" />
      </div>
    )
  }

  // Agrupa por category ou type
  const groups = {}
  const items = Array.isArray(connectors) ? connectors : []
  items.forEach(c => {
    const key = c.category || c.type || 'Outros'
    const label = categoryLabel(key)
    groups[label] = (groups[label] || 0) + 1
  })

  const chartData = Object.entries(groups).length > 0
    ? Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))
    : [
        { name: 'SaaS',     value: 12 },
        { name: 'Cloud',    value: 8  },
        { name: 'Endpoint', value: 6  },
        { name: 'Network',  value: 4  },
        { name: 'PaaS',     value: 3  },
      ]

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Conectores por Categoria</h3>
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
            formatter={(val) => (
              <span style={{ color: '#9ca3af', fontSize: 11 }}>{val}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function categoryLabel(cat) {
  const map = {
    saas:         'SaaS',
    paas:         'PaaS',
    cloud:        'Cloud',
    network:      'Network',
    endpoint:     'Endpoint',
    dns_security: 'DNS Security',
    ot:           'OT/ICS',
  }
  return map[cat?.toLowerCase()] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Outros')
}

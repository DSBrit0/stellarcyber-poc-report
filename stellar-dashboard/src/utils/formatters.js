export function formatBytes(gb) {
  if (gb === null || gb === undefined) return '—'
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${(gb * 1024).toFixed(0)} MB`
}

export function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatRelative(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatNumber(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString()
}

export function severityColor(severity) {
  const map = {
    critical: { text: '#ff4444', bg: 'rgba(255,68,68,0.15)', border: 'rgba(255,68,68,0.4)' },
    high: { text: '#ff8c00', bg: 'rgba(255,140,0,0.15)', border: 'rgba(255,140,0,0.4)' },
    medium: { text: '#ffd700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)' },
    low: { text: '#00d4ff', bg: 'rgba(0,212,255,0.15)', border: 'rgba(0,212,255,0.4)' },
  }
  return map[severity?.toLowerCase()] || map.low
}

export function recencyColor(iso) {
  if (!iso) return '#6b7280'
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000
  if (hrs < 1) return '#22c55e'
  if (hrs < 6) return '#fbbf24'
  return '#ef4444'
}

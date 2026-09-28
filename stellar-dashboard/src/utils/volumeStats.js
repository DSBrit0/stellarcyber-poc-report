import { assetCompliance } from './assetCompliance'

// Daily data volume statistics (GB) over every day of the period, 0 days included —
// same counting rule as the asset statistics (utils/assetCompliance).
// days: [{ date: 'YYYY-MM-DD', gb }] from fetchDailyVolume.

export function volumeStats(days) {
  const list = [...(days || [])].filter(d => d && d.date).sort((a, b) => a.date.localeCompare(b.date))
  if (list.length === 0) return null
  const min = list.reduce((m, d) => (d.gb < m.gb ? d : m), list[0])
  const max = list.reduce((m, d) => (d.gb > m.gb ? d : m), list[0])
  const total = list.reduce((s, d) => s + d.gb, 0)
  return {
    days:     list.length,
    zeroDays: list.filter(d => d.gb === 0).length,
    from:     list[0].date,
    to:       list[list.length - 1].date,
    total,
    avg:      total / list.length,
    min:      min.gb,
    minDate:  min.date,
    max:      max.gb,
    maxDate:  max.date,
  }
}

// Same 7.0 compliance logic as the asset license, on the daily volume (GB/day).
// Returns the shape of assetCompliance() with values in GB.
export function volumeCompliance(days) {
  const series = (days || []).map(d => ({ date: d.date, entity_count: d.gb }))
  return assetCompliance(series, { integer: false })
}

// Asset license statistics and compliance levels.
//
// Source: Stellar Cyber 7.0 docs — "Understanding Asset-Based Licensing" and
// "Understanding License Compliance".
//   - "Each day at 11:59 PM UTC, Stellar Cyber counts the total of all the unique
//     assets (devices and users) per tenant for that given day." Every day has a
//     count, including 0 — a day with 0 is a real count, not missing data.
//   - A level is reached when the limit is "exceeded by more than 10% on each of
//     N consecutive days": a single day at or below 110% (0 included) breaks the run.
//
// assets: [{ date: 'YYYY-MM-DD', entity_count }] from /entity_usages/daily_count
// (identical, per day, to the size of /entity_usages/entity_list).

export const LICENSE_TOLERANCE = 1.1

export const COMPLIANCE_LEVELS = [
  { key: 'warning',   days: 3 },
  { key: 'violation', days: 7 },
  { key: 'ooc',       days: 21 },
]

function sortedCounts(assets) {
  return [...(assets || [])]
    .filter(a => a && a.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(a => ({ date: String(a.date).slice(0, 10), count: Number(a.entity_count) || 0 }))
}

// Min / average / max over every day of the period (0 days included).
export function assetStats(assets) {
  const days = sortedCounts(assets)
  if (days.length === 0) return null
  const counts = days.map(d => d.count)
  return {
    days:     days.length,
    zeroDays: counts.filter(c => c === 0).length,
    min:      Math.min(...counts),
    avg:      Math.round(counts.reduce((s, c) => s + c, 0) / counts.length),
    max:      Math.max(...counts),
  }
}

// Highest asset count observed on EACH of `n` consecutive days: the best window's
// minimum. When several windows tie, the most recent one is reported.
// Returns null when the period has fewer than `n` days.
export function sustainedLevel(assets, n) {
  const days = sortedCounts(assets)
  if (days.length < n) return null
  let best = null
  for (let i = 0; i + n <= days.length; i++) {
    const win   = days.slice(i, i + n)
    const level = Math.min(...win.map(d => d.count))
    if (best === null || level >= best.level) {
      best = { level, from: win[0].date, to: win[n - 1].date }
    }
  }
  return best
}

// Daily count above which a license of `license` assets is exceeded (> 110%).
// Counts are integers, so "more than 110%" means more than floor(110%).
export function toleranceLimit(license) {
  return Math.floor(license * LICENSE_TOLERANCE + 1e-9)
}

// One row per compliance level + the recommended license quantity, which is the
// highest sustained level (the 3-day one): licensing it avoids every notification.
export function assetCompliance(assets) {
  const stats  = assetStats(assets)
  const levels = COMPLIANCE_LEVELS.map(lv => ({ ...lv, sustained: sustainedLevel(assets, lv.days) }))
  const known  = levels.filter(lv => lv.sustained).map(lv => lv.sustained.level)
  const recommended = known.length ? Math.max(...known) : null
  return {
    stats,
    levels,
    recommended,
    limit: recommended != null ? toleranceLimit(recommended) : null,
  }
}

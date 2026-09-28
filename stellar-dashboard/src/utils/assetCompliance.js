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
export function assetStats(assets, { integer = true } = {}) {
  const days = sortedCounts(assets)
  if (days.length === 0) return null
  const counts = days.map(d => d.count)
  return {
    days:     days.length,
    zeroDays: counts.filter(c => c === 0).length,
    min:      Math.min(...counts),
    avg:      (sum => (integer ? Math.round(sum / counts.length) : sum / counts.length))(counts.reduce((s, c) => s + c, 0)),
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

// Daily value above which a license is exceeded (> 110%). Asset counts are
// integers, so "more than 110%" means more than floor(110%); volume (GB) is continuous.
export function toleranceLimit(license, { integer = true } = {}) {
  const limit = license * LICENSE_TOLERANCE
  return integer ? Math.floor(limit + 1e-9) : limit
}

// Applies the 7.0 rule day by day to a candidate license: a day counts as exceeded
// when its count is above 110% of the license; a level is reached when the longest
// run of exceeded days is at least that level's number of days.
export function simulateLicense(assets, license, { integer = true } = {}) {
  const days  = sortedCounts(assets)
  const limit = toleranceLimit(license, { integer })
  let run = 0, start = 0, longest = null, daysAbove = 0
  days.forEach((d, i) => {
    if (d.count > limit) {
      daysAbove++
      if (run === 0) start = i
      run++
      if (!longest || run > longest.days) longest = { days: run, from: days[start].date, to: d.date }
    } else {
      run = 0
    }
  })
  const reached = [...COMPLIANCE_LEVELS].reverse().find(lv => (longest?.days || 0) >= lv.days)
  return {
    license,
    limit,
    daysAbove,
    longestRun: longest,                       // null when no day was above the limit
    level:      reached ? reached.key : 'none',
    levels:     COMPLIANCE_LEVELS.map(lv => ({ ...lv, reached: (longest?.days || 0) >= lv.days })),
  }
}

// License recommendation after the asset discovery period.
//   recommended = highest count present on each of 3 consecutive days — with it no
//   3-day run can exceed 110%, so no level is reached in the observed period.
//   scenarios   = the 7.0 rule simulated for the period average, the recommendation
//   and the period peak.
// The 7.0 rules apply to both asset and volume licenses: `integer: false` runs the
// same logic on a daily volume series (entity_count = GB per day).
export function assetCompliance(assets, { integer = true } = {}) {
  const stats     = assetStats(assets, { integer })
  const sustained = sustainedLevel(assets, COMPLIANCE_LEVELS[0].days)
  const recommended = sustained ? sustained.level : null
  const scenarios = stats && recommended != null
    ? [
        { key: 'average',     ...simulateLicense(assets, stats.avg, { integer }) },
        { key: 'recommended', ...simulateLicense(assets, recommended, { integer }) },
        { key: 'peak',        ...simulateLicense(assets, stats.max, { integer }) },
      ]
    : []
  return {
    stats,
    recommended,
    recommendedWindow: sustained ? { from: sustained.from, to: sustained.to } : null,
    limit:             recommended != null ? toleranceLimit(recommended, { integer }) : null,
    result:            scenarios.find(sc => sc.key === 'recommended') || null,
    scenarios,
  }
}

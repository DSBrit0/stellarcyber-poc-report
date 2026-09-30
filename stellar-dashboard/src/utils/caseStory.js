// Section 4.1 of the Executive report: the detection story told as five questions.
// Pure builders, no I/O and no jsPDF; pdfReport.js draws what they return.
//   1. signalFunnel      — did the platform separate what matters from the noise?
//   2. topThreats        — what was found that needs attention?
//   3. priorityMatrix    — where should the team act first?
//   4. responseScorecard — is the operation under control?
//   5. effortEstimate    — how much analyst effort does it save?

// Analyst time premises (minutes; hours per analyst-month). The SE can change them
// in the POC form (effort* fields); empty or invalid values fall back to these.
export const EFFORT_DEFAULTS = { alertMin: 4, critHighMin: 120, mediumMin: 20, lowMin: 2, monthHours: 160 }

// SOC targets for the response scorecard. Yellow = up to 2× the target (times) or
// up to twice the distance to 100% (handled %); open Critical is red from 1 case,
// open High is yellow for 1–2 cases and red from 3.
export const SOC_TARGETS = { critOpen: 0, highOpen: 0, highOpenYellow: 2, handledPct: 90, ackMin: 30, closeHours: 24 }

// Default cut of the risk score for the priority matrix (0–100).
export const SCORE_CUT = 70

// A case is pending until it is resolved, closed or cancelled (New and In Progress count).
const DONE = /resolved|closed|cancel/i
export const isPending = status => !DONE.test(String(status || 'New'))

const sevOf = c => String(c?.severity || '').toLowerCase()
const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

export function median(values) {
  const v = values.filter(n => Number.isFinite(n)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

// Minutes between the start of the activity (start_timestamp) and the case creation
// (created_at); null when either is missing or the order is inverted.
export function leadMinutes(c) {
  if (!Number.isFinite(c?.startedAt) || !Number.isFinite(c?.detectedAt)) return null
  const d = (c.detectedAt - c.startedAt) / 60_000
  return d >= 0 ? d : null
}

// Premises from the POC metadata (effortAlertMin, effortCritHighMin, effortMediumMin,
// effortLowMin, effortMonthHours). `custom` is true when the SE changed any of them.
export function effortPremises(meta = {}) {
  const pick = (v, d, min = 0) => {
    if (v === '' || v == null) return d
    const n = Number(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= min ? n : d
  }
  const p = {
    alertMin:    pick(meta.effortAlertMin,    EFFORT_DEFAULTS.alertMin),
    critHighMin: pick(meta.effortCritHighMin, EFFORT_DEFAULTS.critHighMin),
    mediumMin:   pick(meta.effortMediumMin,   EFFORT_DEFAULTS.mediumMin),
    lowMin:      pick(meta.effortLowMin,      EFFORT_DEFAULTS.lowMin),
    monthHours:  pick(meta.effortMonthHours,  EFFORT_DEFAULTS.monthHours, 1),
  }
  p.custom = Object.keys(EFFORT_DEFAULTS).some(k => p[k] !== EFFORT_DEFAULTS[k])
  return p
}

// ─── 1. Signal funnel ─────────────────────────────────────────────────────────
// volumeGB: total of the daily licensing volume (null when the API has none);
// alerts / cases: every case of the period (caseStats); critHigh: the loaded
// Critical and High cases (all of them, fetchCases pages to the total).
export function signalFunnel({ volumeGB, alerts, cases, critHigh }) {
  if (!alerts || !cases) return null
  const pendingCH      = critHigh.filter(c => isPending(c.status))
  const critHighAlerts = critHigh.reduce((t, c) => t + (Number(c.alertCount) || 0), 0)
  return {
    volumeGB:        Number.isFinite(volumeGB) ? volumeGB : null,
    alerts,
    cases,
    critHigh:        critHigh.length,
    pending:         pendingCH.length,
    pendingCritical: pendingCH.filter(c => sevOf(c) === 'critical').length,
    pendingHigh:     pendingCH.filter(c => sevOf(c) === 'high').length,
    alertsPerCase:   alerts / cases,
    // share of the alerts that sit in the Critical/High cases
    critHighAlertShare: Math.min(1, critHighAlerts / alerts),
    critHighShare:   critHigh.length / cases,
  }
}

// ─── 2. Top threats ───────────────────────────────────────────────────────────
// Case name without the "and 4999 others" suffix the API appends.
export const threatName = c => String(c?.name || c?.id || '—').replace(/\s+and\s+\d+\s+other(s|\(s\))?$/i, '').trim()

// One card per threat (case name): cases with the same name are the same threat seen
// again, so the best case of each name represents it and `similar` counts the rest.
// Order: Critical first, then High; inside each, highest score, then most alerts.
// byCase: caseTactics.byCase (tactics and techniques seen in the alerts of each case).
export function topThreats(critHigh, byCase = {}, n = 5) {
  const sorted = [...critHigh].sort((a, b) =>
    (SEV_RANK[sevOf(a)] ?? 9) - (SEV_RANK[sevOf(b)] ?? 9) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    (b.alertCount || 0) - (a.alertCount || 0))
  const groups = new Map()
  for (const c of sorted) {
    const key = threatName(c).toLowerCase()
    if (!groups.has(key)) groups.set(key, { lead: c, cases: [] })
    groups.get(key).cases.push(c)
  }
  return [...groups.values()]
    .slice(0, n)
    .map(({ lead: c, cases: same }, k) => {
      const t = byCase?.[c.id] || {}
      return {
        rank:       k + 1,
        id:         c.id,
        name:       threatName(c),
        similar:    same.length - 1,
        groupAlerts: same.reduce((s, x) => s + (Number(x.alertCount) || 0), 0),
        groupPending: same.filter(x => isPending(x.status)).length,
        severity:   c.severity,
        critical:   sevOf(c) === 'critical',
        score:      typeof c.score === 'number' ? c.score : null,
        alerts:     Number(c.alertCount) || 0,
        status:     c.status || 'New',
        pending:    isPending(c.status),
        detectedAt: Number.isFinite(c.detectedAt) ? c.detectedAt : null,
        leadMin:    leadMinutes(c),
        tactics:    (t.tactics || []).slice(0, 3).map(x => x.name).filter(Boolean),
        xdr:        (t.xdr || []).slice(0, 2).map(x => x.name).filter(Boolean),
        techniques: (t.techniques || []).slice(0, 3).map(x => x.name).filter(Boolean),
      }
    })
}

// ─── 3. Priority matrix ───────────────────────────────────────────────────────
// Risk score × alerts of the loaded cases (Critical, High and the 100 most recent
// Medium). The alert cut is the median alert count of the plotted cases (at least 2),
// so "many alerts" is relative to this environment.
export function priorityMatrix(cases, { scoreCut = SCORE_CUT, ranks = {} } = {}) {
  const plotted  = cases.filter(c => typeof c.score === 'number')
  const alertCut = Math.max(2, Math.round(median(plotted.map(c => Number(c.alertCount) || 1)) || 2))
  const counts   = { act: 0, investigate: 0, monitor: 0, noise: 0 }
  const points   = plotted.map(c => {
    const alerts = Math.max(1, Number(c.alertCount) || 1)
    const hiS = c.score >= scoreCut, hiA = alerts >= alertCut
    const q = hiS ? (hiA ? 'act' : 'investigate') : (hiA ? 'monitor' : 'noise')
    counts[q]++
    return { id: c.id, score: c.score, alerts, sev: sevOf(c), q, rank: ranks[c.id] || null }
  })
  const actCH = points.filter(p => p.q === 'act' && (p.sev === 'critical' || p.sev === 'high')).length
  return { points, scoreCut, alertCut, counts, actCritHigh: actCH, excluded: cases.length - plotted.length,
    maxAlerts: Math.max(1, ...points.map(p => p.alerts)) }
}

// ─── 4. Response scorecard ────────────────────────────────────────────────────
// Lamp: 'green' | 'yellow' | 'red' | 'none' (no data) | 'info' (no target).
export function responseScorecard({ critHigh, caseStats, targets = SOC_TARGETS }) {
  const T = targets
  const pend = critHigh.filter(c => isPending(c.status))
  const critOpen = pend.filter(c => sevOf(c) === 'critical').length
  const highOpen = pend.filter(c => sevOf(c) === 'high').length
  const handledPct = caseStats?.cases ? caseStats.handled / caseStats.cases * 100 : null
  const ack   = caseStats?.medianAckMinutes ?? null
  const close = caseStats?.medianCloseHours ?? null
  const lead  = median(critHigh.map(leadMinutes).filter(v => v != null))
  const upTo  = (v, t) => (v == null ? 'none' : v <= t ? 'green' : v <= 2 * t ? 'yellow' : 'red')
  const tiles = [
    { key: 'critOpen', value: critOpen, target: T.critOpen,
      lamp: critOpen <= T.critOpen ? 'green' : 'red' },
    { key: 'highOpen', value: highOpen, target: T.highOpen,
      lamp: highOpen <= T.highOpen ? 'green' : highOpen <= T.highOpenYellow ? 'yellow' : 'red' },
    { key: 'handled', value: handledPct, target: T.handledPct,
      lamp: handledPct == null ? 'none' : handledPct >= T.handledPct ? 'green' : handledPct >= 100 - 2 * (100 - T.handledPct) ? 'yellow' : 'red',
      handled: caseStats?.handled ?? null, cases: caseStats?.cases ?? null },
    { key: 'ack',   value: ack,   target: T.ackMin,     lamp: upTo(ack, T.ackMin), n: caseStats?.acknowledged ?? 0 },
    { key: 'close', value: close, target: T.closeHours, lamp: upTo(close, T.closeHours), n: caseStats?.closed ?? 0 },
    { key: 'lead',  value: lead,  target: null,         lamp: lead == null ? 'none' : 'info',
      n: critHigh.filter(c => leadMinutes(c) != null).length },
  ]
  const rated = tiles.filter(t => ['green', 'yellow', 'red'].includes(t.lamp))
  return {
    tiles,
    rated:     rated.length,
    inTarget:  rated.filter(t => t.lamp === 'green').length,
    attention: rated.filter(t => t.lamp !== 'green').map(t => t.key),
    critOpen, highOpen,
  }
}

// ─── 5. Effort avoided ────────────────────────────────────────────────────────
// Same work on both sides, so the comparison is fair in every environment:
//   triage        — without correlation every alert is triaged on its own; with the
//                   platform each case is triaged once (alertMin per item)
//   investigation — the cases still have to be investigated with or without the
//                   platform (critHighMin / mediumMin / lowMin per case): equal on both
// saved = (alerts − cases) × alertMin, never negative. Counts are real (API); the
// minutes are premises — the API records no analyst effort, only timestamps.
// focusPct: share of the cases that need immediate action (Critical/High) — the
// prioritization value, strong where correlation is low (≈1 alert per case).
export function effortEstimate({ alerts, critHigh, medium, low }, p = EFFORT_DEFAULTS) {
  if (!alerts) return null
  const cases          = critHigh + medium + low
  const triageWithoutH = alerts * p.alertMin / 60
  const triageWithH    = cases * p.alertMin / 60
  const invH           = (critHigh * p.critHighMin + medium * p.mediumMin + low * p.lowMin) / 60
  const savedH         = Math.max(0, triageWithoutH - triageWithH)
  return {
    alerts, cases, critHigh, medium, low,
    triageWithoutH, triageWithH, invH, savedH,
    withoutH:   triageWithoutH + invH,        // total analyst hours without correlation
    withH:      triageWithH + invH,           // total with Stellar Cyber (triage of cases + investigation)
    savedPct:   triageWithoutH ? savedH / triageWithoutH : 0,   // share of the manual triage removed
    savedFte:   savedH / p.monthHours,
    withFte:    (triageWithH + invH) / p.monthHours,
    focusPct:   cases ? critHigh / cases : 0,
    premises:   p,
  }
}

// Notices that tell the reader how far the effort numbers can be trusted.
//   small        — fewer than SMALL_SAMPLE cases in the period
//   concentrated — the 5 largest cases hold more than half of the alerts
export const SMALL_SAMPLE = 30
export function effortFlags({ cases, alerts, top5Alerts }) {
  return {
    small:        cases < SMALL_SAMPLE,
    concentrated: alerts > 0 && top5Alerts / alerts > 0.5,
    top5Pct:      alerts > 0 ? top5Alerts / alerts : 0,
  }
}

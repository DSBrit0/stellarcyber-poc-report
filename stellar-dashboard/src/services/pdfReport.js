import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  navy:    [31,  56,  100],
  blue:    [0,   112, 192],
  midBlue: [46,  117, 182],
  rowAlt:  [235, 243, 251],
  white:   [255, 255, 255],
  text:    [30,  30,  30 ],
  muted:   [120, 120, 120],
  red:     [192, 0,   0  ],
  green:   [0,   176, 80 ],
  orange:  [255, 130, 0  ],
  yellow:  [200, 160, 0  ],
  gray:    [242, 242, 242],
}

const PW = 210
const PH = 297
const ML = 14
const MR = 14
const CW = PW - ML - MR  // 182mm

let _pageNum = 0
let _meta    = {}
let _s       = {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function i(str, vars = {}) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  )
}

function fmtDate(iso, locale) {
  if (!iso) return '—'
  const loc = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  try { return new Date(iso).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return String(iso) }
}

function fmtNum(n, locale) {
  if (n == null || isNaN(n)) return '—'
  const loc = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  return Number(n).toLocaleString(loc)
}

function fmtGB(n, locale) {
  if (n == null || isNaN(n) || n === 0) return '—'
  const loc = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  return `${Number(n).toLocaleString(loc, { maximumFractionDigits: 2 })} GB`
}

function trunc(str, n) {
  if (!str) return '—'
  const s = String(str)
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function pct(n, total) {
  return total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '0%'
}

function sevColor(sev) {
  const s = String(sev || '').toLowerCase()
  if (s === 'critical') return C.red
  if (s === 'high')     return C.orange
  if (s === 'medium')   return C.yellow
  return C.green
}

function statusColor(val, achieved, partial) {
  if (val === achieved) return C.green
  if (val === partial)  return C.orange
  return C.red
}

// ─── Page chrome ──────────────────────────────────────────────────────────────

function addChrome(doc) {
  const client  = _meta.clientName  || 'Client'
  const partner = _meta.partnerName || 'Partner'
  const year    = new Date().getFullYear()

  doc.setFillColor(...C.blue)
  doc.rect(0, 0, PW, 10, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Stellar Cyber Open XDR — ${_s.headerTitle} | ${client} — ${_s.confidential}`,
    ML, 6.5
  )
  doc.text(`${_s.page} ${_pageNum}`, PW - MR, 6.5, { align: 'right' })

  doc.setFillColor(...C.navy)
  doc.rect(0, PH - 10, PW, 10, 'F')
  doc.setFontSize(6.5)
  doc.setTextColor(...C.white)
  doc.text(
    `© ${year} — ${_s.footerDoc} | Stellar Cyber + ${partner} | ${_s.page} ${_pageNum}`,
    PW / 2, PH - 4, { align: 'center' }
  )
}

function newPage(doc) {
  doc.addPage()
  _pageNum++
  addChrome(doc)
  return 18
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function sectionTitle(doc, num, text, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.blue)
  doc.text(`${num}. ${text}`, ML, y)
  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.5)
  doc.line(ML, y + 2.5, PW - MR, y + 2.5)
  doc.setFont('helvetica', 'normal')
  return y + 12
}

function appendixTitle(doc, label, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.blue)
  doc.text(label, ML, y)
  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.4)
  doc.line(ML, y + 2.5, PW - MR, y + 2.5)
  doc.setFont('helvetica', 'normal')
  return y + 12
}

function subTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.navy)
  doc.text(text, ML, y)
  doc.setFont('helvetica', 'normal')
  return y + 7
}

function bodyText(doc, text, y, maxW = CW) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...C.text)
  const lines = doc.splitTextToSize(text, maxW)
  doc.text(lines, ML, y)
  return y + lines.length * 5
}

function infoNote(doc, text, y) {
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  const lines = doc.splitTextToSize(text, CW)
  doc.text(lines, ML, y)
  doc.setFont('helvetica', 'normal')
  return y + lines.length * 4.5
}

function tableBase(extra = {}) {
  return {
    styles:             { fontSize: 9, cellPadding: 3, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles:         { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin:             { left: ML, right: MR },
    ...extra,
  }
}

function tableCompact(extra = {}) {
  return {
    styles:             { fontSize: 8.5, cellPadding: 2.5, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles:         { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin:             { left: ML, right: MR },
    ...extra,
  }
}

function needsPage(doc, y, required = 60) {
  return y + required > PH - 20
}

// ─── 14 MITRE ATT&CK Enterprise tactics ──────────────────────────────────────

const ALL_TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance' },
  { id: 'TA0042', name: 'Resource Development' },
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0040', name: 'Impact' },
]

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePDFReport({
  auth,
  cases                = [],
  connectors           = [],
  assets               = [],
  recommendations      = [],
  ingestionBySensor    = [],
  ingestionByConnector = [],
  generatedAt          = new Date(),
  pocMeta              = {},
  locale               = 'pt',
  s                    = {},
}) {
  _pageNum = 1
  _meta    = pocMeta
  _s       = s

  const fmt    = (iso) => fmtDate(iso, locale)
  const num    = (n)   => fmtNum(n, locale)
  const gb     = (n)   => fmtGB(n, locale)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Pre-compute all metrics from real API data ─────────────────────────────

  const openCases  = cases.filter(c => !['closed', 'resolved'].includes((c.status || '').toLowerCase()))
  const critCases  = cases.filter(c => c.severity?.toLowerCase() === 'critical')
  const highCases  = cases.filter(c => c.severity?.toLowerCase() === 'high')
  const medCases   = cases.filter(c => c.severity?.toLowerCase() === 'medium')
  const lowCases   = cases.filter(c => c.severity?.toLowerCase() === 'low')
  const activeConn = connectors.filter(c => c.active)
  const offlineConn = connectors.filter(c => !c.active)

  // Connector categories — grouped from real API data
  const connByCategory = connectors.reduce((acc, c) => {
    const cat = c.category || c.type || 'unknown'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  // MITRE data — derived from real case analysis
  const mitrRecs = recommendations.filter(r => r.category === 'MITRE ATT&CK')
  const opRecs   = recommendations.filter(r => r.category !== 'MITRE ATT&CK')
  const detectedTactics = new Set(mitrRecs.map(r => r.mitre?.tactic?.id).filter(Boolean))
  const mitreCovPct = Math.round((detectedTactics.size / ALL_TACTICS.length) * 100)

  // Entity data — from entity_usages API
  const avgEntities = assets.length > 0
    ? Math.round(assets.reduce((s, d) => s + (d.entity_count || 0), 0) / assets.length)
    : null

  // Ingestion totals — from ingestion-stats API
  const ingestSource = ingestionBySensor.length > 0 ? ingestionBySensor : ingestionByConnector
  const totalGbIngested = ingestSource.length > 0
    ? +ingestSource.reduce((sum, d) => sum + (d.gbIngested || 0), 0).toFixed(2)
    : null
  const totalEventsIngested = ingestSource.length > 0
    ? ingestSource.reduce((sum, d) => sum + (d.eventsCount || 0), 0)
    : null

  // pocMeta fields (user-entered)
  const {
    clientName   = '',
    clientDept   = '',
    seName       = '',
    partnerName  = '',
    seEmail      = '',
    pocStartDate = '',
    pocEndDate   = '',
    version      = '1.0',
    verdict      = s.verdictApproved || 'Approved',
  } = pocMeta

  const clientDisplay  = clientName  || '—'
  const seDisplay      = seName      || '—'
  const partnerDisplay = partnerName || '—'

  const period = pocStartDate && pocEndDate
    ? `${fmt(pocStartDate)} ${s.periodTo || 'a'} ${fmt(pocEndDate)}`
    : fmt(generatedAt.toISOString())

  const ingestionPeriod = pocEndDate
    ? `${fmt(new Date(new Date(pocEndDate).getTime() - 30 * 86400000).toISOString())} ${s.periodTo || 'a'} ${fmt(pocEndDate)}`
    : s.last30days || 'últimos 30 dias'

  const verdictColor = verdict === s.verdictApproved ? C.green
    : verdict === s.verdictRejected ? C.red
    : C.orange

  // ══════════════════════════════════════════════════════════════════════════════
  // COVER
  // ══════════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...C.blue)
  doc.rect(0, 0, PW, 32, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text('STELLAR CYBER', ML, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Open XDR Platform', ML, 21)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 210, 210)
  doc.text(s.confidential || 'CONFIDENTIAL', PW - MR, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...C.navy)
  doc.text(s.reportTitle1 || 'PROOF OF', PW / 2, 72, { align: 'center' })
  doc.text(s.reportTitle2 || 'CONCEPT REPORT', PW / 2, 88, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(12)
  doc.setTextColor(...C.blue)
  doc.text('Stellar Cyber Open XDR Platform', PW / 2, 101, { align: 'center' })

  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.7)
  doc.line(ML + 15, 107, PW - MR - 15, 107)

  // Prepared for box
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(ML, 114, 86, 52, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, 114, 86, 52, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text(s.preparedFor || 'PREPARED FOR', ML + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.text)
  const clientNameLines = doc.splitTextToSize(clientDisplay, 78)
  doc.text(clientNameLines, ML + 4, 130)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(clientDept || '—', 36), ML + 4, 130 + clientNameLines.length * 5 + 4)

  // Prepared by box
  const rx = PW - MR - 86
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(rx, 114, 86, 52, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.roundedRect(rx, 114, 86, 52, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text(s.preparedBy || 'PREPARED BY', rx + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...C.text)
  doc.text(trunc(seDisplay, 26), rx + 4, 134)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(partnerDisplay, 32), rx + 4, 143)
  if (seEmail) doc.text(trunc(seEmail, 36), rx + 4, 152)

  // Metadata table
  autoTable(doc, {
    startY: 176,
    body: [
      [s.metaVersion || 'Versão',  version],
      [s.metaPeriod  || 'Período', period],
      [s.metaDate    || 'Data',    fmt(generatedAt.toISOString())],
    ],
    styles:     { fontSize: 9.5, cellPadding: 4.5, textColor: C.text },
    bodyStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 55 },
      1: { cellWidth: CW - 55 },
    },
    margin:         { left: ML, right: MR },
    tableLineColor: C.blue,
    tableLineWidth: 0.3,
  })

  doc.setFillColor(...C.navy)
  doc.rect(0, PH - 22, PW, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.white)
  doc.text(s.confidential || 'CONFIDENTIAL', PW / 2, PH - 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(200, 210, 230)
  doc.text(s.coverDisclaimer || 'This document contains proprietary and confidential information.', PW / 2, PH - 6, { align: 'center' })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════

  let y = newPage(doc)
  y = sectionTitle(doc, 1, s.sec1 || 'Executive Summary', y)
  y = subTitle(doc, s.sec1_1 || '1.1 Key Indicators', y)

  // Build KPI rows — only from real API data
  const kpiRows = [
    [s.kpiPeriod || 'Evaluation Period', period],
    [s.kpiSources || 'Integrated Log Sources', num(connectors.length)],
    [s.kpiActiveConn || 'Active Sources', `${num(activeConn.length)} / ${num(connectors.length)}`],
    [s.kpiCasesDetected || 'Detected Alerts / Cases', num(cases.length)],
    [s.kpiOpenCases || 'Open Cases', num(openCases.length)],
    [s.kpiCritCases || 'Critical Cases', num(critCases.length)],
  ]

  if (totalGbIngested !== null) {
    kpiRows.push([s.kpiTotalIngestion || 'Total Ingested (30 days)', gb(totalGbIngested)])
  }
  if (totalEventsIngested !== null) {
    kpiRows.push([s.kpiTotalEvents || 'Total Events Ingested', num(totalEventsIngested)])
  }
  if (avgEntities !== null) {
    kpiRows.push([s.kpiAvgEntities || 'Monitored Entities (daily avg.)', num(avgEntities)])
  }

  kpiRows.push(
    [s.kpiMitreCov || 'MITRE ATT&CK Coverage',
     `${mitreCovPct}% (${i(s.kpiTacticsFmt || '{detected} of {total} tactics', { detected: detectedTactics.size, total: ALL_TACTICS.length })})`],
    [s.kpiFinalVerdict || 'Final Verdict', verdict],
  )

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.kpiIndicator || 'Indicator', s.kpiResult || 'Result']],
    body: kpiRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 95 },
      1: { cellWidth: CW - 95 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === kpiRows.length - 1) {
        d.cell.styles.textColor = verdictColor
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec1_2 || '1.2 Context and Objectives', y)
  y = bodyText(doc, i(s.body1_1 || 'This report presents the Stellar Cyber Open XDR PoC results for {client}.', { client: clientDisplay }), y)
  y += 4
  y = bodyText(doc, i(
    s.body1_2 || 'During {period}, {connCount} data sources were integrated ({activeCount} active), resulting in {caseCount} detected cases with {mitrePct}% MITRE ATT&CK coverage.',
    { period, connCount: connectors.length, activeCount: activeConn.length, caseCount: cases.length, mitrePct: mitreCovPct }
  ), y)
  y += 10

  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text(`${s.verdictLabel || 'Verdict'}: ${verdict}`, PW / 2, y + 10, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 26

  // ─── 1.3 Comments ─────────────────────────────────────────────────────────
  if (needsPage(doc, y, 30)) { y = newPage(doc) }
  y = subTitle(doc, s.sec1_3 || '1.3 SE Comments & Notes', y)
  const commentsText = (pocMeta.comments || '').trim()
  y = commentsText
    ? bodyText(doc, commentsText, y)
    : infoNote(doc, s.noComments || 'No additional comments recorded.', y)

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — SCOPE AND METHODOLOGY
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 2, s.sec2 || 'Scope and Methodology', y)
  y = subTitle(doc, s.sec2_1 || '2.1 Evaluated Environment', y)

  const envRows = [
    [s.envInstance || 'Stellar Cyber Instance', trunc(auth?.url || '—', 60)],
    [s.envUser     || 'Evaluation User',        auth?.username || '—'],
  ]

  if (auth?.tenant) {
    envRows.push([s.envTenant || 'Tenant ID', trunc(auth.tenant, 60)])
  }

  envRows.push(
    [s.envSensors   || 'Integrated Sources', i(s.connIntegrated || '{n} connectors', { n: connectors.length })],
    [s.envActiveConn || 'Active Connectors', `${num(activeConn.length)} / ${num(connectors.length)}`],
    [s.envPeriod    || 'Collection Period',  period],
  )

  if (totalGbIngested !== null) {
    envRows.push([s.envIngestionVol || 'Ingestion Volume (30 days)', gb(totalGbIngested)])
  }
  if (avgEntities !== null) {
    envRows.push([s.envEntities || 'Monitored Entities (avg)', num(avgEntities)])
  }

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.envComponent || 'Component', s.envDetails || 'Details']],
    body: envRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 75 },
      1: { cellWidth: CW - 75 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec2_2 || '2.2 Methodology Phases', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.phaseCol || 'Phase', s.activityCol || 'Activity', s.statusCol || 'Status']],
    body: [
      [s.phase1 || '1 — Integration',  s.phase1desc || 'Integration of log sources and sensors',     s.phaseCompleted || 'Completed'],
      [s.phase2 || '2 — Baseline',     s.phase2desc || 'Behavioral baseline establishment',           s.phaseCompleted || 'Completed'],
      [s.phase3 || '3 — Simulation',   s.phase3desc || 'Attack scenario execution and detection',     s.phaseCompleted || 'Completed'],
      [s.phase4 || '4 — Analysis',     s.phase4desc || 'Event correlation and MITRE ATT&CK mapping',  s.phaseCompleted || 'Completed'],
      [s.phase5 || '5 — Report',       s.phase5desc || 'Results documentation, gaps, recommendations', s.phaseCompleted || 'Completed'],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 112 },
      2: { cellWidth: CW - 154, halign: 'center', textColor: C.green, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec2_3 || '2.3 Success Criteria', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.critCol || 'Criterion', s.goalCol || 'Target', s.resultCol || 'Result', s.successStatus || 'Status']],
    body: [
      [
        s.crit1 || 'Source integration',
        s.crit1goal || '≥ 5 sources',
        i(s.crit1result || '{n} integrated', { n: connectors.length }),
        connectors.length >= 5 ? s.achieved || 'Achieved' : connectors.length >= 2 ? s.partial || 'Partial' : s.notAchieved || 'Not Achieved',
      ],
      [
        s.crit2 || 'Threat detection',
        s.crit2goal || '≥ 1 case',
        i(s.crit2result || '{n} detected', { n: cases.length }),
        cases.length >= 1 ? s.achieved || 'Achieved' : s.notAchieved || 'Not Achieved',
      ],
      [
        s.crit3 || 'MITRE ATT&CK coverage',
        s.crit3goal || '≥ 20%',
        `${mitreCovPct}%`,
        mitreCovPct >= 20 ? s.achieved || 'Achieved' : mitreCovPct >= 10 ? s.partial || 'Partial' : s.notAchieved || 'Not Achieved',
      ],
      [
        s.crit4 || 'Active sensors',
        s.crit4goal_active || '≥ 50% active',
        pct(activeConn.length, connectors.length),
        (activeConn.length / Math.max(connectors.length, 1)) >= 0.5 ? s.achieved || 'Achieved' : s.partial || 'Partial',
      ],
    ],
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: CW - 138, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        d.cell.styles.textColor = statusColor(d.cell.raw, s.achieved || 'Achieved', s.partial || 'Partial')
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — PLATFORM OVERVIEW & INTEGRATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 3, s.sec3 || 'Platform & Integrations Overview', y)

  // ─── 3.1 Connector / Sensor Summary (real data from connectors API) ──────────
  y = subTitle(doc, s.sec3_1_connSummary || '3.1 Sensor & Connector Summary', y)

  // Summary stats bar
  const statW = (CW - 6) / 4
  const statH = 18
  const stats = [
    { label: s.connTotal || 'Total', value: num(connectors.length), color: C.midBlue, textColor: C.white },
    { label: s.connActiveCount || 'Active', value: num(activeConn.length), color: C.green, textColor: C.white },
    { label: s.connInactiveCount || 'Inactive', value: num(offlineConn.length), color: offlineConn.length > 0 ? C.orange : C.gray, textColor: offlineConn.length > 0 ? C.white : C.muted },
    { label: s.connCategories || 'Categories', value: num(Object.keys(connByCategory).length), color: C.rowAlt, textColor: C.navy },
  ]

  stats.forEach((st, idx) => {
    const sx = ML + idx * (statW + 2)
    doc.setFillColor(...st.color)
    doc.roundedRect(sx, y, statW, statH, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...st.textColor)
    doc.text(st.value, sx + statW / 2, y + 11, { align: 'center' })
    doc.setFontSize(7)
    doc.text(st.label, sx + statW / 2, y + 16, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })
  y += statH + 8

  // ─── 3.2 Deployment details ────────────────────────────────────────────────
  y = subTitle(doc, s.sec3_2 || '3.2 Deployment Details', y)
  y = bodyText(doc, i(s.body3_2 || 'Evaluated instance: {url}. SaaS/Cloud deployment, secure access via REST API with Bearer JWT authentication.', { url: auth?.url || '—' }), y)
  y += 8

  // ─── 3.3 Configured Connectors (all real data) ────────────────────────────
  y = subTitle(doc, s.sec3_3 || '3.3 Configured Connectors', y)

  if (connectors.length === 0) {
    y = infoNote(doc, s.noConnectors || 'No connectors/sensors identified via API.', y)
    y += 4
  } else {
    autoTable(doc, {
      ...tableCompact(),
      startY: y,
      head: [[s.connName || 'Connector', s.connType || 'Type', s.connCategory || 'Category', s.connStatus || 'Status', s.connLastActivity || 'Last Activity']],
      body: connectors.slice(0, 40).map(c => [
        trunc(c.name || '—', 36),
        trunc(c.type || '—', 20),
        trunc(c.category || '—', 20),
        c.active ? (s.connOnline || 'Online') : (s.connOffline || 'Offline'),
        c.lastDataReceived ? fmt(c.lastDataReceived) : c.lastActivity ? fmt(c.lastActivity) : '—',
      ]),
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 36 },
        2: { cellWidth: 36 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: CW - 156, halign: 'center' },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw === (s.connOnline || 'Online') ? C.green : C.red
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 4
    if (connectors.length > 40) {
      y = infoNote(doc, i(s.showingOf || 'Showing {shown} of {total} connectors.', { shown: 40, total: connectors.length }), y)
    }
    y += 4
  }

  // ─── 3.4 Data Ingestion (from ingestion-stats API) ────────────────────────
  const hasIngestion = ingestionBySensor.length > 0 || ingestionByConnector.length > 0

  if (hasIngestion) {
    if (needsPage(doc, y, 70)) { y = newPage(doc) } else { y += 4 }
    y = subTitle(doc, s.sec3_ingestion || '3.4 Data Ingestion (last 30 days)', y)
    y = infoNote(doc, i(s.ingestPeriodNote || 'Period: {period}. Data from /ingestion-stats API.', { period: ingestionPeriod }), y)
    y += 4

    // Ingestion totals summary
    if (totalGbIngested !== null) {
      const tw = (CW - 4) / 3
      const tItems = [
        { label: s.ingestTotal || 'Total GB Ingested', value: gb(totalGbIngested) },
        { label: s.ingestTotalEvents || 'Total Events', value: num(totalEventsIngested) },
        { label: s.ingestSources || 'Sources with Data', value: num(ingestSource.length) },
      ]
      tItems.forEach((item, idx) => {
        const tx = ML + idx * (tw + 2)
        doc.setFillColor(...C.rowAlt)
        doc.roundedRect(tx, y, tw, 16, 2, 2, 'F')
        doc.setDrawColor(...C.midBlue)
        doc.setLineWidth(0.3)
        doc.roundedRect(tx, y, tw, 16, 2, 2, 'S')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...C.navy)
        doc.text(item.value, tx + tw / 2, y + 9, { align: 'center' })
        doc.setFontSize(6.5)
        doc.setTextColor(...C.muted)
        doc.text(item.label, tx + tw / 2, y + 14, { align: 'center' })
        doc.setFont('helvetica', 'normal')
      })
      y += 22
    }

    if (ingestionBySensor.length > 0) {
      y = subTitle(doc, s.sec3_ingestionSensor || 'Ingestion by Sensor', y)
      autoTable(doc, {
        ...tableCompact(),
        startY: y,
        head: [[s.ingestSensorName || 'Sensor', s.ingestType || 'Type', s.ingestGB || 'Volume (GB)', s.ingestEvents || 'Events']],
        body: ingestionBySensor.map(d => [
          trunc(d.name || '—', 50),
          trunc(d.type || '—', 26),
          d.gbIngested != null ? gb(d.gbIngested) : '—',
          d.eventsCount != null ? num(d.eventsCount) : '—',
        ]),
        columnStyles: {
          0: { cellWidth: 72, fontStyle: 'bold' },
          1: { cellWidth: 44 },
          2: { cellWidth: 34, halign: 'right' },
          3: { cellWidth: CW - 150, halign: 'right' },
        },
      })
      y = (doc.lastAutoTable?.finalY ?? y) + 6
    }

    if (ingestionByConnector.length > 0) {
      if (needsPage(doc, y, 50)) { y = newPage(doc) }
      y = subTitle(doc, s.sec3_ingestionConnector || 'Ingestion by Connector', y)
      autoTable(doc, {
        ...tableCompact(),
        startY: y,
        head: [[s.ingestConnName || 'Connector', s.ingestType || 'Type', s.ingestGB || 'Volume (GB)', s.ingestEvents || 'Events']],
        body: ingestionByConnector.map(d => [
          trunc(d.name || '—', 50),
          trunc(d.type || '—', 26),
          d.gbIngested != null ? gb(d.gbIngested) : '—',
          d.eventsCount != null ? num(d.eventsCount) : '—',
        ]),
        columnStyles: {
          0: { cellWidth: 72, fontStyle: 'bold' },
          1: { cellWidth: 44 },
          2: { cellWidth: 34, halign: 'right' },
          3: { cellWidth: CW - 150, halign: 'right' },
        },
      })
      y = (doc.lastAutoTable?.finalY ?? y) + 6
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — DETECTION AND RESPONSE RESULTS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 4, s.sec4 || 'Detection & Response Results', y)
  y = subTitle(doc, s.sec4_1 || '4.1 Detected Cases', y)

  if (cases.length === 0) {
    y = infoNote(doc, s.noCases || 'No cases detected during the evaluation period.', y)
    y += 4
  } else {
    const sevOrd = { critical: 0, high: 1, medium: 2, low: 3 }
    const sortedCases = [...cases]
      .sort((a, b) => (sevOrd[a.severity?.toLowerCase()] ?? 4) - (sevOrd[b.severity?.toLowerCase()] ?? 4))
      .slice(0, 50)

    autoTable(doc, {
      ...tableCompact({ styles: { fontSize: 8, cellPadding: 2.5, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 } }),
      startY: y,
      head: [[s.caseCol || 'Case / Alert', s.sevCol || 'Severity', s.caseStatusCol || 'Status', s.assetsCol || 'Assets', s.scoreCol || 'Score', s.dateCol || 'Date']],
      body: sortedCases.map(c => [
        trunc(c.name || c.id || '—', 52),
        (c.severity || '—').toUpperCase(),
        trunc(c.status || '—', 18),
        c.assetsAffected != null ? num(c.assetsAffected) : '—',
        c.score != null ? String(c.score) : '—',
        c.createdAt ? fmt(c.createdAt) : '—',
      ]),
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: CW - 150 },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 1) {
          d.cell.styles.textColor = sevColor(d.cell.raw)
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })

    y = (doc.lastAutoTable?.finalY ?? y) + 6
    if (cases.length > 50) {
      y = infoNote(doc, i(s.showingCases || 'Showing {shown} of {total} cases, sorted by severity.', { shown: 50, total: cases.length }), y)
      y += 4
    }
  }

  if (needsPage(doc, y, 55)) { y = newPage(doc) } else { y += 4 }
  y = subTitle(doc, s.sec4_2 || '4.2 Detection Metrics', y)

  const metricsBody = [
    [s.totalCasesLabel || 'Total Cases / Alerts',     num(cases.length)],
    [s.openCasesLabel  || 'Open Cases',               num(openCases.length)],
    [s.critCasesLabel  || 'Critical Cases',           num(critCases.length)],
    [s.highCasesLabel  || 'High Severity Cases',      num(highCases.length)],
    [s.medCasesLabel   || 'Medium Severity Cases',    num(medCases.length)],
    [s.lowCasesLabel   || 'Low Severity Cases',       num(lowCases.length)],
    [s.openRate        || 'Open Rate',                pct(openCases.length, cases.length)],
    [s.activeSensorsLabel || 'Active Sensors / Sources',
     i(s.sensorsOf || '{active} of {total}', { active: activeConn.length, total: connectors.length })],
  ]

  if (totalGbIngested !== null) {
    metricsBody.push([s.kpiTotalIngestion || 'Total Ingested (30 days)', gb(totalGbIngested)])
  }
  if (avgEntities !== null) {
    metricsBody.push([s.kpiAvgEntities || 'Monitored Entities (avg)', num(avgEntities)])
  }

  autoTable(doc, {
    ...tableBase({ tableWidth: 140 }),
    startY: y,
    head: [[s.metricCol || 'Metric', s.valueCol || 'Value']],
    body: metricsBody,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        const row = d.row.index
        if (row === 2 && critCases.length > 0) d.cell.styles.textColor = C.red
        if (row === 3 && highCases.length > 0) d.cell.styles.textColor = C.orange
      }
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — MITRE ATT&CK COVERAGE
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 5, s.sec5 || 'MITRE ATT&CK Coverage Analysis', y)
  y = subTitle(doc, s.sec5_1 || '5.1 Detected Tactic Mapping', y)

  if (mitrRecs.length === 0) {
    y = infoNote(doc, s.noMitre || 'No MITRE ATT&CK correlations derived from the current case set.', y)
    y += 4
  } else {
    autoTable(doc, {
      ...tableBase(),
      startY: y,
      head: [[s.mitreId || 'ID', s.mitreTactic || 'Tactic', s.mitreTechs || 'Detected Techniques', s.mitreCoverage || 'Coverage']],
      body: ALL_TACTICS.map(tactic => {
        const hits     = mitrRecs.filter(r => r.mitre?.tactic?.id === tactic.id)
        const techList = hits.map(r => r.mitre?.technique?.id).filter(Boolean).join(', ') || '—'
        return [tactic.id, tactic.name, techList, hits.length > 0 ? s.detected || 'Detected' : s.notDetected || 'Not Detected']
      }),
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 55 },
        2: { cellWidth: 75 },
        3: { cellWidth: CW - 152, halign: 'center' },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw === (s.detected || 'Detected') ? C.green : C.muted
          d.cell.styles.fontStyle = d.cell.raw === (s.detected || 'Detected') ? 'bold' : 'normal'
        }
      },
    })
  }

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  if (needsPage(doc, y, 40)) { y = newPage(doc) }
  y = subTitle(doc, s.sec5_2 || '5.2 Coverage Summary', y)

  const bw = (CW - 8) / 3
  const bh = 22

  ;[
    { value: `${mitreCovPct}%`, label: s.totalCoverage || 'Total Coverage', bg: C.midBlue, fg: C.white },
    { value: String(detectedTactics.size), label: s.tacticsDetected || 'Tactics Detected', bg: C.rowAlt, fg: C.navy },
    { value: String(mitrRecs.length), label: s.techniquesMapped || 'Techniques Mapped', bg: C.rowAlt, fg: C.navy },
  ].forEach(({ value, label, bg, fg }, idx) => {
    const bx = ML + idx * (bw + 4)
    doc.setFillColor(...bg)
    doc.roundedRect(bx, y, bw, bh, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(...fg)
    doc.text(value, bx + bw / 2, y + 13, { align: 'center' })
    doc.setFontSize(7.5)
    doc.text(label, bx + bw / 2, y + 19, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 6 — OPERATIONAL ASSESSMENT
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 6, s.sec6 || 'Operational Assessment', y)
  y = subTitle(doc, s.sec6_1 || '6.1 Incident Response Flow', y)
  y = infoNote(doc, s.sec6_note || 'Standard incident response methodology validated during the PoC.', y)
  y += 4

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.stepCol || 'Step', s.actionCol || 'Action', s.toolCol || 'Tool']],
    body: [
      [s.step1 || '1 — Detection',     s.step1action || 'Alert generated automatically by the platform',        s.step1tool || 'Stellar Cyber AI Engine'],
      [s.step2 || '2 — Triage',        s.step2action || 'Analyst reviews alert and correlated context',          s.step2tool || 'Stellar Cyber Console'],
      [s.step3 || '3 — Investigation', s.step3action || 'Timeline analysis and data pivots',                     s.step3tool || 'Security Data Lake'],
      [s.step4 || '4 — Containment',   s.step4action || 'Host isolation or IP block via integration',            s.step4tool || 'SOAR / EDR / Firewall'],
      [s.step5 || '5 — Remediation',   s.step5action || 'Cleanup, patch and service restoration',                s.step5tool || 'IT Team'],
      [s.step6 || '6 — Documentation', s.step6action || 'Case closed with timeline and RCA recorded',            s.step6tool || 'Stellar Cyber Cases'],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 95 },
      2: { cellWidth: CW - 137 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec6_3 || '6.2 Automation & Playbooks', y)
  y = bodyText(doc, s.body6_3 || 'The platform supports response automation via configurable playbooks (native SOAR), enabling automatic actions such as: alert enrichment with threat intelligence, team notifications, endpoint isolation, and malicious IP blocking.', y)

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 7 — MEASURED RESULTS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 7, s.sec7 || 'Measured Results & ROI', y)
  y = subTitle(doc, s.sec7_1_realMetrics || '7.1 Real PoC Metrics', y)
  y = infoNote(doc, s.sec7_note || 'All values below are real data obtained from the Stellar Cyber API during the evaluation period.', y)
  y += 6

  const realMetricsBody = [
    [s.rmConnCount   || 'Integrated connectors',     num(connectors.length)],
    [s.rmActiveConn  || 'Active connectors',          `${num(activeConn.length)} (${pct(activeConn.length, connectors.length)})`],
    [s.rmCaseCount   || 'Cases detected',             num(cases.length)],
    [s.rmOpenCases   || 'Open cases',                 num(openCases.length)],
    [s.rmCritCases   || 'Critical cases',             num(critCases.length)],
    [s.rmMitreCov    || 'MITRE ATT&CK coverage',      `${mitreCovPct}% (${detectedTactics.size} / ${ALL_TACTICS.length} tactics)`],
  ]

  if (totalGbIngested !== null) {
    realMetricsBody.push([s.rmIngestion || 'Total ingested (30 days)', gb(totalGbIngested)])
  }
  if (totalEventsIngested !== null) {
    realMetricsBody.push([s.rmEvents   || 'Total events ingested',     num(totalEventsIngested)])
  }
  if (avgEntities !== null) {
    realMetricsBody.push([s.rmEntities || 'Monitored entities (avg.)', num(avgEntities)])
  }

  autoTable(doc, {
    ...tableBase({ tableWidth: 148 }),
    startY: y,
    head: [[s.realMetricLabel || 'Metric', s.realMetricValue || 'Measured Value']],
    body: realMetricsBody,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 48, halign: 'center', textColor: C.blue, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec7_2 || '7.2 Expected Qualitative Benefits', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.benefitCol || 'Benefit', s.impactCol || 'Impact']],
    body: [
      [s.ben1 || 'Unified Visibility',       s.ben1impact || 'Correlates data across the entire attack surface in a single platform'],
      [s.ben2 || 'Alert Fatigue Reduction',  s.ben2impact || 'AI/ML prioritizes and groups alerts, reducing SOC operational noise'],
      [s.ben3 || 'Compliance & Audit',       s.ben3impact || 'Centralized logs facilitate audits and regulatory requirements'],
      [s.ben4 || 'Scalability',              s.ben4impact || 'Cloud-native architecture scales automatically with environment growth'],
      [s.ben5 || 'Team Consolidation',       s.ben5impact || 'One platform replaces multiple tools and specialized teams'],
    ],
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold' },
      1: { cellWidth: CW - 68 },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 8 — RISKS, GAPS AND RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 8, s.sec8 || 'Risks, Gaps & Recommendations', y)
  y = subTitle(doc, s.sec8_1 || '8.1 Identified Risks & Operational Gaps', y)

  if (opRecs.length === 0) {
    y = infoNote(doc, s.noRisks || 'No risks identified during the evaluation period.', y)
    y += 6
  } else {
    autoTable(doc, {
      ...tableCompact(),
      startY: y,
      head: [[s.priorityCol || 'Priority', s.riskCol || 'Risk / Gap', s.descCol || 'Description']],
      body: opRecs.slice(0, 18).map(r => [
        (r.priority || '—').toUpperCase(),
        trunc(r.title || '—', 50),
        trunc(r.description || '—', 65),
      ]),
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: CW - 89 },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 0) {
          const p = String(d.cell.raw).toLowerCase()
          d.cell.styles.textColor = p === 'critical' ? C.red : p === 'warning' ? C.orange : C.green
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 10
  }

  if (mitrRecs.length > 0) {
    if (needsPage(doc, y, 60)) { y = newPage(doc) }
    y = subTitle(doc, s.sec8_2 || '8.2 MITRE ATT&CK Technical Recommendations', y)

    autoTable(doc, {
      ...tableCompact({ styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 } }),
      startY: y,
      head: [[s.techCol || 'Technique', s.tacticCol || 'Tactic', s.casesCol || 'Cases', s.mitigationCol || 'Recommended Mitigation']],
      body: mitrRecs.slice(0, 15).map(r => [
        trunc(`${r.mitre?.technique?.id || ''} — ${r.mitre?.technique?.name || '—'}`, 50),
        r.mitre?.tactic?.name || '—',
        r.mitre?.affectedCases != null ? num(r.mitre.affectedCases) : '—',
        trunc(r.mitre?.mitigation || r.description || '—', 80),
      ]),
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 38 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: CW - 107 },
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 10
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 9 — NEXT STEPS
  // ══════════════════════════════════════════════════════════════════════════════

  if (needsPage(doc, y, 80)) { y = newPage(doc) } else { y += 6 }
  y = sectionTitle(doc, 9, s.sec9 || 'Next Steps', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.nextNum || '#', s.nextAction || 'Action', s.nextOwner || 'Owner', s.nextDeadline || 'Deadline']],
    body: [
      ['1', s.next1 || 'Formal PoC approval by technical leadership',            clientDisplay,                      s.days30 || '30 days'],
      ['2', s.next2 || 'Define scope and architecture for production deployment', `${seDisplay} / ${clientDisplay}`, s.days30 || '30 days'],
      ['3', s.next3 || 'Integrate all production log sources',                   clientDisplay,                      s.days60 || '60 days'],
      ['4', s.next4 || 'Configure response playbooks and automations',           seDisplay,                          s.days60 || '60 days'],
      ['5', s.next5 || 'SOC team training on Stellar Cyber platform',            seDisplay,                          s.days60 || '60 days'],
      ['6', s.next6 || 'Review MITRE coverage and tune detection rules',         seDisplay,                          s.days90 || '90 days'],
      ['7', s.next7 || 'Present consolidated results to executive board',        clientDisplay,                      s.days90 || '90 days'],
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 98 },
      2: { cellWidth: 50 },
      3: { cellWidth: CW - 156, halign: 'center' },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 10 — CONCLUSION
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 10, s.sec10 || 'Conclusion', y)
  y = subTitle(doc, s.sec10_1 || '10.1 Final Scorecard', y)
  y = infoNote(doc, s.scoreNote || 'Scores based on real API data only. N/A = no data available.', y)
  y += 4

  // Build scorecard from real data only
  const scoreItems = [
    {
      item: s.score1 || 'Detection Capability',
      score: cases.length > 0
        ? (critCases.length > 0 ? s.scoreExcellent || 'Excellent' : s.scoreGood || 'Good')
        : s.scoreFair || 'Fair',
    },
    {
      item: s.score2 || 'Source Integration',
      score: connectors.length >= 5
        ? s.scoreExcellent || 'Excellent'
        : connectors.length >= 2
          ? s.scoreGood || 'Good'
          : s.scoreFair || 'Fair',
    },
    {
      item: s.score3 || 'MITRE ATT&CK Coverage',
      score: mitreCovPct >= 40
        ? s.scoreExcellent || 'Excellent'
        : mitreCovPct >= 20
          ? s.scoreGood || 'Good'
          : s.scoreFair || 'Fair',
    },
    {
      item: s.score6 || 'Visibility & Correlation',
      score: cases.length > 0 && connectors.length > 0
        ? s.scoreExcellent || 'Excellent'
        : s.scoreGood || 'Good',
    },
  ]

  if (totalGbIngested !== null) {
    scoreItems.push({
      item:  s.scoreIngestion || 'Data Ingestion',
      score: totalGbIngested > 100
        ? s.scoreExcellent || 'Excellent'
        : totalGbIngested > 10
          ? s.scoreGood || 'Good'
          : s.scoreFair || 'Fair',
    })
  }

  if (activeConn.length > 0) {
    const activePct = activeConn.length / Math.max(connectors.length, 1)
    scoreItems.push({
      item:  s.scoreActiveSensors || 'Active Sensor Rate',
      score: activePct >= 0.8
        ? s.scoreExcellent || 'Excellent'
        : activePct >= 0.5
          ? s.scoreGood || 'Good'
          : s.scoreFair || 'Fair',
    })
  }

  autoTable(doc, {
    ...tableBase({ tableWidth: 140 }),
    startY: y,
    head: [[s.scoreCriterion || 'Evaluation Criterion', s.scoreRating || 'Rating']],
    body: scoreItems.map(si => [si.item, si.score]),
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        const v = d.cell.raw
        const excellent = s.scoreExcellent || 'Excellent'
        const good      = s.scoreGood      || 'Good'
        d.cell.styles.textColor = v === excellent ? C.green : v === good ? C.blue : C.orange
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 12

  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 18, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.white)
  doc.text(`${s.finalVerdictLabel || 'Final Verdict'}: ${verdict}`, PW / 2, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 26

  y = bodyText(doc, i(
    s.body10 || 'Based on the PoC results ({period}), the Stellar Cyber Open XDR platform demonstrated robust detection capabilities with {mitrePct}% MITRE ATT&CK coverage and {caseCount} cases detected for {client}.',
    { period, mitrePct: mitreCovPct, caseCount: cases.length, client: clientDisplay }
  ), y)
  y += 10

  // Signatures
  if (needsPage(doc, y, 45)) { y = newPage(doc) }
  y = subTitle(doc, s.sec10_2 || '10.2 Signatures', y)

  doc.setDrawColor(...C.muted)
  doc.setLineWidth(0.3)
  doc.line(ML, y + 20, ML + 82, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(seDisplay, ML, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(`${s.seRole || 'Systems Engineer'} — ${partnerDisplay}`, ML, y + 31)
  if (seEmail) doc.text(seEmail, ML, y + 37)

  doc.line(PW - MR - 82, y + 20, PW - MR, y + 20)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(clientDisplay, PW - MR - 82, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(clientDept || '—', PW - MR - 82, y + 31)

  // ══════════════════════════════════════════════════════════════════════════════
  // APPENDIX A — GLOSSARY
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = appendixTitle(doc, s.appA || 'Appendix A — Glossary', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.glossTerm || 'Term', s.glossDef || 'Definition']],
    body: [
      ['Open XDR',          s.gOpenXDR || 'Extended Detection and Response integrating multiple security data sources'],
      ['SIEM',              s.gSIEM    || 'Security Information and Event Management — centralized log correlation'],
      ['MITRE ATT\u0026CK', s.gMITRE  || 'Knowledge framework of adversarial tactics and techniques based on real observations'],
      ['SOC',               s.gSOC    || 'Security Operations Center'],
      ['MTTD',              s.gMTTD   || 'Mean Time to Detect — average time between occurrence and detection'],
      ['MTTR',              s.gMTTR   || 'Mean Time to Respond — average time between detection and containment'],
      ['PoC',               s.gPoC    || 'Proof of Concept — technology validation exercise'],
      ['TCO',               s.gTCO    || 'Total Cost of Ownership'],
      ['SOAR',              s.gSOAR   || 'Security Orchestration, Automation and Response'],
      ['IoC',               s.gIoC    || 'Indicator of Compromise — artifact indicating system compromise'],
      ['TTP',               s.gTTP    || 'Tactics, Techniques and Procedures — adversarial behavior set'],
    ],
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: CW - 38 },
    },
  })

  // APPENDIX B — VERSION CONTROL
  y = (doc.lastAutoTable?.finalY ?? y) + 14
  if (needsPage(doc, y, 40)) { y = newPage(doc) }
  y = appendixTitle(doc, s.appB || 'Appendix B — Version Control', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.versionCol || 'Version', s.dateCol2 || 'Date', s.authorCol || 'Author', s.changeDescCol || 'Description']],
    body: [
      [version, fmt(generatedAt.toISOString()), seDisplay, s.initialVersion || 'Initial Proof of Concept Report version'],
    ],
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 55 },
      3: { cellWidth: CW - 110 },
    },
  })

  return doc
}

export function downloadPDFReport(params) {
  const doc    = generatePDFReport(params)
  const meta   = params.pocMeta || {}
  const client = (meta.clientName || 'client').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const date   = new Date().toISOString().split('T')[0]
  doc.save(`poc-report-stellarcyber-${client}-${date}.pdf`)
}

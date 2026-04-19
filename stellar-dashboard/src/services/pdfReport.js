import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Color palette — matches PoC template ────────────────────────────────────
const C = {
  navy:    [31,  56,  100],   // #1F3864 — table headers
  blue:    [0,   112, 192],   // #0070C0 — section titles, accents
  midBlue: [46,  117, 182],   // #2E75B6 — highlight rows / cover accent
  rowAlt:  [235, 243, 251],   // #EBF3FB — alternating table rows
  white:   [255, 255, 255],
  text:    [30,  30,  30 ],
  muted:   [120, 120, 120],
  red:     [192, 0,   0  ],   // crítico
  green:   [0,   176, 80 ],   // #00B050
  orange:  [255, 130, 0  ],
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

// Simple interpolation helper: i(s.key, { var: val })
function i(str, vars = {}) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  )
}

// ─── Page chrome (header + footer on body pages) ─────────────────────────────

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

function tableBase(extra = {}) {
  return {
    styles:             { fontSize: 9, cellPadding: 3, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles:         { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin:             { left: ML, right: MR },
    ...extra,
  }
}

function pct(n, total) {
  return total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '0%'
}

function fmtDate(iso, locale) {
  if (!iso) return '—'
  const loc = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR'
  try { return new Date(iso).toLocaleDateString(loc) } catch { return String(iso) }
}

function trunc(str, n) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

function sevColor(sev) {
  const s = String(sev || '').toLowerCase()
  if (s === 'critical') return C.red
  if (s === 'high')     return C.orange
  if (s === 'medium')   return [200, 160, 0]
  return C.green
}

function scoreColor(val, s) {
  if (val === s.scoreExcellent) return C.green
  if (val === s.scoreGood)      return C.blue
  return C.orange
}

// 14 MITRE ATT&CK Enterprise tactics
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
  cases           = [],
  tenants         = [],
  connectors      = [],
  recommendations = [],
  generatedAt     = new Date(),
  pocMeta         = {},
  locale          = 'pt',
  s               = {},
}) {
  _pageNum = 1
  _meta    = pocMeta
  _s       = s

  const fmt = (iso) => fmtDate(iso, locale)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Pre-compute metrics
  const openCases  = cases.filter(c => !['closed', 'resolved'].includes((c.status || '').toLowerCase()))
  const critCases  = cases.filter(c => c.severity?.toLowerCase() === 'critical')
  const highCases  = cases.filter(c => c.severity?.toLowerCase() === 'high')
  const medCases   = cases.filter(c => c.severity?.toLowerCase() === 'medium')
  const lowCases   = cases.filter(c => c.severity?.toLowerCase() === 'low')
  const activeConn = connectors.filter(c => c.active)
  const mitrRecs   = recommendations.filter(r => r.category === 'MITRE ATT&CK')
  const opRecs     = recommendations.filter(r => r.category !== 'MITRE ATT&CK')

  const detectedTactics = new Set(mitrRecs.map(r => r.mitre?.tactic?.id).filter(Boolean))
  const mitreCovPct = Math.round((detectedTactics.size / ALL_TACTICS.length) * 100)

  const {
    clientName   = 'N/A',
    clientDept   = 'N/A',
    seName       = 'N/A',
    partnerName  = 'N/A',
    seEmail      = 'N/A',
    pocStartDate = '',
    pocEndDate   = '',
    version      = '1.0',
    verdict      = s.verdictApproved || 'Approved',
  } = pocMeta

  const period = pocStartDate && pocEndDate
    ? `${fmt(pocStartDate)} ${s.periodTo || 'to'} ${fmt(pocEndDate)}`
    : fmt(generatedAt.toISOString())

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
  doc.text(s.confidential, PW - MR, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...C.navy)
  doc.text(s.reportTitle1, PW / 2, 72, { align: 'center' })
  doc.text(s.reportTitle2, PW / 2, 88, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(12)
  doc.setTextColor(...C.blue)
  doc.text('Stellar Cyber Open XDR Platform', PW / 2, 101, { align: 'center' })

  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.7)
  doc.line(ML + 15, 107, PW - MR - 15, 107)

  // "Prepared for" box
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(ML, 114, 86, 46, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, 114, 86, 46, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text(s.preparedFor, ML + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(trunc(clientName, 28), ML + 4, 132)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(clientDept, 32), ML + 4, 141)

  // "Prepared by" box
  const rx = PW - MR - 86
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(rx, 114, 86, 46, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.roundedRect(rx, 114, 86, 46, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text(s.preparedBy, rx + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(trunc(seName, 28), rx + 4, 132)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(partnerName, 32), rx + 4, 141)
  doc.text(trunc(seEmail, 36), rx + 4, 149)

  // Metadata table
  autoTable(doc, {
    startY: 168,
    body: [
      [s.metaVersion, version,                           s.metaPeriod,  period],
      [s.metaDate,    fmt(generatedAt.toISOString()),    s.metaVerdict, verdict],
    ],
    styles:     { fontSize: 9.5, cellPadding: 4.5, textColor: C.text },
    bodyStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 40 },
      1: { cellWidth: 51 },
      2: { fontStyle: 'bold', textColor: C.navy, cellWidth: 40 },
      3: { cellWidth: 51, fontStyle: 'bold', textColor: verdictColor },
    },
    margin:         { left: ML, right: MR },
    tableLineColor: C.blue,
    tableLineWidth: 0.3,
  })

  // Cover footer
  doc.setFillColor(...C.navy)
  doc.rect(0, PH - 22, PW, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.white)
  doc.text(s.confidential, PW / 2, PH - 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(200, 210, 230)
  doc.text(s.coverDisclaimer, PW / 2, PH - 6, { align: 'center' })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════════

  let y = newPage(doc)
  y = sectionTitle(doc, 1, s.sec1, y)
  y = subTitle(doc, s.sec1_1, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.kpiIndicator, s.kpiResult]],
    body: [
      [s.kpiPeriod,        period],
      [s.kpiSources,       String(connectors.length)],
      [s.kpiCasesDetected, String(cases.length)],
      [s.kpiOpenCases,     String(openCases.length)],
      [s.kpiCritCases,     String(critCases.length)],
      [s.kpiMitreCov,      `${mitreCovPct}% (${i(s.kpiTacticsFmt, { detected: detectedTactics.size, total: ALL_TACTICS.length })})`],
      [s.kpiTenants,       String(tenants.length)],
      [s.kpiFinalVerdict,  verdict],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 90 },
      1: { cellWidth: CW - 90 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.index === 7) {
        d.cell.styles.textColor = verdictColor
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec1_2, y)
  y = bodyText(doc, i(s.body1_1, { client: clientName }), y)
  y += 4
  y = bodyText(doc, i(s.body1_2, { period, connCount: connectors.length, caseCount: cases.length, mitrePct: mitreCovPct }), y)
  y += 10

  // Verdict block
  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text(`${s.verdictLabel}: ${verdict}`, PW / 2, y + 10, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — SCOPE AND METHODOLOGY
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 2, s.sec2, y)
  y = subTitle(doc, s.sec2_1, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.envComponent, s.envDetails]],
    body: [
      [s.envInstance, trunc(auth?.url || '—', 60)],
      [s.envUser,     auth?.username || '—'],
      [s.envSensors,  i(s.connIntegrated, { n: connectors.length })],
      [s.envTenants,  i(s.entitiesMonitored, { n: tenants.length })],
      [s.envPeriod,   period],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 75 },
      1: { cellWidth: CW - 75 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec2_2, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.phaseCol, s.activityCol, s.statusCol]],
    body: [
      [s.phase1, s.phase1desc, s.phaseCompleted],
      [s.phase2, s.phase2desc, s.phaseCompleted],
      [s.phase3, s.phase3desc, s.phaseCompleted],
      [s.phase4, s.phase4desc, s.phaseCompleted],
      [s.phase5, s.phase5desc, s.phaseCompleted],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 112 },
      2: { cellWidth: CW - 154, halign: 'center', textColor: C.green, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec2_3, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.critCol, s.goalCol, s.resultCol, s.successStatus]],
    body: [
      [s.crit1, s.crit1goal, i(s.crit1result, { n: connectors.length }), connectors.length >= 5 ? s.achieved : s.partial],
      [s.crit2, s.crit2goal, i(s.crit2result, { n: cases.length }),      cases.length >= 1 ? s.achieved : s.notAchieved],
      [s.crit3, s.crit3goal, `${mitreCovPct}%`,                          mitreCovPct >= 20 ? s.achieved : s.partial],
      [s.crit4, s.crit4goal, s.crit4result,                              s.achieved],
    ],
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: CW - 138, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        const v = String(d.cell.raw)
        d.cell.styles.textColor = v === s.achieved ? C.green : v === s.partial ? C.orange : C.red
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — PLATFORM TECHNICAL OVERVIEW
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 3, s.sec3, y)
  y = subTitle(doc, s.sec3_1, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.compComponent, s.compDesc, s.compStatus]],
    body: [
      [s.comp1, s.comp1desc, s.compActive],
      [s.comp2, s.comp2desc, s.compActive],
      [s.comp3, s.comp3desc, s.compActive],
      [s.comp4, s.comp4desc, s.compActive],
      [s.comp5, s.comp5desc, s.compActive],
      [s.comp6, s.comp6desc, s.compActive],
      [s.comp7, s.comp7desc, s.compActive],
    ],
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' },
      1: { cellWidth: 100 },
      2: { cellWidth: CW - 158, halign: 'center', textColor: C.green, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec3_2, y)
  y = bodyText(doc, i(s.body3_2, { url: auth?.url || '—' }), y)
  y += 10

  y = subTitle(doc, s.sec3_3, y)

  if (connectors.length === 0) {
    y = bodyText(doc, s.noConnectors, y)
    y += 4
  } else {
    autoTable(doc, {
      ...tableBase({
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 },
      }),
      startY: y,
      head: [[s.connName, s.connType, s.connCategory, s.connStatus]],
      body: connectors.slice(0, 35).map(c => [
        trunc(c.name || '—', 42),
        trunc(c.type || '—', 22),
        trunc(c.category || '—', 22),
        c.active ? s.connOnline : s.connOffline,
      ]),
      columnStyles: {
        0: { cellWidth: 72, fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 44 },
        3: { cellWidth: CW - 158, halign: 'center' },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw === s.connOnline ? C.green : C.red
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 6
    if (connectors.length > 35) {
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.text(i(s.showingOf, { shown: 35, total: connectors.length }), ML, y)
      y += 6
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — DETECTION AND RESPONSE RESULTS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 4, s.sec4, y)
  y = subTitle(doc, s.sec4_1, y)

  if (cases.length === 0) {
    y = bodyText(doc, s.noCases, y)
    y += 4
  } else {
    const sevOrd = { critical: 0, high: 1, medium: 2, low: 3 }
    const sortedCases = [...cases]
      .sort((a, b) => (sevOrd[a.severity?.toLowerCase()] ?? 4) - (sevOrd[b.severity?.toLowerCase()] ?? 4))
      .slice(0, 50)

    autoTable(doc, {
      ...tableBase({
        styles:     { fontSize: 8, cellPadding: 2.5, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      }),
      startY: y,
      head: [[s.caseCol, s.sevCol, s.caseStatusCol, s.assetsCol, s.scoreCol, s.dateCol]],
      body: sortedCases.map(c => [
        trunc(c.name || c.id || '—', 56),
        (c.severity || '—').toUpperCase(),
        trunc(c.status || '—', 18),
        String(c.assetsAffected || 1),
        c.score != null ? String(c.score) : '—',
        fmt(c.createdAt),
      ]),
      columnStyles: {
        0: { cellWidth: 72 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 34 },
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
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.text(i(s.showingCases, { shown: 50, total: cases.length }), ML, y)
      y += 8
    }
  }

  if (y > 230) { y = newPage(doc) } else { y += 4 }
  y = subTitle(doc, s.sec4_2, y)

  autoTable(doc, {
    ...tableBase({ tableWidth: 130 }),
    startY: y,
    head: [[s.metricCol, s.valueCol]],
    body: [
      [s.totalCasesLabel,    String(cases.length)],
      [s.openCasesLabel,     String(openCases.length)],
      [s.critCasesLabel,     String(critCases.length)],
      [s.highCasesLabel,     String(highCases.length)],
      [s.medCasesLabel,      String(medCases.length)],
      [s.lowCasesLabel,      String(lowCases.length)],
      [s.openRate,           pct(openCases.length, cases.length)],
      [s.activeSensorsLabel, i(s.sensorsOf, { active: activeConn.length, total: connectors.length })],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 90 },
      1: { cellWidth: 40, halign: 'center' },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — MITRE ATT&CK COVERAGE
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 5, s.sec5, y)
  y = subTitle(doc, s.sec5_1, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.mitreId, s.mitreTactic, s.mitreTechs, s.mitreCoverage]],
    body: ALL_TACTICS.map(tactic => {
      const hits     = mitrRecs.filter(r => r.mitre?.tactic?.id === tactic.id)
      const covered  = hits.length > 0
      const techList = hits.map(r => r.mitre?.technique?.id).filter(Boolean).join(', ') || '—'
      return [tactic.id, tactic.name, techList, covered ? s.detected : s.notDetected]
    }),
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 75 },
      3: { cellWidth: CW - 152, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        d.cell.styles.textColor = d.cell.raw === s.detected ? C.green : C.muted
        d.cell.styles.fontStyle = d.cell.raw === s.detected ? 'bold' : 'normal'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  if (y > 240) { y = newPage(doc) }
  y = subTitle(doc, s.sec5_2, y)

  const bw = (CW - 8) / 3
  const bh = 22

  doc.setFillColor(...C.midBlue)
  doc.roundedRect(ML, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.white)
  doc.text(`${mitreCovPct}%`, ML + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text(s.totalCoverage, ML + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  const b2x = ML + bw + 4
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(b2x, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.navy)
  doc.text(`${detectedTactics.size}`, b2x + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text(s.tacticsDetected, b2x + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  const b3x = ML + (bw + 4) * 2
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(b3x, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.navy)
  doc.text(`${mitrRecs.length}`, b3x + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text(s.techniquesMapped, b3x + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 6 — OPERATIONAL ASSESSMENT
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 6, s.sec6, y)
  y = subTitle(doc, s.sec6_1, y)
  y = bodyText(doc, s.body6_1, y)
  y += 8

  y = subTitle(doc, s.sec6_2, y)
  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.stepCol, s.actionCol, s.toolCol]],
    body: [
      [s.step1, s.step1action, s.step1tool],
      [s.step2, s.step2action, s.step2tool],
      [s.step3, s.step3action, s.step3tool],
      [s.step4, s.step4action, s.step4tool],
      [s.step5, s.step5action, s.step5tool],
      [s.step6, s.step6action, s.step6tool],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 95 },
      2: { cellWidth: CW - 137 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec6_3, y)
  y = bodyText(doc, s.body6_3, y)

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 7 — ROI ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 7, s.sec7, y)
  y = subTitle(doc, s.sec7_1, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.tcoItem, s.tcoCurrent, s.tcoWithSC]],
    body: [
      [s.tco1, s.tco1current, s.tco1sc],
      [s.tco2, s.tco2current, s.tco2sc],
      [s.tco3, s.tco3current, s.tco3sc],
      [s.tco4, s.tco4current, s.tco4sc],
      [s.tco5, s.tco5current, s.tco5sc],
      [s.tco6, s.tco6current, i(s.tco6sc, { pct: mitreCovPct })],
    ],
    columnStyles: {
      0: { cellWidth: 78, fontStyle: 'bold' },
      1: { cellWidth: 56, halign: 'center' },
      2: { cellWidth: CW - 134, halign: 'center', textColor: C.blue, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, s.sec7_2, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.benefitCol, s.impactCol]],
    body: [
      [s.ben1, s.ben1impact],
      [s.ben2, s.ben2impact],
      [s.ben3, s.ben3impact],
      [s.ben4, s.ben4impact],
      [s.ben5, s.ben5impact],
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
  y = sectionTitle(doc, 8, s.sec8, y)
  y = subTitle(doc, s.sec8_1, y)

  if (recommendations.length === 0) {
    y = bodyText(doc, s.noRisks, y)
    y += 6
  } else {
    autoTable(doc, {
      ...tableBase({
        styles: { fontSize: 8.5, cellPadding: 2.8, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 },
      }),
      startY: y,
      head: [[s.priorityCol, s.riskCol, s.descCol]],
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
    if (y > 210) { y = newPage(doc) }
    y = subTitle(doc, s.sec8_2, y)

    autoTable(doc, {
      ...tableBase({
        styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      }),
      startY: y,
      head: [[s.techCol, s.tacticCol, s.casesCol, s.mitigationCol]],
      body: mitrRecs.slice(0, 15).map(r => [
        `${r.mitre?.technique?.id} — ${r.mitre?.technique?.name}`,
        r.mitre?.tactic?.name || '—',
        String(r.mitre?.affectedCases ?? '—'),
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

  if (y > 215) { y = newPage(doc) } else { y += 6 }
  y = sectionTitle(doc, 9, s.sec9, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.nextNum, s.nextAction, s.nextOwner, s.nextDeadline]],
    body: [
      ['1', s.next1, clientName,                  s.days30],
      ['2', s.next2, `${seName} / ${clientName}`, s.days30],
      ['3', s.next3, clientName,                  s.days60],
      ['4', s.next4, seName,                      s.days60],
      ['5', s.next5, seName,                      s.days60],
      ['6', s.next6, seName,                      s.days90],
      ['7', s.next7, clientName,                  s.days90],
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
  y = sectionTitle(doc, 10, s.sec10, y)
  y = subTitle(doc, s.sec10_1, y)

  const scoreItems = [
    { item: s.score1, score: cases.length > 0 ? (critCases.length > 0 ? s.scoreExcellent : s.scoreGood) : s.scoreFair },
    { item: s.score2, score: connectors.length >= 5 ? s.scoreExcellent : connectors.length >= 2 ? s.scoreGood : s.scoreFair },
    { item: s.score3, score: mitreCovPct >= 40 ? s.scoreExcellent : mitreCovPct >= 20 ? s.scoreGood : s.scoreFair },
    { item: s.score4, score: s.scoreGood },
    { item: s.score5, score: s.scoreGood },
    { item: s.score6, score: cases.length > 0 ? s.scoreExcellent : s.scoreGood },
  ]

  autoTable(doc, {
    ...tableBase({ tableWidth: 140 }),
    startY: y,
    head: [[s.scoreCriterion, s.scoreRating]],
    body: scoreItems.map(si => [si.item, si.score]),
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        d.cell.styles.textColor = scoreColor(d.cell.raw, s)
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
  doc.text(`${s.finalVerdictLabel}: ${verdict}`, PW / 2, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 26

  y = bodyText(doc, i(s.body10, { period, mitrePct: mitreCovPct, caseCount: cases.length, client: clientName }), y)
  y += 10

  // Signatures
  if (y > 240) { y = newPage(doc) }
  y = subTitle(doc, s.sec10_2, y)

  doc.setDrawColor(...C.muted)
  doc.setLineWidth(0.3)
  doc.line(ML, y + 20, ML + 82, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(seName, ML, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(`${s.seRole} — ${partnerName}`, ML, y + 31)
  doc.text(seEmail, ML, y + 37)

  doc.line(PW - MR - 82, y + 20, PW - MR, y + 20)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(clientName, PW - MR - 82, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(clientDept, PW - MR - 82, y + 31)

  // ══════════════════════════════════════════════════════════════════════════════
  // APPENDIX A — GLOSSARY
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = appendixTitle(doc, s.appA, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.glossTerm, s.glossDef]],
    body: [
      ['Open XDR',           s.gOpenXDR],
      ['SIEM',               s.gSIEM],
      ['MITRE ATT\u0026CK',  s.gMITRE],
      ['SOC',                s.gSOC],
      ['MTTD',               s.gMTTD],
      ['MTTR',               s.gMTTR],
      ['PoC',                s.gPoC],
      ['TCO',                s.gTCO],
      ['SOAR',               s.gSOAR],
      ['IoC',                s.gIoC],
      ['TTP',                s.gTTP],
      ['LGPD / GDPR',        s.gLGPD],
    ],
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: CW - 38 },
    },
  })

  // ── APPENDIX B — VERSION CONTROL ─────────────────────────────────────────────

  y = (doc.lastAutoTable?.finalY ?? y) + 14
  if (y > 240) { y = newPage(doc) }
  y = appendixTitle(doc, s.appB, y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [[s.versionCol, s.dateCol2, s.authorCol, s.changeDescCol]],
    body: [
      [version, fmt(generatedAt.toISOString()), seName, s.initialVersion],
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

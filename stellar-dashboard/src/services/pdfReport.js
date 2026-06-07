import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

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

const PW = 210, PH = 297, ML = 14, MR = 14, CW = PW - ML - MR

let _pageNum = 0, _meta = {}, _s = {}

// ─── Utilities ────────────────────────────────────────────────────────────────
function i(doc, arr) { doc.setFillColor(...arr) }
function fmtDate(d) {
  if (!d) return '—'
  try {
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt.getTime())) return String(d)
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return String(d) }
}
function fmtNum(n) {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (isNaN(num)) return String(n)
  return num.toLocaleString('pt-BR')
}
function fmtGB(bytes) {
  if (!bytes || bytes === 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return gb.toFixed(2) + ' GB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return mb.toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(2) + ' KB'
}
function trunc(str, max) {
  const m = max || 45
  if (!str) return '—'
  return String(str).length > m ? String(str).slice(0, m - 1) + '…' : String(str)
}
function pct(a, b) {
  if (!b || b === 0) return '0%'
  return Math.round((a / b) * 100) + '%'
}
function sevColor(sev) {
  const sv = (sev || '').toLowerCase()
  if (sv === 'critical') return C.red
  if (sv === 'high') return C.orange
  if (sv === 'medium') return C.yellow
  return C.green
}
function statusColor(st) {
  const sv = (st || '').toLowerCase()
  if (sv === 'open' || sv === 'new') return C.orange
  if (sv === 'closed' || sv === 'resolved' || sv === 'analyzed') return C.green
  return C.muted
}

// ─── Chrome (header/footer) ───────────────────────────────────────────────────
function addChrome(doc) {
  const pg = _pageNum
  // Header strip
  i(doc, C.navy)
  doc.rect(0, 0, PW, 10, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('STELLAR CYBER', ML, 6.5)
  doc.setFont('helvetica', 'normal')
  doc.text(_s.headerSub || ' | Stellar Cyber XDR Platform', ML + 26, 6.5)
  doc.text(String(pg), PW - MR, 6.5, { align: 'right' })

  // Footer strip
  i(doc, C.navy)
  doc.rect(0, PH - 8, PW, 8, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  const clientName = _meta.clientName || ''
  doc.text(
    clientName
      ? `${_s.footerConfidential || 'CONFIDENTIAL'} — ${clientName}`
      : (_s.footerConfidential || 'CONFIDENTIAL'),
    ML, PH - 3
  )
  doc.text(_s.footerCopy || '© Stellar Cyber, Inc.', PW - MR, PH - 3, { align: 'right' })
}

function newPage(doc) {
  doc.addPage()
  _pageNum += 1
  addChrome(doc)
  return 18
}

function needsPage(doc, y, needed) {
  const n = needed || 30
  if (y + n > PH - 16) return newPage(doc)
  return y
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
function sectionTitle(doc, text, y, size) {
  const fs = size || 9.5
  const barH = fs > 10 ? 10 : 7.5
  y = needsPage(doc, y, 16)
  i(doc, C.navy)
  doc.rect(ML, y, CW, barH, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs)
  doc.text(text, ML + 3, y + barH * 0.69)
  return y + barH + 3
}

function appendixTitle(doc, text, y) {
  y = needsPage(doc, y, 16)
  i(doc, C.midBlue)
  doc.rect(ML, y, CW, 7.5, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(text, ML + 3, y + 5.2)
  return y + 7.5 + 3
}

function subTitle(doc, text, y, size) {
  const fs = size || 9
  y = needsPage(doc, y, 12)
  doc.setTextColor(...C.midBlue)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs)
  doc.text(text, ML, y)
  doc.setDrawColor(...C.midBlue)
  doc.setLineWidth(0.3)
  doc.line(ML, y + 2, ML + CW, y + 2)
  return y + fs * 0.9
}

function bodyText(doc, text, y, opts) {
  const o = opts || {}
  const lineH = o.lineH || 4.5
  const fontSize = o.fontSize || 8.5
  const color = o.color || C.text
  const x = o.x || ML
  const maxW = o.maxW || CW
  doc.setTextColor(...color)
  doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    y = needsPage(doc, y, lineH + 2)
    doc.text(line, x, y)
    y += lineH
  }
  return y
}

function infoNote(doc, text, y) {
  y = needsPage(doc, y, 12)
  i(doc, C.rowAlt)
  doc.rect(ML, y, CW, 8, 'F')
  doc.setTextColor(...C.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text(text, ML + 3, y + 5)
  return y + 8
}

// ─── Table helpers ────────────────────────────────────────────────────────────
function tableBase(doc, head, body, y, opts) {
  const o = opts || {}
  autoTable(doc, Object.assign({
    startY: y,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: C.text },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin: { left: ML, right: MR },
    tableWidth: CW,
    didDrawPage: () => { _pageNum += 1; addChrome(doc) },
  }, o))
  return doc.lastAutoTable.finalY + 4
}

function tableCompact(doc, head, body, y, opts) {
  const o = opts || {}
  autoTable(doc, Object.assign({
    startY: y,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: C.midBlue, textColor: C.white, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 1.8, textColor: C.text },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin: { left: ML, right: MR },
    tableWidth: CW,
    didDrawPage: () => { _pageNum += 1; addChrome(doc) },
  }, o))
  return doc.lastAutoTable.finalY + 4
}

// ─── Chart rendering ──────────────────────────────────────────────────────────
const PX_PER_MM = 8
const pxpt = n => Math.round(n * PX_PER_MM * 0.353)

function renderChartPNG(configFactory, wMm, hMm) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(wMm * PX_PER_MM)
    canvas.height = Math.round(hMm * PX_PER_MM)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const cfg = configFactory()
    cfg.options = Object.assign({}, cfg.options || {}, { responsive: false, animation: false, devicePixelRatio: 1 })
    const chart = new Chart(ctx, cfg)
    chart.update('none')
    const png = canvas.toDataURL('image/png')
    chart.destroy()
    return png
  } catch (_e) { return null }
}

function rgb(arr) { return `rgb(${arr[0]},${arr[1]},${arr[2]})` }
function rgba(arr, a) { return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})` }

function donutChart(labels, data, colors) {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(rgb),
        borderColor: colors.map(c => rgba(c, 0.85)),
        borderWidth: 2,
      }],
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: { size: pxpt(7), family: 'Arial' },
            color: rgb(C.text),
            padding: pxpt(5),
            boxWidth: pxpt(8),
            boxHeight: pxpt(7),
          },
        },
        tooltip: { enabled: false },
      },
    },
  }
}

function gaugeChart(valuePct, color) {
  return {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [valuePct, 100 - valuePct],
        backgroundColor: [rgb(color), rgb(C.gray)],
        borderColor: [rgb(color), rgb(C.gray)],
        borderWidth: 0,
        circumference: 270,
        rotation: -135,
      }],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  }
}

function hBarChart(labels, data, colors) {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(rgb),
        borderColor: colors.map(c => rgba(c, 0.85)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { color: rgba(C.muted, 0.15) },
          ticks: { font: { size: pxpt(6.5), family: 'Arial' }, color: rgb(C.muted) },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: pxpt(7), family: 'Arial' }, color: rgb(C.text) },
        },
      },
    },
  }
}

function lineChart(labels, data, color) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: rgb(color),
        backgroundColor: rgba(color, 0.15),
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: data.map(v => v > 0 ? pxpt(1.5) : 0),
        pointBackgroundColor: rgb(color),
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: pxpt(6), family: 'Arial' }, color: rgb(C.muted), maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: rgba(C.muted, 0.15) },
          ticks: { font: { size: pxpt(6), family: 'Arial' }, color: rgb(C.muted), precision: 0 },
        },
      },
    },
  }
}

// ─── MITRE tactics ────────────────────────────────────────────────────────────
const ALL_TACTICS = [
  { id: 'TA0001', name: 'Initial Access' },
  { id: 'TA0002', name: 'Execution' },
  { id: 'TA0003', name: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation' },
  { id: 'TA0005', name: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access' },
  { id: 'TA0007', name: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement' },
  { id: 'TA0009', name: 'Collection' },
  { id: 'TA0010', name: 'Exfiltration' },
  { id: 'TA0011', name: 'Command and Control' },
  { id: 'TA0040', name: 'Impact' },
  { id: 'TA0042', name: 'Resource Development' },
  { id: 'TA0043', name: 'Reconnaissance' },
]

// ─── Timeline data builder ────────────────────────────────────────────────────
function buildTimelineData(cases, pocStartDate, pocEndDate) {
  if (!pocStartDate || !pocEndDate) return { labels: [], data: [] }
  const start = new Date(pocStartDate)
  const end   = new Date(pocEndDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { labels: [], data: [] }
  const days = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  // Only use cases with createdAt and severity critical or high
  const relevant = cases.filter(c =>
    c.createdAt && ['critical', 'high'].includes((c.severity || '').toLowerCase())
  )
  const data = days.map(day => {
    const dayStr = day.toISOString().split('T')[0]
    return relevant.filter(c => c.createdAt && c.createdAt.startsWith(dayStr)).length
  })
  const labels = days.map(d => {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${dd}/${mm}`
  })
  return { labels, data }
}

// ─── Detection types builder ──────────────────────────────────────────────────
// Grouped by c.name (only stable type-identifying field; no alertType/xdrEventType
// in normalizeCase). alertCount = c.size || assets_affected || alert_count || 1 from API.
function buildDetectionTypes(cases) {
  const groups = {}
  for (const c of cases) {
    const key = (c.name || '—').replace(/ and \d+ other\(s\)$/i, '').trim()
    if (!groups[key]) groups[key] = { total: 0, scores: [] }
    groups[key].total += (c.alertCount || 1)
    if (c.score != null) groups[key].scores.push(c.score)
  }
  return Object.entries(groups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, g]) => {
      const avgScore = g.scores.length > 0
        ? g.scores.reduce((sum, v) => sum + v, 0) / g.scores.length
        : 50
      const color = avgScore >= 80 ? C.red : avgScore <= 40 ? C.orange : C.blue
      return { name, total: g.total, color }
    })
}

// ─── Cover info-block helper ──────────────────────────────────────────────────
function drawInfoBlock(doc, heading, x, y, fields, headingColor, maxW) {
  const blockW = maxW || 78
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...headingColor)
  doc.text(heading, x, y)
  doc.setDrawColor(...headingColor)
  doc.setLineWidth(0.3)
  doc.line(x, y + 1.5, x + blockW, y + 1.5)
  let fy = y + 7
  for (const f of fields) {
    if (f.val) {
      doc.setFont('helvetica', f.bold ? 'bold' : 'normal')
      doc.setFontSize(f.size)
      doc.setTextColor(...(f.bold ? C.navy : C.muted))
      const lines = doc.splitTextToSize(String(f.val), blockW)
      for (const line of lines) {
        doc.text(line, x, fy)
        fy += f.size * 0.5 + 1.8
      }
    }
  }
}

// ─── Cover page ───────────────────────────────────────────────────────────────
function drawCover(doc, pocMeta, s) {
  _pageNum = 1
  // No addChrome on cover page

  // 1. Left accent rail: navy→blue gradient using 60 thin horizontal strips
  const stripH = PH / 60
  for (let k = 0; k < 60; k++) {
    const t = k / 59
    const r = Math.round(C.navy[0] + t * (C.blue[0] - C.navy[0]))
    const g2 = Math.round(C.navy[1] + t * (C.blue[1] - C.navy[1]))
    const b2 = Math.round(C.navy[2] + t * (C.blue[2] - C.navy[2]))
    doc.setFillColor(r, g2, b2)
    doc.rect(0, k * stripH, 11, stripH + 0.5, 'F')
  }

  // 2. Header at y≈18mm
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...C.navy)
  doc.text('STELLAR CYBER', 26, 18)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.blue)
  doc.text('  |  Open XDR', 26 + doc.getTextWidth('STELLAR CYBER'), 18)

  // CONFIDENTIAL pill right-aligned
  const pillLabel = s.coverConfidential || 'CONFIDENTIAL'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const pillW = doc.getTextWidth(pillLabel) + 6
  const pillX = PW - MR - pillW
  const pillY = 12.5
  doc.setDrawColor(...C.blue)
  doc.setFillColor(...C.white)
  doc.setLineWidth(0.5)
  doc.roundedRect(pillX, pillY, pillW, 6, 1.5, 1.5, 'D')
  doc.setTextColor(...C.blue)
  doc.text(pillLabel, pillX + 3, pillY + 4.2)

  // Hero lines
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(38)
  doc.setTextColor(...C.navy)
  doc.text(s.coverTitle1 || 'Stellar Cyber XDR', 26, 98)
  doc.text(s.coverTitle2 || 'Platform', 26, 114)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...C.muted)
  doc.text(s.coverReportType || 'Proof of Concept Report', 26, 125)

  // Thin gray rule
  doc.setDrawColor(...C.gray)
  doc.setLineWidth(0.5)
  doc.line(26, 130, 96, 130)

  // 4. Info grid — 2×2 table layout starting y≈190mm (2cm above original)
  const blockY  = 190
  const colL    = 26          // left column x
  const colR    = 113         // right column x
  const rowH    = 46          // height of each row block
  const divX    = 108         // vertical divider
  const row2Y   = blockY + rowH + 5
  const colLW   = divX - colL - 4   // max text width left col (~78mm)
  const colRW   = PW - MR - colR - 2 // max text width right col (~81mm)

  // Light grid separators
  doc.setDrawColor(...C.gray)
  doc.setLineWidth(0.25)
  doc.line(divX, blockY - 3, divX, row2Y + rowH)   // vertical
  doc.line(colL, row2Y - 3, PW - MR, row2Y - 3)    // horizontal between rows

  // ── Row 1 Left: PREPARED FOR (client) ──────────────────────────────────────
  drawInfoBlock(doc, s.blockPreparedFor || 'PREPARED FOR', colL, blockY, [
    { val: pocMeta.clientName,  bold: true,  size: 10 },
    { val: pocMeta.clientDept,  bold: false, size: 8 },
    { val: pocMeta.clientEmail, bold: false, size: 8 },
  ], C.blue, colLW)

  // ── Row 1 Right: STELLAR CYBER ANALYST ────────────────────────────────────
  drawInfoBlock(doc, s.blockStellarCyber || 'STELLAR CYBER SYSTEM ENGINEER', colR, blockY, [
    { val: pocMeta.seName,  bold: true,  size: 10 },
    { val: pocMeta.seEmail, bold: false, size: 8 },
    { val: pocMeta.sePhone, bold: false, size: 8 },
  ], C.navy, colRW)

  // ── Row 2 Left: STAKEHOLDERS (analysts list) ───────────────────────────────
  const analystsJoined = (pocMeta.analysts || []).filter(Boolean).join('; ')
  drawInfoBlock(doc, s.blockStakeholders || 'STAKEHOLDERS', colL, row2Y, [
    { val: analystsJoined, bold: false, size: 8 },
  ], C.blue, colLW)

  // ── Row 2 Right: PARTNER ──────────────────────────────────────────────────
  drawInfoBlock(doc, s.blockPartner || 'PARTNER', colR, row2Y, [
    { val: pocMeta.partnerName,  bold: true,  size: 10 },
    { val: pocMeta.partnerEmail, bold: false, size: 8 },
    { val: pocMeta.partnerSite,  bold: false, size: 8 },
  ], C.navy, colRW)

  // 5. Metadata footer at y≈283mm
  const version  = pocMeta.version || '1.0'
  const pocStart = fmtDate(pocMeta.pocStartDate)
  const pocEnd   = fmtDate(pocMeta.pocEndDate)
  const reportDt = fmtDate(new Date())

  doc.setFontSize(7.5)
  let fX = 26
  const footY = 283
  const footParts = [
    { label: s.footerVersion    || 'Version',    value: version },
    { label: s.footerPocPeriod  || 'PoC Period', value: `${pocStart}–${pocEnd}` },
    { label: s.footerReportDate || 'Report Date', value: reportDt },
  ]
  for (let idx = 0; idx < footParts.length; idx++) {
    if (idx > 0) {
      doc.setTextColor(...C.muted)
      doc.setFont('helvetica', 'normal')
      doc.text('  |  ', fX, footY)
      fX += doc.getTextWidth('  |  ')
    }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.navy)
    doc.text(footParts[idx].label + ' ', fX, footY)
    fX += doc.getTextWidth(footParts[idx].label + ' ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(footParts[idx].value, fX, footY)
    fX += doc.getTextWidth(footParts[idx].value)
  }
}

// ─── KPI card helper ──────────────────────────────────────────────────────────
function drawKpiCard(doc, x, y, w, h, value, label, color) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.white)
  doc.text(String(value), x + w / 2, y + h * 0.46, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  const labelLines = doc.splitTextToSize(label, w - 2)
  const lineH = 3.2
  const totalH = labelLines.length * lineH
  const startY = y + h * 0.62 + (h * 0.35 - totalH) / 2
  labelLines.forEach((line, i) => {
    doc.text(line, x + w / 2, startY + i * lineH, { align: 'center' })
  })
}

// ─── Chart title helper ───────────────────────────────────────────────────────
function drawChartTitle(doc, text, x, y, w) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text(text, x + w / 2, y, { align: 'center' })
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generatePDFReport({
  auth,
  cases = [],
  lowCount = 0,
  mediumTotal = 0,
  connectors = [],
  assets = [],
  recommendations = [],
  ingestionBySensor = [],
  ingestionByConnector = [],
  caseTactics = null,
  generatedAt = new Date(),
  pocMeta = {},
  locale = 'pt',
  s = {},
}) {
  _meta = pocMeta
  _s    = s

  // ── Derived counts ──────────────────────────────────────────────────────────
  const critCases  = cases.filter(c => (c.severity || '').toLowerCase() === 'critical')
  const highCases  = cases.filter(c => (c.severity || '').toLowerCase() === 'high')
  const openCases  = cases.filter(c => {
    const st = (c.status || '').toLowerCase()
    return st === 'open' || st === 'new'
  })
  const resolvedCases = cases.filter(c => {
    const st = (c.status || '').toLowerCase()
    return st !== 'open' && st !== 'new'
  })
  const activeConn = connectors.filter(c =>
    c.status === 'active' || c.enabled === true || c.active === true
  )

  // Avg entities/day from assets[] shape: [{ date, entity_count }]
  // entity_count = daily active entities (hosts/users/devices), NOT alerts
  const avgEntities = (() => {
    if (!assets || assets.length === 0) return null
    const valid = assets.filter(a => a.entity_count != null && a.entity_count > 0)
    if (!valid.length) return null
    const avg = valid.reduce((sum, a) => sum + Number(a.entity_count), 0) / valid.length
    const locStr = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-MX' : 'en-US'
    return Math.round(avg).toLocaleString(locStr)
  })()

  // Total displayed (crit + high + mediumTotal + lowCount)
  const totalCasesCount = critCases.length + highCases.length + mediumTotal + lowCount
  const totalCasesStr   = fmtNum(totalCasesCount)

  // MITRE coverage — real data from API (caseTactics populated by DataContext.fetchCaseTactics)
  // Falls back to recommendations-based detection when caseTactics is unavailable.
  const detectedTactics = caseTactics?.mitre?.detectedTacticIds || (() => {
    const fb = new Set()
    for (const rec of recommendations) {
      if (rec.mitre && rec.mitre.tactic) fb.add(rec.mitre.tactic)
    }
    return fb
  })()
  const mitreTechniqueData = caseTactics?.mitre?.techniques  || []
  const stellarTacticData  = caseTactics?.stellar?.tactics   || []
  const stellarTechData    = caseTactics?.stellar?.techniques || []
  const mitreCovPct = Math.round((detectedTactics.size / ALL_TACTICS.length) * 100)

  // Connectors by category
  const connByCategory = {}
  for (const conn of connectors) {
    const cat = conn.category || conn.type || s.connectorCatOther || 'Other'
    connByCategory[cat] = (connByCategory[cat] || 0) + 1
  }

  // Recommendations split
  const opRecs   = recommendations.filter(r => r.category !== 'MITRE ATT&CK')
  const mitrRecs = recommendations.filter(r => r.category === 'MITRE ATT&CK')

  // Verdict
  const verdict = pocMeta.verdict || ''
  const verdictColor = (() => {
    const v = verdict.toLowerCase()
    if (v === 'approved' || v === 'aprovado' || v === 'go') return C.green
    if (v === 'conditional' || v === 'condicional') return C.orange
    return C.red
  })()

  // Ingestion total — uses bytesIngested (mapped from API total_ingestion)
  const totalIngest = ingestionBySensor.reduce((sum, r) => sum + (r.bytesIngested || r.bytes || r.size || 0), 0)

  // ── Create PDF ──────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'normal')

  // ════════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════════
  drawCover(doc, pocMeta, s)

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Page 3: Context and Objectives + Success Criteria
  // ════════════════════════════════════════════════════════════════════════════
  let y = newPage(doc)
  y = sectionTitle(doc, s.sec1 || '1. Executive Summary', y, 12)
  y += 4

  // ── 1.2 Context and Objectives ──────────────────────────────────────────────
  y = subTitle(doc, s.sub1_2 || '1.2 Context and Objectives', y, 11)
  const body1_1 = (
    s.body1_1 ||
    "This Proof of Concept evaluated Stellar Cyber's Open XDR platform against the security environment of {clientName}. The assessment covered {pocStartDate} to {pocEndDate}."
  )
    .replace('{clientName}',   pocMeta.clientName || s.clientNamePlaceholder || 'the client')
    .replace('{client}',       pocMeta.clientName || s.clientNamePlaceholder || 'the client')
    .replace('{pocStartDate}', fmtDate(pocMeta.pocStartDate))
    .replace('{pocEndDate}',   fmtDate(pocMeta.pocEndDate))
  y = bodyText(doc, body1_1, y, { fontSize: 10.5, lineH: 5.5 })
  y += 4

  if (pocMeta.successCriteria && pocMeta.successCriteria.length > 0) {
    const critItems = String(pocMeta.successCriteria)
      .split(/[;\n]/)
      .map(c => c.trim())
      .filter(Boolean)
    if (critItems.length > 0) {
      y = needsPage(doc, y, 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...C.navy)
      doc.text(s.successCriteriaTitle || 'Critérios de Sucesso:', ML, y)
      y += 7
      for (const crit of critItems) {
        y = needsPage(doc, y, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.setTextColor(...C.text)
        const lines = doc.splitTextToSize(`• ${crit}`, CW - 6)
        doc.text(lines, ML + 3, y)
        y += lines.length * 5.5
      }
      y += 3
    }
  }

  const body1_2 = (s.body1_2 ||
    "The primary objective was to validate detection capabilities, response workflows, and integration breadth across the customer's existing security stack.")
    .replace('{startDate}',  fmtDate(pocMeta.pocStartDate))
    .replace('{endDate}',    fmtDate(pocMeta.pocEndDate))
    .replace('{connCount}',  String(connectors.length))
    .replace('{caseCount}',  String(totalCasesCount))
    .replace('{mitrePct}',   String(mitreCovPct))
  y = bodyText(doc, body1_2, y, { fontSize: 10.5, lineH: 5.5 })
  y += 4

  // ════════════════════════════════════════════════════════════════════════════
  // Page 4: Executive Summary — 1.1 KPI Cards + Charts + Table
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)

  // ── 1.1 KPI Cards ──────────────────────────────────────────────────────────
  y = subTitle(doc, s.sub1_1 || '1.1 Key Performance Indicators', y)

  const cardGap = 2
  const cardH   = 22
  const kpiCards = [
    { label: s.kpiCasesDetected  || 'Casos Detectados',      value: totalCasesStr,                               color: C.blue    },
    { label: s.kpiCritCases      || 'Críticos',              value: String(critCases.length),                    color: C.red     },
    { label: s.kpiOpenCases      || 'Casos Abertos',         value: String(openCases.length),                    color: C.orange  },
    { label: s.kpiResolvedCases  || 'Casos Resolvidos',      value: String(resolvedCases.length),                color: C.green   },
    { label: s.kpiAvgEntities    || 'Média Assets monitorado/Dia',  value: avgEntities || '—',                     color: C.navy    },
    { label: s.kpiActiveConn     || 'Conectores',            value: `${activeConn.length}/${connectors.length}`, color: C.midBlue },
    { label: s.kpiMitreCov       || 'MITRE ATT&CK',          value: `${mitreCovPct}%`,                           color: C.blue    },
  ]
  const cardW = (CW - cardGap * (kpiCards.length - 1)) / kpiCards.length
  for (let k = 0; k < kpiCards.length; k++) {
    const kx = ML + k * (cardW + cardGap)
    drawKpiCard(doc, kx, y, cardW, cardH, kpiCards[k].value, kpiCards[k].label, kpiCards[k].color)
  }
  y += cardH + 5

  // ── 2×2 Chart dashboard ────────────────────────────────────────────────────
  const chartW = (CW - 6) / 2
  const chartH = 62

  // Row 1: Severity donut (left) | Status donut (right)
  const sevData  = [critCases.length, highCases.length, mediumTotal, lowCount]
  const sevTotal = sevData.reduce((a, b) => a + b, 0)

  const c1x = ML
  const c1y = y + 5
  drawChartTitle(doc, s.chartSeverity || 'Case Severity', c1x, c1y - 1, chartW)
  if (sevTotal > 0) {
    const sevPng = renderChartPNG(
      () => donutChart(
        [
          s.sevCritical || 'Critical',
          s.sevHigh     || 'High',
          s.sevMedium   || 'Medium',
          s.sevLow      || 'Low',
        ],
        sevData,
        [C.red, C.orange, C.yellow, C.green]
      ),
      chartW, chartH
    )
    if (sevPng) {
      doc.addImage(sevPng, 'PNG', c1x, c1y, chartW, chartH)
      const cx1 = c1x + chartW / 2
      const cy1 = c1y + chartH * 0.37
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...C.navy)
      doc.text(fmtNum(sevTotal), cx1, cy1, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.muted)
      doc.text(s.totalLabel || 'total', cx1, cy1 + 4, { align: 'center' })
    }
  }

  // Status donut — uses cases.length (crit+high+top100med displayed), NOT totalCasesCount
  const c2x = ML + chartW + 6
  const c2y = y + 5
  drawChartTitle(doc, s.chartStatus || 'Case Status', c2x, c2y - 1, chartW)
  if (cases.length > 0) {
    const closedCount = cases.length - openCases.length
    const statusPng = renderChartPNG(
      () => donutChart(
        [s.statusOpen || 'Open', s.statusClosed || 'Analyzed'],
        [openCases.length, closedCount],
        [C.orange, C.midBlue]
      ),
      chartW, chartH
    )
    if (statusPng) {
      doc.addImage(statusPng, 'PNG', c2x, c2y, chartW, chartH)
      const cx2 = c2x + chartW / 2
      const cy2 = c2y + chartH * 0.37
      const openPct2 = cases.length > 0 ? Math.round((openCases.length / cases.length) * 100) : 0
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...C.orange)
      doc.text(fmtNum(openCases.length), cx2, cy2, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.muted)
      doc.text(`open · ${openPct2}%`, cx2, cy2 + 4, { align: 'center' })
    }
  }
  y += chartH + 8

  // Row 2: MITRE gauge (left) | Sources by category donut (right)
  const c3x = ML
  const c3y = y + 5
  drawChartTitle(doc, s.chartMitre || 'MITRE Coverage', c3x, c3y - 1, chartW)
  const gaugePng = renderChartPNG(
    () => gaugeChart(mitreCovPct, C.blue),
    chartW, chartH
  )
  if (gaugePng) {
    doc.addImage(gaugePng, 'PNG', c3x, c3y, chartW, chartH)
    const cx3 = c3x + chartW / 2
    const cy3 = c3y + chartH * 0.45
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...C.blue)
    doc.text(`${mitreCovPct}%`, cx3, cy3, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.muted)
    doc.text(s.chartMitreLabel || 'tactic coverage', cx3, cy3 + 5, { align: 'center' })
  }

  const c4x = ML + chartW + 6
  const c4y = y + 5
  drawChartTitle(doc, s.chartSources || 'Sources by Category', c4x, c4y - 1, chartW)
  if (connectors.length > 0) {
    const catLabels  = Object.keys(connByCategory)
    const catData    = Object.values(connByCategory)
    const catPalette = [C.blue, C.midBlue, C.navy, C.green, C.orange, C.yellow, C.red]
    const srcPng = renderChartPNG(
      () => donutChart(catLabels, catData, catPalette.slice(0, catLabels.length)),
      chartW, chartH
    )
    if (srcPng) {
      doc.addImage(srcPng, 'PNG', c4x, c4y, chartW, chartH)
      const cx4 = c4x + chartW / 2
      const cy4 = c4y + chartH * 0.37
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...C.navy)
      doc.text(fmtNum(connectors.length), cx4, cy4, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...C.muted)
      doc.text(s.sourcesLabel || 'sources', cx4, cy4 + 4, { align: 'center' })
    }
  }
  y += chartH + 8

  // ── KPI Summary Table ───────────────────────────────────────────────────────
  y = needsPage(doc, y, 30)
  const kpiRows = [
    [
      s.kpiCasesDetected || 'Cases / Alerts',
      totalCasesStr,
      `${critCases.length} ${s.critLabel || 'critical'}, ${highCases.length} ${s.highLabel || 'high'}`,
    ],
    [
      s.kpiAvgEntities || 'Média Assets monitorado/Dia',
      avgEntities || '—',
      s.kpiEntitiesNote || 'Média de assets ativos por dia (hosts / usuários / dispositivos)',
    ],
    [
      s.kpiActiveConn || 'Active Sources',
      `${activeConn.length} / ${connectors.length}`,
      s.kpiConnNote || 'Active data sources connected',
    ],
    [
      s.kpiMitreCov || 'MITRE Coverage',
      `${mitreCovPct}% (${detectedTactics.size}/${ALL_TACTICS.length})`,
      s.kpiMitreNote || 'Tactics detected out of 14',
    ],
    [
      s.kpiOpenCases || 'Open Cases',
      String(openCases.length),
      pct(openCases.length, totalCasesCount) + ` ${s.ofTotal || 'of total'}`,
    ],
  ]
  y = tableBase(doc,
    [s.kpiMetric || 'Metric', s.kpiValue || 'Value', s.kpiNotes || 'Notes'],
    kpiRows, y
  )

  // ════════════════════════════════════════════════════════════════════════════
  // ARCHITECTURE PAGE
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = appendixTitle(doc, s.secArch || 'Arquitetura Mínima Sugerida', y)
  if (pocMeta.architectureImage) {
    try {
      const imgData = pocMeta.architectureImage
      const maxW = CW
      const maxH = 160
      const dims = pocMeta.architectureImageDims
      const PX_TO_MM = 25.4 / 96
      const imgW = dims ? dims.w * PX_TO_MM : maxW
      const imgH = dims ? dims.h * PX_TO_MM : maxH
      // scale down only — never upscale a small image
      const ratio = Math.min(1, maxW / imgW, maxH / imgH)
      const drawW = imgW * ratio
      const drawH = imgH * ratio
      const drawX = ML + (CW - drawW) / 2
      doc.addImage(imgData, 'PNG', drawX, y, drawW, drawH)
      y += drawH + 6
    } catch (_e) {
      y = infoNote(doc, s.archImageError || 'Architecture image could not be rendered.', y)
      y += 4
    }
  } else {
    y = infoNote(
      doc,
      s.noArchImage || 'No architecture diagram provided. Add an image to pocMeta.architectureImage.',
      y
    )
    y += 4
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Environment & Methodology
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec2 || '2. Evaluated Environment & Methodology', y)

  // 2.1 Environment table (WITHOUT tenant ID)
  y = subTitle(doc, s.sub2_1 || '2.1 Evaluated Environment', y)
  const env2Rows = [
    [s.envClient   || 'Client',           pocMeta.clientName      || '—'],
    [s.envDept     || 'Department',       pocMeta.clientDept      || '—'],
    [s.envSE       || 'SE / Analyst',     pocMeta.seName          || '—'],
    [s.envPartner  || 'Partner',          pocMeta.partnerName     || '—'],
    [s.envStart    || 'PoC Start',        fmtDate(pocMeta.pocStartDate)],
    [s.envEnd      || 'PoC End',          fmtDate(pocMeta.pocEndDate)],
    [s.envVersion  || 'Platform Version', pocMeta.platformVersion || '—'],
    [s.envRegion   || 'Region',           pocMeta.region          || '—'],
  ]
  y = tableBase(doc,
    [s.envParam || 'Parameter', s.envValue || 'Value'],
    env2Rows, y,
    { columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: CW - 55 } } }
  )

  // 2.2 Methodology Phases
  y = needsPage(doc, y, 20)
  y = subTitle(doc, s.sub2_2 || '2.2 Methodology Phases', y)
  const methRows = s.methodologyPhases || [
    ['1', s.phase1 || 'Kickoff & Scoping',     s.phase1desc || 'Define success criteria, environments and integrations.'],
    ['2', s.phase2 || 'Deployment',             s.phase2desc || 'Install sensors, configure connectors, validate data flow.'],
    ['3', s.phase3 || 'Detection Validation',   s.phase3desc || 'Execute attack simulations and verify detections.'],
    ['4', s.phase4 || 'Response & Automation',  s.phase4desc || 'Validate playbooks, SOAR workflows and response times.'],
    ['5', s.phase5 || 'Reporting & Debrief',    s.phase5desc || 'Analyze results, identify gaps and present findings.'],
  ]
  y = tableBase(doc,
    [s.phaseNum || '#', s.phaseName || 'Phase', s.phaseDesc || 'Description'],
    methRows, y,
    { columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 2: { cellWidth: CW - 55 } } }
  )

  // 2.3 Success Criteria
  y = needsPage(doc, y, 20)
  y = subTitle(doc, s.sub2_3 || '2.3 Success Criteria', y)
  const scBase = s.successCriteriaRows || [
    [s.sc1 || 'Detection Rate',         s.sc1target || '≥ 85% of simulated attacks detected'],
    [s.sc2 || 'Time to Detect (MTTD)',  s.sc2target || '< 5 minutes average'],
    [s.sc3 || 'Integration Coverage',   s.sc3target || '≥ 80% of existing tools integrated'],
    [s.sc4 || 'False Positive Rate',    s.sc4target || '< 10% of total alerts'],
  ]
  y = tableBase(doc,
    [s.scCriteria || 'Criterion', s.scTarget || 'Target'],
    scBase, y,
    { columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: CW - 60 } } }
  )

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Data Sources
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = sectionTitle(doc, s.sec3 || '3. Data Sources & Ingestion', y)

  // 3.1 Stat cards (4 boxes)
  y = subTitle(doc, s.sub3_1 || '3.1 Ingestion Overview', y)
  const statCardW = (CW - 9) / 4
  const statCardH = 18
  const statCards = [
    { label: s.statTotalSources  || 'Total Sources',  value: fmtNum(connectors.length),       color: C.navy    },
    { label: s.statActiveSources || 'Active Sources', value: fmtNum(activeConn.length),       color: C.green   },
    { label: s.statTotalIngested || 'Total Ingested', value: fmtGB(totalIngest),              color: C.blue    },
    { label: s.statSensorTypes   || 'Sensor Types',   value: fmtNum(ingestionBySensor.length),color: C.midBlue },
  ]
  for (let k = 0; k < statCards.length; k++) {
    const sx = ML + k * (statCardW + 3)
    drawKpiCard(doc, sx, y, statCardW, statCardH, statCards[k].value, statCards[k].label, statCards[k].color)
  }
  y += statCardH + 5

  // Bytes lookup for 3.2 table: connector name → bytesIngested (from /ingestion-stats/connector)
  const connIngestionLookup = {}
  for (const r of ingestionByConnector) {
    if (r.name) connIngestionLookup[r.name] = r.bytesIngested || 0
  }

  // 3.2 Connectors table
  y = needsPage(doc, y, 20)
  y = subTitle(doc, s.sub3_2 || '3.2 Connected Sources', y)
  if (connectors.length === 0) {
    y = infoNote(doc, s.noConnectors || 'No connectors data available.', y)
    y += 4
  } else {
    const connRows = connectors.map(c => [
      trunc(c.name || c.id || '—', 35),
      c.type || c.category || '—',
      c.status || (c.active ? 'active' : 'inactive'),
      fmtDate(c.lastDataReceived || c.lastActivity),
      fmtGB(connIngestionLookup[c.name] || 0),
    ])
    y = tableCompact(doc,
      [s.connName || 'Name', s.connType || 'Type', s.connStatus || 'Status', s.connLastSeen || 'Last Seen', s.connIngested || 'Ingested'],
      connRows, y
    )
  }

  // 3.3 Data ingestion detail (conditional)
  // Note: ingestion endpoints return total_ingestion (bytes) only — no event count available.
  if (ingestionBySensor.length > 0 || ingestionByConnector.length > 0) {
    y = needsPage(doc, y, 20)
    y = subTitle(doc, s.sub3_3 || '3.3 Data Ingestion Detail', y)
    if (ingestionBySensor.length > 0) {
      const sensorRows = ingestionBySensor.map(r => [
        trunc(r.name || r.sensor || '—', 40),
        fmtGB(r.bytesIngested || r.bytes || r.size || 0),
      ])
      y = tableCompact(doc,
        [s.sensorName || 'Sensor', s.sensorBytes || 'Volume'],
        sensorRows, y
      )
    }
    if (ingestionByConnector.length > 0) {
      y = needsPage(doc, y, 20)
      const connIngRows = ingestionByConnector.map(r => [
        trunc(r.name || r.connector || '—', 40),
        fmtGB(r.bytesIngested || r.bytes || r.size || 0),
      ])
      y = tableCompact(doc,
        [s.connIngName || 'Connector', s.connIngBytes || 'Volume'],
        connIngRows, y
      )
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Detection & Response
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec4 || '4. Detection & Response', y)

  if (cases.length === 0) {
    y = infoNote(doc, s.noCases || 'No cases data available for this PoC period.', y)
    y += 4
  } else {
    // ── Timeline chart (full width CW × 45mm) ──────────────────────────────
    const tlData = buildTimelineData(cases, pocMeta.pocStartDate, pocMeta.pocEndDate)
    if (tlData.labels.length > 0) {
      y = needsPage(doc, y, 55)
      drawChartTitle(doc, s.chartTimeline || 'Daily Critical & High Cases', ML, y + 3, CW)
      const tlPng = renderChartPNG(
        () => lineChart(tlData.labels, tlData.data, C.red),
        CW, 45
      )
      if (tlPng) {
        doc.addImage(tlPng, 'PNG', ML, y + 5, CW, 45)
        y += 52
      }
    }

    // ── Detection types bar chart (CW × 50mm) ──────────────────────────────
    const detTypes = buildDetectionTypes(cases)
    if (detTypes.length > 0) {
      y = needsPage(doc, y, 60)
      drawChartTitle(doc, s.chartDetectionTypes || 'Top Detection Types (by analyzed cases)', ML, y + 3, CW)
      const dtPng = renderChartPNG(
        () => hBarChart(
          detTypes.map(d => trunc(d.name, 40)),
          detTypes.map(d => d.total),
          detTypes.map(d => d.color)
        ),
        CW, 50
      )
      if (dtPng) {
        doc.addImage(dtPng, 'PNG', ML, y + 5, CW, 50)
        y += 57
      }
    }

    // ── 4.1 Detected Cases table ─────────────────────────────────────────────
    y = needsPage(doc, y, 20)
    y = subTitle(doc, s.sub4_1 || '4.1 Detected Cases', y)

    // crit + high + top 100 medium
    const displayCases = [
      ...critCases,
      ...highCases,
      ...cases.filter(c => (c.severity || '').toLowerCase() === 'medium').slice(0, 100),
    ]
    const caseRows = displayCases.map(c => [
      trunc(c.name || c.id || '—', 35),
      c.severity || '—',
      c.status   || '—',
      c.score    != null ? String(c.score) : '—',
      c.alertCount != null ? String(c.alertCount) : '—',
      fmtDate(c.rawDate || c.createdAt),
    ])
    y = tableCompact(doc,
      [
        s.caseName   || 'Case',
        s.caseSev    || 'Severity',
        s.caseStatus || 'Status',
        s.caseScore  || 'Score',
        s.caseAlerts || 'Alertas',
        s.caseDate   || 'Date',
      ],
      caseRows, y, {
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.styles.textColor = sevColor(data.cell.text[0])
            data.cell.styles.fontStyle = 'bold'
          }
          if (data.section === 'body' && data.column.index === 2) {
            data.cell.styles.textColor = statusColor(data.cell.text[0])
          }
        },
      }
    )

    if (mediumTotal > 100) {
      y = infoNote(
        doc,
        (s.mediumTruncated || 'Showing top 100 medium cases. Total medium cases: {n}')
          .replace('{n}', fmtNum(mediumTotal)),
        y
      )
      y += 4
    }
    if (lowCount > 0) {
      y = infoNote(
        doc,
        (s.lowOmitted || '{n} low-severity cases omitted from table for brevity.')
          .replace('{n}', fmtNum(lowCount)),
        y
      )
      y += 4
    }

    // ── 4.2 Detection Metrics ────────────────────────────────────────────────
    y = needsPage(doc, y, 20)
    y = subTitle(doc, s.sub4_2 || '4.2 Detection Metrics', y)
    const avgScore = cases.length > 0
      ? Math.round(cases.reduce((sum, c) => sum + (c.score || 0), 0) / cases.length)
      : 0
    const detMetRows = [
      [s.metCritical  || 'Critical Cases', fmtNum(critCases.length),                    pct(critCases.length, totalCasesCount)],
      [s.metHigh      || 'High Cases',     fmtNum(highCases.length),                    pct(highCases.length, totalCasesCount)],
      [s.metMedium    || 'Medium Cases',   fmtNum(mediumTotal),                         pct(mediumTotal, totalCasesCount)],
      [s.metLow       || 'Low Cases',      fmtNum(lowCount),                            pct(lowCount, totalCasesCount)],
      [s.metOpen      || 'Open Cases',     fmtNum(openCases.length),                    pct(openCases.length, totalCasesCount)],
      [s.metAvgScore  || 'Average Score',  String(avgScore),                            ''],
    ]
    y = tableBase(doc,
      [s.metMetric || 'Metric', s.metValue || 'Value', s.metPct || 'Of Total'],
      detMetRows, y,
      { columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 35 }, 2: { cellWidth: CW - 105 } } }
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — MITRE ATT&CK
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec5 || '5. MITRE ATT&CK Coverage', y)
  y = subTitle(doc, s.sub5_1 || '5.1 Tactic Coverage', y)

  // 5.1 Table
  const tacticRows = ALL_TACTICS.map(t => {
    const detected = detectedTactics.has(t.id) || detectedTactics.has(t.name)
    return [t.id, t.name, detected ? (s.detected || 'Detected') : (s.notDetected || 'Not Detected')]
  })
  y = tableBase(doc,
    [s.tacticId || 'Tactic ID', s.tacticName || 'Tactic', s.tacticStatus || 'Status'],
    tacticRows, y, {
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 80 }, 2: { cellWidth: CW - 105 } },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 2) {
          const isDetected = data.cell.text[0] === (s.detected || 'Detected')
          data.cell.styles.textColor = isDetected ? C.green : C.muted
          data.cell.styles.fontStyle = isDetected ? 'bold' : 'normal'
        }
      },
    }
  )

  // ── MITRE tactic grid (14 cells, jsPDF primitives) ──────────────────────────
  y = needsPage(doc, y, 45)
  const gridCols = 7
  const gridGap  = 1
  const cellW = (CW - gridGap * (gridCols - 1)) / gridCols
  const cellH = 14
  for (let ti = 0; ti < ALL_TACTICS.length; ti++) {
    const tactic = ALL_TACTICS[ti]
    const col = ti % gridCols
    const row = Math.floor(ti / gridCols)
    const tx = ML + col * (cellW + gridGap)
    const ty = y + row * (cellH + gridGap)
    const isDetected = detectedTactics.has(tactic.id) || detectedTactics.has(tactic.name)
    doc.setFillColor(...(isDetected ? C.navy : C.gray))
    doc.roundedRect(tx, ty, cellW, cellH, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...(isDetected ? C.white : C.muted))
    doc.text(tactic.id, tx + cellW / 2, ty + 4.2, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    const nameLines = doc.splitTextToSize(tactic.name, cellW - 2)
    const nameY = ty + 8
    for (let nl = 0; nl < Math.min(nameLines.length, 2); nl++) {
      doc.text(nameLines[nl], tx + cellW / 2, nameY + nl * 4, { align: 'center' })
    }
  }
  const gridRowCount = Math.ceil(ALL_TACTICS.length / gridCols)
  y += gridRowCount * (cellH + gridGap) + 6

  // ── MITRE techniques bar chart (real API data) ──────────────────────────────
  const topMitreTech = mitreTechniqueData.slice(0, 10)
  if (topMitreTech.length > 0) {
    y = needsPage(doc, y, 65)
    drawChartTitle(doc, s.chartTechniques || 'Top MITRE Techniques by Cases', ML, y + 3, CW)
    const techPng = renderChartPNG(
      () => hBarChart(
        topMitreTech.map(r => trunc(`${r.id} — ${r.name}`, 45)),
        topMitreTech.map(r => r.caseCount),
        topMitreTech.map(() => C.blue)
      ),
      CW, 55
    )
    if (techPng) {
      doc.addImage(techPng, 'PNG', ML, y + 5, CW, 55)
      y += 62
    }
  }

  // ── 5.2 Coverage Summary ─────────────────────────────────────────────────────
  y = needsPage(doc, y, 20)
  y = subTitle(doc, s.sub5_2 || '5.2 Coverage Summary', y)
  const covCardW = (CW - 6) / 3
  const covCardH = 16
  const covCards = [
    { label: s.covDetected    || 'Detected Tactics',    value: String(detectedTactics.size),                    color: C.blue  },
    { label: s.covNotDetected || 'Not Detected',        value: String(ALL_TACTICS.length - detectedTactics.size),color: C.muted },
    { label: s.covTotal       || 'Total MITRE Tactics', value: String(ALL_TACTICS.length),                      color: C.navy  },
  ]
  for (let k = 0; k < covCards.length; k++) {
    const cx = ML + k * (covCardW + 3)
    drawKpiCard(doc, cx, y, covCardW, covCardH, covCards[k].value, covCards[k].label, covCards[k].color)
  }
  y += covCardH + 6

  // ── 5.3 Stellar Cyber XDR Proprietary Detections ────────────────────────────
  if (stellarTacticData.length > 0) {
    y = needsPage(doc, y, 20)
    y = subTitle(doc, s.sub5_3 || '5.3 Detecções Proprietárias Stellar Cyber XDR', y)
    y = bodyText(doc,
      s.body5_3 ||
      'Além do framework MITRE ATT&CK, a plataforma Stellar Cyber conta com um motor de análise comportamental proprietário (XDR) que detecta ameaças com táticas e técnicas exclusivas, ampliando a cobertura além dos 14 táticas padrão.',
      y, { fontSize: 10, lineH: 5.2 }
    )
    y += 3

    // XDR Tactics table
    const xdrTacticRows = stellarTacticData.map(t => [t.id, t.name, String(t.caseCount), String(t.alertCount)])
    y = tableBase(doc,
      [
        s.xtaTacticId   || 'Tática (ID)',
        s.xtaTacticName || 'Tática XDR',
        s.xtaCases      || 'Cases',
        s.xtaAlerts     || 'Alertas',
      ],
      xdrTacticRows, y, {
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: CW - 88 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
        },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.textColor = C.blue
            data.cell.styles.fontStyle = 'bold'
          }
        },
      }
    )
    y += 4

    // XDR Techniques table (top 20)
    if (stellarTechData.length > 0) {
      y = needsPage(doc, y, 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...C.navy)
      doc.text(s.sub5_3_tech || '5.3.1 Técnicas XDR Detectadas', ML, y)
      y += 6

      const xdrTechRows = stellarTechData.slice(0, 20).map(t => [t.id, t.name, t.tacticName, String(t.caseCount)])
      y = tableBase(doc,
        [
          s.xtaTechId   || 'Técnica (ID)',
          s.xtaTechName || 'Técnica XDR',
          s.xtaTactic   || 'Tática',
          s.xtaCases    || 'Cases',
        ],
        xdrTechRows, y, {
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: CW - 88 },
            2: { cellWidth: 40 },
            3: { cellWidth: 20 },
          },
          didParseCell: data => {
            if (data.section === 'body' && data.column.index === 0) {
              data.cell.styles.textColor = C.midBlue
              data.cell.styles.fontStyle = 'bold'
            }
          },
        }
      )
    }
    y += 4
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Operational Assessment
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = sectionTitle(doc, s.sec6 || '6. Operational Assessment', y)
  y = subTitle(doc, s.sub6_1 || '6.1 Incident Response Workflow', y)

  const irRows = s.irFlowRows || [
    [s.irStep1 || '1. Alert Triage',  s.irStep1desc || 'AI-ranked alerts surfaced in unified inbox; analyst reviews and prioritizes.'],
    [s.irStep2 || '2. Investigation', s.irStep2desc || 'One-click drill-down with correlated evidence, asset timeline and threat intel.'],
    [s.irStep3 || '3. Containment',   s.irStep3desc || 'Automated or manual response actions (isolate, block, quarantine).'],
    [s.irStep4 || '4. Eradication',   s.irStep4desc || 'Remove artifacts, patch vulnerability, revoke compromised credentials.'],
    [s.irStep5 || '5. Recovery',      s.irStep5desc || 'Restore services and monitor for re-compromise.'],
    [s.irStep6 || '6. Post-Incident', s.irStep6desc || 'Lessons learned, rule tuning and playbook updates.'],
  ]
  y = tableBase(doc,
    [s.irStep || 'Step', s.irDesc || 'Description'],
    irRows, y,
    { columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: CW - 45 } } }
  )

  y = needsPage(doc, y, 16)
  y = subTitle(doc, s.sub6_2 || '6.2 Automation & Playbooks', y)
  y = bodyText(doc,
    s.body6_2 ||
    "Stellar Cyber's built-in SOAR capabilities enable automated triage, enrichment and response playbooks that reduce analyst fatigue and accelerate containment.",
    y
  )
  y += 4

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Measured Results / ROI
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = sectionTitle(doc, s.sec7 || '7. Measured Results & ROI', y)
  y = subTitle(doc, s.sub7_1 || '7.1 Real Metrics', y)

  const realMetRows = [
    [s.metTotalCases     || 'Total Cases',           fmtNum(totalCasesCount),                     ''],
    [s.metCritHigh       || 'Critical + High',       fmtNum(critCases.length + highCases.length), pct(critCases.length + highCases.length, totalCasesCount)],
    [s.metMitreCov       || 'MITRE Tactic Coverage', `${mitreCovPct}%`,                           `${detectedTactics.size} / ${ALL_TACTICS.length}`],
    [
      s.metAvgEntitiesDay || 'Média Assets/Dia',
      avgEntities || '—',
      s.entitiesNote || 'from entity_count (entity_usages API)',
    ],
    [s.metActiveSources  || 'Active Sources',        fmtNum(activeConn.length),                   `${s.of || 'of'} ${fmtNum(connectors.length)}`],
    [s.metTotalIngested  || 'Total Data Ingested',   fmtGB(totalIngest),                          ''],
  ]
  y = tableBase(doc,
    [s.roiMetric || 'Metric', s.roiValue || 'Value', s.roiContext || 'Context'],
    realMetRows, y
  )

  y = needsPage(doc, y, 16)
  y = subTitle(doc, s.sub7_2 || '7.2 Qualitative Benefits', y)
  const qualBenefits = s.qualBenefits || [
    s.qb1 || '• Unified visibility across network, endpoint, cloud and email.',
    s.qb2 || '• Dramatically reduced alert fatigue through AI-powered correlation.',
    s.qb3 || '• Accelerated investigation with automated evidence correlation.',
    s.qb4 || '• Reduced tool sprawl and operational complexity.',
    s.qb5 || '• Scalable architecture supporting hybrid and multi-cloud environments.',
  ]
  for (const benefit of qualBenefits) {
    y = bodyText(doc, benefit, y)
  }
  y += 4

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 8 — Risks, Gaps & Recommendations
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = sectionTitle(doc, s.sec8 || '8. Risks, Gaps & Recommendations', y)

  // 8.1 Operational Recommendations
  y = subTitle(doc, s.sub8_1 || '8.1 Operational Recommendations', y)
  if (opRecs.length === 0) {
    y = infoNote(doc, s.noOpRecs || 'No operational recommendations recorded.', y)
    y += 4
  } else {
    const opRecRows = opRecs.map(r => [
      trunc(r.title || r.name || '—', 40),
      r.priority || r.severity || '—',
      trunc(r.description || r.details || '—', 80),
    ])
    y = tableCompact(doc,
      [s.recTitle || 'Recommendation', s.recPriority || 'Priority', s.recDesc || 'Description'],
      opRecRows, y
    )
  }

  // 8.2 MITRE-based Recommendations
  y = needsPage(doc, y, 20)
  y = subTitle(doc, s.sub8_2 || '8.2 MITRE ATT&CK Recommendations', y)
  if (mitrRecs.length === 0) {
    y = infoNote(doc, s.noMitreRecs || 'No MITRE-based recommendations recorded.', y)
    y += 4
  } else {
    const mitreRecRows = mitrRecs.map(r => [
      (r.mitre && r.mitre.technique && r.mitre.technique.id) || '—',
      (r.mitre && r.mitre.technique && r.mitre.technique.name) || trunc(r.title || '—', 35),
      (r.mitre && r.mitre.tactic) || '—',
      r.priority || '—',
      trunc(r.description || r.details || '—', 60),
    ])
    y = tableCompact(doc,
      [
        s.mitreId     || 'Technique ID',
        s.mitreName   || 'Technique',
        s.mitreTactic || 'Tactic',
        s.mitrePrio   || 'Priority',
        s.mitreDesc   || 'Description',
      ],
      mitreRecRows, y
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 9 — Next Steps
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = sectionTitle(doc, s.sec9 || '9. Next Steps', y)
  y = subTitle(doc, s.sub9_1 || '9.1 Recommended Actions', y)

  const nextRows = s.nextStepsRows || [
    ['1', s.ns1 || 'Finalize commercial proposal',        s.ns1owner || 'Account Team',  s.ns1due || '2 weeks'],
    ['2', s.ns2 || 'Address identified coverage gaps',    s.ns2owner || 'SE / Customer', s.ns2due || '1 month'],
    ['3', s.ns3 || 'Plan full deployment architecture',   s.ns3owner || 'SE',            s.ns3due || '1 month'],
    ['4', s.ns4 || 'Complete integrations inventory',     s.ns4owner || 'Customer IT',   s.ns4due || '2 months'],
    ['5', s.ns5 || 'Sign off production deployment plan', s.ns5owner || 'Both parties',  s.ns5due || 'TBD'],
  ]
  y = tableBase(doc,
    [s.nsStep || '#', s.nsAction || 'Action', s.nsOwner || 'Owner', s.nsDue || 'Target Date'],
    nextRows, y,
    { columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: CW - 70 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 } } }
  )

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 10 — Conclusion
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec10 || '10. Conclusion', y)
  y = subTitle(doc, s.sub10_1 || '10.1 PoC Scorecard', y)

  const scorecardRows = s.scorecardRows || [
    [s.sc10_1 || 'Detection Capability',     pocMeta.scoreDetection     || '—', pocMeta.noteDetection     || ''],
    [s.sc10_2 || 'Investigation Efficiency', pocMeta.scoreInvestigation || '—', pocMeta.noteInvestigation || ''],
    [s.sc10_3 || 'Response Automation',      pocMeta.scoreAutomation    || '—', pocMeta.noteAutomation    || ''],
    [s.sc10_4 || 'Integration Coverage',     pocMeta.scoreIntegration   || '—', pocMeta.noteIntegration   || ''],
    [s.sc10_5 || 'Ease of Use',              pocMeta.scoreEase          || '—', pocMeta.noteEase          || ''],
    [s.sc10_6 || 'MITRE Coverage',           `${mitreCovPct}%`,                      `${detectedTactics.size} of ${ALL_TACTICS.length} tactics`],
  ]
  y = tableBase(doc,
    [s.scArea || 'Area', s.scScore || 'Score', s.scNotes || 'Notes'],
    scorecardRows, y,
    { columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25 }, 2: { cellWidth: CW - 85 } } }
  )

  // Verdict banner
  y = needsPage(doc, y, 22)
  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 16, 3, 3, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(s.verdictLabel || 'PoC Verdict:', ML + CW / 2, y + 6.5, { align: 'center' })
  doc.setFontSize(14)
  doc.text(verdict || (s.verdictPending || 'Pending'), ML + CW / 2, y + 13, { align: 'center' })
  y += 22

  // Conclusion body
  const body10 = (
    s.body10 ||
    "Based on the results of this Proof of Concept, Stellar Cyber's Open XDR platform demonstrated {verdict} alignment with {clientName}'s security objectives."
  )
    .replace('{pocStartDate}', fmtDate(pocMeta.pocStartDate))
    .replace('{pocEndDate}',   fmtDate(pocMeta.pocEndDate))
    .replace('{clientName}',   pocMeta.clientName || s.clientNamePlaceholder || 'the client')
    .replace('{caseCount}',    totalCasesStr)
    .replace('{mitrePct}',     String(mitreCovPct))
  y = bodyText(doc, body10, y)
  y += 4

  // SE Comments block
  if (pocMeta.comments) {
    y = needsPage(doc, y, 20)
    y = subTitle(doc, s.seCommentsTitle || 'SE Comments', y)
    y = bodyText(doc, pocMeta.comments, y)
    y += 4
  }

  // Signatures section
  y = needsPage(doc, y, 40)
  y = subTitle(doc, s.signaturesTitle || 'Signatures', y)
  const sigW = (CW - 10) / 2
  const sigDefs = [
    { role: s.sigSE     || 'SE / Analyst',          name: pocMeta.seName    || '' },
    { role: s.sigClient || 'Client Representative', name: pocMeta.clientName || '' },
  ]
  for (let k = 0; k < 2; k++) {
    const sx = ML + k * (sigW + 10)
    doc.setDrawColor(...C.muted)
    doc.setLineWidth(0.4)
    doc.line(sx, y + 14, sx + sigW, y + 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.navy)
    doc.text(sigDefs[k].role, sx, y + 18)
    if (sigDefs[k].name) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...C.muted)
      doc.text(sigDefs[k].name, sx, y + 22)
    }
  }
  y += 30

  // ════════════════════════════════════════════════════════════════════════════
  // APPENDIX A — Glossary
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = appendixTitle(doc, s.appendixA || 'Appendix A — Glossary', y)

  const glossaryRows = s.glossaryRows || [
    ['XDR',   s.gXDR   || 'Extended Detection and Response — unified security platform correlating data across vectors.'],
    ['SIEM',  s.gSIEM  || 'Security Information and Event Management.'],
    ['SOAR',  s.gSOAR  || 'Security Orchestration, Automation and Response.'],
    ['MITRE', s.gMITRE || 'MITRE ATT&CK® — knowledge base of adversary tactics and techniques.'],
    ['MTTD',  s.gMTTD  || 'Mean Time to Detect — average time from compromise to detection.'],
    ['MTTR',  s.gMTTR  || 'Mean Time to Respond — average time from detection to containment.'],
    ['PoC',   s.gPoC   || 'Proof of Concept — time-limited evaluation of platform capabilities.'],
    ['SE',    s.gSE    || 'Sales Engineer / Solutions Engineer.'],
    ['IOC',   s.gIOC   || 'Indicator of Compromise.'],
    ['TTP',   s.gTTP   || 'Tactics, Techniques and Procedures.'],
    ['EDR',   s.gEDR   || 'Endpoint Detection and Response.'],
    ['NDR',   s.gNDR   || 'Network Detection and Response.'],
  ]
  y = tableBase(doc,
    [s.glossTerm || 'Term', s.glossDef || 'Definition'],
    glossaryRows, y,
    { columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: CW - 30 } } }
  )

  // ════════════════════════════════════════════════════════════════════════════
  // APPENDIX B — Version Control
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 20)
  y = appendixTitle(doc, s.appendixB || 'Appendix B — Version Control', y)

  const versionRows = s.versionRows || [
    [pocMeta.version || '1.0', fmtDate(generatedAt), pocMeta.seName || '—', s.verInitial || 'Initial release'],
  ]
  y = tableBase(doc,
    [s.verVersion || 'Version', s.verDate || 'Date', s.verAuthor || 'Author', s.verChanges || 'Changes'],
    versionRows, y,
    { columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 35 }, 2: { cellWidth: 50 }, 3: { cellWidth: CW - 105 } } }
  )

  // Suppress unused variable warning for 'y' at end
  void y

  return doc
}

// ─── Download wrapper ─────────────────────────────────────────────────────────
export function downloadPDFReport(params) {
  const doc = generatePDFReport(params)
  const clientName = ((params.pocMeta && params.pocMeta.clientName) || 'report').replace(/\s+/g, '_')
  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`StellarCyber_PoC_${clientName}_${dateStr}.pdf`)
}

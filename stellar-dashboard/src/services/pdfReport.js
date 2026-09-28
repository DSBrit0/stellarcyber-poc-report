import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Chart, registerables } from 'chart.js'
import { getMitreMitigation } from '../utils/mitreMapping'
import { assetStats, assetCompliance } from '../utils/assetCompliance'
import { verdictCode, verdictLabel } from '../utils/verdict'
import { volumeStats, volumeCompliance } from '../utils/volumeStats'
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
// Template of the PDF being generated (1 = classic, 2 = analytical).
let _tpl = 1

// ─── Utilities ────────────────────────────────────────────────────────────────
function i(doc, arr) { doc.setFillColor(...arr) }
// Locale of the PDF being generated (set at the top of generatePDFReport).
let _locStr = 'pt-BR'
const LOC_STR = { pt: 'pt-BR', en: 'en-US', es: 'es-MX' }

function fmtDate(d) {
  if (!d) return '—'
  try {
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt.getTime())) return String(d)
    // 'YYYY-MM-DD' is a calendar day (POC period, daily series): new Date() reads it as
    // UTC midnight, so format it in UTC — local time would show the previous day west of UTC.
    const calendarDay = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    return dt.toLocaleDateString(_locStr, { day: '2-digit', month: '2-digit', year: '2-digit', ...(calendarDay ? { timeZone: 'UTC' } : {}) })
  } catch { return String(d) }
}
function fmtNum(n) {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (isNaN(num)) return String(n)
  return num.toLocaleString(_locStr)
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
  doc.text(_s.headerSub || (_tpl === 2 ? ' | Stellar Cyber ISOC Platform' : ' | Stellar Cyber XDR Platform'), ML + 26, 6.5)
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
  if (_tpl === 2) return t2SectionTitle(doc, text, y)
  const fs = size || 9.5
  const barH = fs > 10 ? 10 : 7.5
  y = needsPage(doc, y, 16)
  i(doc, C.navy)
  doc.rect(ML, y, CW, barH, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs)
  doc.text(text, ML + 3, y + barH * 0.69)
  return y + barH + 5
}

function appendixTitle(doc, text, y) {
  y = needsPage(doc, y, 16)
  i(doc, C.midBlue)
  doc.rect(ML, y, CW, 7.5, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(text, ML + 3, y + 5.2)
  return y + 7.5 + 2
}

// Template 2 moves section 8 (risks & recommendations) next to section 5, so
// its subsections are renumbered: 8 → 6, 6 → 7, 7 → 8.
const T2_RENUMBER = { 6: 7, 7: 8, 8: 6 }
function t2Renumber(text) {
  return String(text).replace(/^(\d+)(?=\.\d)/, n => String(T2_RENUMBER[n] || n))
}

function subTitle(doc, text, y, size) {
  if (_tpl === 2) text = t2Renumber(text)
  const fs = size || 9
  y = needsPage(doc, y, 12)
  doc.setTextColor(...C.midBlue)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(fs)
  doc.text(text, ML, y)
  doc.setDrawColor(...C.midBlue)
  doc.setLineWidth(0.3)
  doc.line(ML, y + 2, ML + CW, y + 2)
  return y + fs * 1
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
  return doc.lastAutoTable.finalY + 5
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
  return doc.lastAutoTable.finalY + 5
}

// ─── License compliance block (7.3 assets / 7.4 volume) ─────────────────────
// Draws the recommendation, the compliance table of the three 7.0 levels for the
// recommended license and the licensing scenarios. `lic` comes from
// assetCompliance() / volumeCompliance(); `fmt` formats a value in its unit;
// `txt` holds the unit-specific sentences (recommendation, limit, descriptions).
function drawLicenseCompliance(doc, y, lic, { fmt, fmtDay, txt, hideShortPeriod = false }) {
  const s = _s
  const l = fmt(lic.recommended), t = fmt(lic.limit)
  const fill = str => str.replace(/\{l\}/g, l).replace(/\{t\}/g, t)
  const runText = run => !run
    ? (s.licRunNone || '0 days')
    : run.days === 1
      ? (s.licRunOneDay || '1 day ({from})').replace('{from}', fmtDay(run.from))
      : (s.licRunDays || '{n} days ({from} — {to})').replace('{n}', run.days).replace('{from}', fmtDay(run.from)).replace('{to}', fmtDay(run.to))
  const levelLabel = { none: s.licLevelNone || 'None', warning: s.licWarning || 'Warning', violation: s.licViolation || 'Violation', ooc: s.licOoc || 'Out of Compliance' }
  const levelRule  = { warning: s.licRuleWarning || 'Above 110% of the limit on each of 3 consecutive days', violation: s.licRuleViolation || 'Above 110% of the limit on each of 7 consecutive days', ooc: s.licRuleOoc || 'Above 110% of the limit for 21 consecutive days (7 to enter Violation + 14 in Violation)' }
  const levelRes   = { warning: s.licResWarning || 'Removable banner in the UI. Clears after 3 consecutive days at or below 110%.', violation: s.licResViolation || 'Non-removable banner and email to the account admin. Clears after 7 consecutive days at or below 110%.', ooc: s.licResOoc || 'Services cease and a prorated invoice covers the gap between average usage since the first Violation and the license.' }

  if (lic.stats.days < 30 && !hideShortPeriod) {
    y = infoNote(doc, txt.shortPeriod.replace('{n}', lic.stats.days), y)
    y += 2
  }

  // Recommendation
  y = needsPage(doc, y, 30)
  y = bodyText(doc, fill(txt.recommended), y, { bold: true, fontSize: 9.5, color: C.navy })
  y = bodyText(doc, txt.recommendedNote.replace('{from}', fmtDay(lic.recommendedWindow.from)).replace('{to}', fmtDay(lic.recommendedWindow.to)), y, { fontSize: 7.5, color: C.muted })
  y = bodyText(doc, fill(txt.limitLine), y, { fontSize: 8 })
  y += 3

  // Compliance with the recommended license
  y = needsPage(doc, y, 40)
  y = bodyText(doc, s.licTableTitle || 'Compliance with the recommended license', y, { bold: true, color: C.midBlue })
  const res = lic.result
  y = tableBase(doc,
    [s.licColLevel || 'Level', s.licColRule || 'Rule', (s.licColRun || 'Longest run above {t}').replace('{t}', t), s.licColOutcome || 'Result', s.licColResult || 'Description'],
    res.levels.map(lv => [
      levelLabel[lv.key],
      levelRule[lv.key],
      runText(res.longestRun),
      lv.reached ? (s.licReached || 'Reached') : (s.licNotReached || 'Not reached'),
      levelRes[lv.key],
    ]), y,
    {
      columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold' }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 3) d.cell.styles.textColor = res.levels[d.row.index].reached ? C.red : C.green },
    },
  )

  // Licensing scenarios
  y = needsPage(doc, y, 40)
  y = bodyText(doc, s.licScenarioTitle || 'Licensing scenarios', y, { bold: true, color: C.midBlue })
  const scenLabel = { average: s.licScenAverage || 'Period average', recommended: s.licScenRecommended || 'Recommended', peak: s.licScenPeak || 'Period peak' }
  y = tableBase(doc,
    [s.licColScenario || 'Scenario', txt.licenseCol, s.licColLimit || 'Limit/day (110%)', s.licColDaysAbove || 'Days above limit', s.licColLongest || 'Longest run', s.licColLevelReached || 'Level reached'],
    lic.scenarios.map(sc => [scenLabel[sc.key], fmt(sc.license), fmt(sc.limit), String(sc.daysAbove), runText(sc.longestRun), levelLabel[sc.level]]),
    y,
    {
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' } },
      didParseCell: d => {
        if (d.section !== 'body') return
        if (lic.scenarios[d.row.index].key === 'recommended') d.cell.styles.fontStyle = 'bold'
        if (d.column.index === 5) d.cell.styles.textColor = lic.scenarios[d.row.index].level === 'none' ? C.green : C.red
      },
    },
  )

  // Descriptive thresholds for the recommended license
  y = needsPage(doc, y, 36)
  for (const line of txt.desc) y = bodyText(doc, fill(line), y)
  return y
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
  doc.text('  |  ISOC Platform', 26 + doc.getTextWidth('STELLAR CYBER'), 18)

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
  if (_tpl === 2) return t2KpiTile(doc, x, y, w, h, value, label, color)
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

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — "Analytical": same content as Template 1 plus more charts.
// Everything below is used only when generatePDFReport({ template: 2 }).
// ═════════════════════════════════════════════════════════════════════════════
const T2C = {
  deep:   [20,  35,  63 ],
  cyan:   [0,   180, 216],
  tile:   [243, 246, 250],
  border: [220, 227, 236],
  slate:  [91,  106, 130],
  empty:  [238, 241, 245],
  light:  [156, 201, 236],
}
const T2_PALETTE = [C.navy, C.blue, T2C.cyan, T2C.light, T2C.slate, C.midBlue, C.green, C.orange]

// Solid color of `rgbArr` at opacity `a` over white (jsPDF fills are opaque).
function tint(rgbArr, a) { return rgbArr.map(v => Math.round(255 - (255 - v) * a)) }

// Section title: number chip + navy text + blue rule (Template 1 uses a navy bar).
function t2SectionTitle(doc, text, y) {
  y = needsPage(doc, y, 18)
  const m = String(text).match(/^(\d+)\.\s*(.*)$/)
  let x = ML
  if (m) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const cw = doc.getTextWidth(m[1]) + 5
    i(doc, C.blue)
    doc.roundedRect(ML, y, cw, 7.5, 1.2, 1.2, 'F')
    doc.setTextColor(...C.white)
    doc.text(m[1], ML + cw / 2, y + 5.3, { align: 'center' })
    x = ML + cw + 3
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...C.navy)
  doc.text(m ? m[2] : String(text), x, y + 5.9)
  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.7)
  doc.line(ML, y + 10, ML + CW, y + 10)
  return y + 16
}

// KPI tile: light fill, colored top edge, navy value (Template 1 uses a solid card).
function t2KpiTile(doc, x, y, w, h, value, label, color) {
  i(doc, T2C.tile)
  doc.roundedRect(x, y, w, h, 1.8, 1.8, 'F')
  i(doc, color)
  doc.rect(x, y, w, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(String(value).length > 9 ? 11 : 14)
  doc.setTextColor(...C.navy)
  doc.text(String(value), x + 3, y + h * 0.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...T2C.slate)
  doc.text(doc.splitTextToSize(label, w - 5).slice(0, 2), x + 3, y + h * 0.5 + 5)
}

// Card frame with title (and optional note). Returns the drawing area inside it.
function t2Card(doc, x, y, w, h, title, note) {
  doc.setDrawColor(...T2C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 2, 2, 'D')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.navy)
  doc.text(trunc(title, Math.floor(w / 1.6)), x + 3, y + 5.5)
  let top = y + 8
  if (note) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...C.muted)
    const lines = doc.splitTextToSize(note, w - 6).slice(0, 3)
    doc.text(lines, x + 3, y + 9.5)
    top = y + 9.5 + lines.length * 2.6
  }
  return { x: x + 2, y: top, w: w - 4, h: y + h - top - 2 }
}

function t2Chart(doc, area, factory) {
  if (!area || area.w <= 0 || area.h <= 0) return
  const png = renderChartPNG(() => { const cfg = factory(); cfg.options = { ...(cfg.options || {}), locale: _locStr }; return cfg }, area.w, area.h)
  if (png) doc.addImage(png, 'PNG', area.x, area.y, area.w, area.h)
}

// ─── Template 2 chart configs ────────────────────────────────────────────────
const t2Font = n => ({ size: pxpt(n), family: 'Arial' })
const t2Legend = (position = 'right') => ({
  display: true, position,
  labels: { font: t2Font(6.5), color: rgb(C.text), boxWidth: pxpt(7), boxHeight: pxpt(6), padding: pxpt(4) },
})
const t2Axis = (extra = {}) => ({ grid: { color: rgba(C.muted, 0.15) }, ticks: { font: t2Font(6), color: rgb(C.muted) }, ...extra })

// Writes each slice's percentage inside it (slices under 6% are left blank).
const t2SliceValues = {
  id: 't2SliceValues',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const data = chart.data.datasets[0].data
    const total = data.reduce((t, v) => t + (Number(v) || 0), 0)
    if (!total) return
    ctx.save()
    ctx.font = `bold ${pxpt(7)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    chart.getDatasetMeta(0).data.forEach((arc, k) => {
      const share = (Number(data[k]) || 0) / total
      if (share < 0.06) return
      const mid = (arc.startAngle + arc.endAngle) / 2
      const r = (arc.innerRadius + arc.outerRadius) / 2 || arc.outerRadius * 0.6
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`${Math.round(share * 100)}%`, arc.x + Math.cos(mid) * r, arc.y + Math.sin(mid) * r)
    })
    ctx.restore()
  },
}

// `fmt` formats the value shown next to each legend entry (count, GB…).
function t2PieChart(labels, data, colors, { cutout = 0, legend = 'right', fmt = v => Number(v).toLocaleString(_locStr) } = {}) {
  const total = data.reduce((t, v) => t + (Number(v) || 0), 0)
  const legendLabels = labels.map((l, k) => `${l}: ${fmt(data[k])} (${total ? Math.round((Number(data[k]) || 0) / total * 100) : 0}%)`)
  return {
    type: cutout ? 'doughnut' : 'pie',
    data: { labels: legendLabels, datasets: [{ data, backgroundColor: colors.map(rgb), borderColor: '#ffffff', borderWidth: pxpt(1) }] },
    options: { cutout: cutout ? `${cutout}%` : 0, plugins: { legend: t2Legend(legend), tooltip: { enabled: false } } },
    plugins: [t2SliceValues],
  }
}

function t2StackedBar(labels, series) {
  return {
    type: 'bar',
    data: { labels, datasets: series.map(sr => ({ label: sr.label, data: sr.data, backgroundColor: rgb(sr.color), borderRadius: 2 })) },
    options: {
      plugins: { legend: t2Legend('top'), tooltip: { enabled: false } },
      scales: {
        x: t2Axis({ stacked: true, grid: { display: false }, ticks: { font: t2Font(6), color: rgb(C.muted), maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } }),
        y: t2Axis({ stacked: true, beginAtZero: true, ticks: { font: t2Font(6), color: rgb(C.muted), precision: 0 } }),
      },
    },
  }
}

function t2MultiLine(labels, series) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: series.map(sr => ({
        label: sr.label, data: sr.data, borderColor: rgb(sr.color), backgroundColor: rgba(sr.color, 0.08),
        fill: true, tension: 0.3, borderWidth: pxpt(1.4), pointRadius: pxpt(1.2), pointBackgroundColor: rgb(sr.color),
      })),
    },
    options: {
      plugins: { legend: t2Legend('top'), tooltip: { enabled: false } },
      scales: {
        x: t2Axis({ grid: { display: false }, ticks: { font: t2Font(6), color: rgb(C.muted), maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } }),
        y: t2Axis({ beginAtZero: true, ticks: { font: t2Font(6), color: rgb(C.muted), precision: 0 } }),
      },
    },
  }
}

// Draws each bar's value above it (used where a 0 would otherwise be invisible).
const t2BarValues = {
  id: 't2BarValues',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    ctx.save()
    ctx.font = `bold ${pxpt(7)}px Arial`
    ctx.fillStyle = rgb(C.text)
    ctx.textAlign = 'center'
    meta.data.forEach((bar, k) => ctx.fillText(String(chart.data.datasets[0].data[k]), bar.x, bar.y - pxpt(2)))
    ctx.restore()
  },
}

function t2VBar(labels, data, colors, { yMax, showValues, xTitle, yTitle } = {}) {
  return {
    type: 'bar',
    plugins: showValues ? [t2BarValues] : [],
    data: { labels, datasets: [{ data, backgroundColor: colors.map(rgb), borderRadius: 2, categoryPercentage: 0.9, barPercentage: 0.9 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: t2Axis({ grid: { display: false }, ticks: { font: t2Font(5.8), color: rgb(C.muted), maxRotation: 0, autoSkip: false }, title: { display: !!xTitle, text: xTitle || '', font: t2Font(6), color: rgb(C.muted) } }),
        y: t2Axis({ beginAtZero: true, ...(yMax ? { suggestedMax: yMax } : {}), ticks: { font: t2Font(6), color: rgb(C.muted), precision: 0 }, title: { display: !!yTitle, text: yTitle || '', font: t2Font(6), color: rgb(C.muted) } }),
      },
    },
  }
}

// Writes each horizontal bar's value (formatted with `fmt`) just after its end.
const t2HBarValues = fmt => ({
  id: 't2HBarValues',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = `bold ${pxpt(6.5)}px Arial`
    ctx.fillStyle = rgb(C.text)
    ctx.textBaseline = 'middle'
    chart.getDatasetMeta(0).data.forEach((bar, k) => ctx.fillText(fmt(chart.data.datasets[0].data[k]), bar.x + pxpt(2), bar.y))
    ctx.restore()
  },
})

function t2HBar(labels, data, colors, { axisTitle, fmt = v => String(v) } = {}) {
  const max = Math.max(0, ...data)
  return {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(rgb), borderRadius: 2 }] },
    options: {
      indexAxis: 'y',
      layout: { padding: { right: pxpt(34) } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: t2Axis({ beginAtZero: true, suggestedMax: max * 1.05, title: { display: !!axisTitle, text: axisTitle || '', font: t2Font(6), color: rgb(C.muted) } }),
        y: { grid: { display: false }, ticks: { font: t2Font(6.5), color: rgb(C.text) } },
      },
    },
    plugins: [t2HBarValues(fmt)],
  }
}

function t2Radar(labels, data, color) {
  return {
    type: 'radar',
    data: { labels, datasets: [{ data, borderColor: rgb(color), backgroundColor: rgba(color, 0.2), borderWidth: pxpt(1.2), pointRadius: pxpt(1), pointBackgroundColor: rgb(color) }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { r: { beginAtZero: true, ticks: { display: true, precision: 0, font: t2Font(5.5), color: rgb(C.muted), backdropColor: 'rgba(255,255,255,0.8)' }, grid: { color: rgba(C.muted, 0.2) }, angleLines: { color: rgba(C.muted, 0.2) }, pointLabels: { font: t2Font(5.8), color: rgb(C.text) } } },
    },
  }
}

// Daily series with two dashed reference lines (recommended license, 110% limit).
// `bars` draws the series as bars colored red on days above the limit.
function t2SeriesWithRefs(labels, data, { label, color, license, limit, licenseLabel, limitLabel, bars }) {
  const ref = (lab, v, c, dash) => ({ type: 'line', label: lab, data: labels.map(() => v), borderColor: rgb(c), backgroundColor: rgb(c), borderDash: dash, borderWidth: pxpt(1.1), pointRadius: 0, pointStyle: 'line', fill: false, order: 1 })
  const series = bars
    ? { type: 'bar', label, data, backgroundColor: data.map(v => rgb(v > limit ? C.red : color)), borderRadius: 2, pointStyle: 'rect', order: 2 }
    : { type: 'line', label, data, borderColor: rgb(color), backgroundColor: rgba(color, 0.12), fill: true, tension: 0.25, borderWidth: pxpt(1.4), pointRadius: pxpt(1.1), pointBackgroundColor: rgb(color), pointStyle: 'rect', order: 2 }
  return {
    type: bars ? 'bar' : 'line',
    data: { labels, datasets: [series, ref(licenseLabel, license, C.green, [pxpt(4), pxpt(3)]), ref(limitLabel, limit, C.red, [pxpt(1.5), pxpt(2)])] },
    options: {
      plugins: { legend: { ...t2Legend('top'), labels: { ...t2Legend('top').labels, usePointStyle: true, pointStyleWidth: pxpt(10) } }, tooltip: { enabled: false } },
      scales: {
        x: t2Axis({ grid: { display: false }, ticks: { font: t2Font(6), color: rgb(C.muted), maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } }),
        y: t2Axis({ beginAtZero: true }),
      },
    },
  }
}

// ─── Template 2 data builders ────────────────────────────────────────────────
// Calendar days of the PoC period in UTC (the period boundaries are UTC days).
function t2Days(pocStartDate, pocEndDate) {
  const out = []
  if (!pocStartDate || !pocEndDate) return out
  const end = new Date(`${String(pocEndDate).slice(0, 10)}T00:00:00Z`)
  for (let d = new Date(`${String(pocStartDate).slice(0, 10)}T00:00:00Z`); d <= end && out.length < 62; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
const t2DayLabel = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`

// Critical and High only: Medium comes capped (top 100) and Low as a total.
function t2DailyBySeverity(cases, days) {
  const bySev = sev => days.map(day => cases.filter(c => (c.severity || '').toLowerCase() === sev && String(c.createdAt || '').startsWith(day)).length)
  return { critical: bySev('critical'), high: bySev('high') }
}

// ─── Template 2 cover ────────────────────────────────────────────────────────
function drawCover2(doc, pocMeta, s) {
  _pageNum = 1
  const topH = 166
  i(doc, T2C.deep)
  doc.rect(0, 0, PW, topH, 'F')

  // Network-map texture: fixed pseudo-random nodes and links (same on every report)
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pts = Array.from({ length: 44 }, () => [PW * 0.35 + rnd() * PW * 0.7, rnd() * topH])
  doc.setLineWidth(0.2)
  pts.forEach((p, a) => pts.slice(a + 1).forEach(q => {
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 38) {
      doc.setDrawColor(...T2C.cyan.map((v, j) => Math.round(T2C.deep[j] + (v - T2C.deep[j]) * 0.28)))
      doc.line(p[0], p[1], q[0], q[1])
    }
  }))
  pts.forEach(p => {
    doc.setFillColor(...T2C.cyan.map((v, j) => Math.round(T2C.deep[j] + (v - T2C.deep[j]) * 0.7)))
    doc.circle(p[0], p[1], 0.8, 'F')
  })

  const X = 17
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text('STELLAR CYBER', X, 20)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...T2C.cyan)
  doc.text('  |  ISOC Platform', X + doc.getTextWidth('STELLAR CYBER'), 20)

  const pill = s.coverConfidential || 'CONFIDENTIAL'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const pw = doc.getTextWidth(pill) + 6
  doc.setDrawColor(...T2C.cyan)
  doc.setLineWidth(0.4)
  doc.roundedRect(PW - X - pw, 15, pw, 6, 1.2, 1.2, 'D')
  doc.setTextColor(...T2C.cyan)
  doc.text(pill, PW - X - pw + 3, 19.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...T2C.cyan)
  doc.setCharSpace(0.8)
  doc.text((s.coverReportType || 'Proof of Concept Report').toUpperCase(), X, 104)
  doc.setCharSpace(0)
  doc.setFontSize(34)
  doc.setTextColor(...C.white)
  doc.text(s.t2CoverTitle1 || 'Stellar Cyber ISOC', X, 119)
  doc.text(s.coverTitle2 || 'Platform', X, 133)
  if (pocMeta.clientName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(201, 214, 234)
    doc.text([pocMeta.clientName, pocMeta.clientDept].filter(Boolean).join('  ·  '), X, 147)
  }

  // The four information blocks of the Template 1 cover
  const colL = X, colR = PW / 2 + 4, colW = PW / 2 - X - 8
  const row1Y = 190, row2Y = 241
  doc.setDrawColor(...C.gray)
  doc.setLineWidth(0.25)
  doc.line(PW / 2, row1Y - 3, PW / 2, row2Y + 40)
  doc.line(colL, row2Y - 5, PW - X, row2Y - 5)
  drawInfoBlock(doc, s.blockPreparedFor || 'PREPARED FOR', colL, row1Y, [
    { val: pocMeta.clientName,  bold: true,  size: 10 },
    { val: pocMeta.clientDept,  bold: false, size: 8 },
    { val: pocMeta.clientEmail, bold: false, size: 8 },
  ], C.blue, colW)
  drawInfoBlock(doc, s.blockStellarCyber || 'STELLAR CYBER SYSTEM ENGINEER', colR, row1Y, [
    { val: pocMeta.seName,  bold: true,  size: 10 },
    { val: pocMeta.seEmail, bold: false, size: 8 },
    { val: pocMeta.sePhone, bold: false, size: 8 },
  ], C.navy, colW)
  drawInfoBlock(doc, s.blockStakeholders || 'STAKEHOLDERS', colL, row2Y, [
    { val: (pocMeta.analysts || []).filter(Boolean).join('; '), bold: false, size: 8 },
  ], C.blue, colW)
  drawInfoBlock(doc, s.blockPartner || 'PARTNER', colR, row2Y, [
    { val: pocMeta.partnerName,  bold: true,  size: 10 },
    { val: pocMeta.partnerEmail, bold: false, size: 8 },
    { val: pocMeta.partnerSite,  bold: false, size: 8 },
  ], C.navy, colW)

  const foot = [
    [s.footerVersion || 'Version', pocMeta.version || '1.0'],
    [s.footerPocPeriod || 'PoC Period', `${fmtDate(pocMeta.pocStartDate)}–${fmtDate(pocMeta.pocEndDate)}`],
    [s.footerReportDate || 'Report Date', fmtDate(new Date())],
  ]
  let fx = X
  doc.setFontSize(7.5)
  foot.forEach(([lab, val], n) => {
    if (n) { doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); doc.text('  |  ', fx, 283); fx += doc.getTextWidth('  |  ') }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy); doc.text(lab + ' ', fx, 283); fx += doc.getTextWidth(lab + ' ')
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted); doc.text(val, fx, 283); fx += doc.getTextWidth(val)
  })
}

// ─── Template 2 section 1: executive dashboard (one page) ────────────────────
function t2ExecDashboard(doc, y, s, d) {
  // KPI tiles
  const gap = 2.5, n = d.kpis.length, kw = (CW - gap * (n - 1)) / n, kh = 22
  y = needsPage(doc, y, kh + 90)
  y = subTitle(doc, s.sub1_1 || '1.1 Key Performance Indicators', y) + 1
  d.kpis.forEach((kp, j) => t2KpiTile(doc, ML + j * (kw + gap), y, kw, kh, kp.value, kp.label, kp.color))
  y += kh + 5

  // Row 1: cases per day (Critical/High) | severity pie
  const h1 = 100, wl = CW * 0.57, wr = CW - wl - 4
  y = needsPage(doc, y, h1 + 4)
  const a1 = t2Card(doc, ML, y, wl, h1, s.t2ChartPerDay || 'Cases per day (critical and high)')
  if (d.days.length) {
    t2Chart(doc, a1, () => t2StackedBar(d.days.map(t2DayLabel), [
      { label: s.sevCritical || 'Critical', data: d.daily.critical, color: C.red },
      { label: s.sevHigh || 'High', data: d.daily.high, color: C.orange },
    ]))
  }
  const a2 = t2Card(doc, ML + wl + 4, y, wr, h1, s.t2ChartSevPie || 'Cases by severity')
  if (d.sevData.some(v => v > 0)) {
    t2Chart(doc, a2, () => t2PieChart(
      [s.sevCritical || 'Critical', s.sevHigh || 'High', s.sevMedium || 'Medium', s.sevLow || 'Low'],
      d.sevData, [C.red, C.orange, C.yellow, C.green], { legend: 'bottom' }))
  }
  y += h1 + 4

  // Row 2: MITRE gauge | scorecard | key findings
  const h2 = 72, w3 = (CW - 8) / 3
  y = needsPage(doc, y, h2 + 4)
  const g = t2Card(doc, ML, y, w3, h2, s.chartMitre || 'MITRE Coverage')
  const gh = Math.min(g.h, g.w)
  t2Chart(doc, { x: g.x + (g.w - gh) / 2, y: g.y, w: gh, h: gh }, () => gaugeChart(d.mitreCovPct, C.blue))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.navy)
  doc.text(`${d.mitreCovPct}%`, g.x + g.w / 2, g.y + gh * 0.52, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.muted)
  doc.text(`${d.tacticsDetected} / ${ALL_TACTICS.length} ${s.sc_tactics || 'tactics'}`, g.x + g.w / 2, g.y + gh * 0.52 + 5, { align: 'center' })

  const sc = t2Card(doc, ML + w3 + 4, y, w3, h2, s.t2ChartScore || 'PoC scorecard')
  let sy = sc.y + 4
  for (const row of d.scorecard) {
    const col = row.pct >= 70 ? C.green : row.pct >= 35 ? C.orange : C.red
    const lab = row.pct >= 70 ? (s.ratingHigh || 'High') : row.pct >= 35 ? (s.ratingMed || 'Medium') : (s.ratingLow || 'Low')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.text)
    doc.text(trunc(row.label, 34), sc.x + 1, sy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...col)
    doc.text(`${lab} · ${row.pct}%`, sc.x + sc.w - 1, sy, { align: 'right' })
    i(doc, T2C.empty)
    doc.roundedRect(sc.x + 1, sy + 1.8, sc.w - 2, 2.6, 1.3, 1.3, 'F')
    i(doc, col)
    doc.roundedRect(sc.x + 1, sy + 1.8, Math.max(2.6, (sc.w - 2) * Math.min(row.pct, 100) / 100), 2.6, 1.3, 1.3, 'F')
    sy += 12
  }
  // Legend: what each bar color means
  const legend = [
    [C.green,  s.t2ScoreLegendHigh || 'High: 70% or more'],
    [C.orange, s.t2ScoreLegendMed  || 'Medium: 35% to 69%'],
    [C.red,    s.t2ScoreLegendLow  || 'Low: below 35%'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  legend.forEach(([c, lab], k) => {
    const ly = sy + k * 4
    i(doc, c)
    doc.roundedRect(sc.x + 1, ly - 2.2, 5, 2.6, 1.3, 1.3, 'F')
    doc.setTextColor(...C.text)
    doc.text(lab, sc.x + 8, ly)
  })

  const f = t2Card(doc, ML + 2 * (w3 + 4), y, w3, h2, s.t2Findings || 'Key findings')
  let fy = f.y + 3
  doc.setFontSize(7)
  for (const line of d.findings) {
    const lines = doc.splitTextToSize(line, f.w - 5)
    if (fy + lines.length * 3.4 > f.y + f.h) break
    i(doc, C.blue)
    doc.circle(f.x + 1.5, fy - 1, 0.7, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(lines, f.x + 4, fy)
    fy += lines.length * 3.4 + 2.2
  }
  return y + h2 + 4
}

// ─── Template 2 section 2.2: methodology as a process flow ───────────────────
// One chevron per phase (in order), with the phase description under it. The
// phases carry no dates, so the flow shows sequence only, not duration.
function t2MethodologyFlow(doc, y, s, rows) {
  const n = rows.length
  if (!n) return y
  const gap = 1.2, w = (CW - gap * (n - 1)) / n, h = 17, notch = 5
  const descLines = rows.map(r => { doc.setFontSize(7); return doc.splitTextToSize(String(r[2] || ''), w - 4) })
  const descH = Math.max(...descLines.map(l => l.length)) * 3.4 + 6
  y = needsPage(doc, y, h + descH + 10)
  rows.forEach((r, k) => {
    const x = ML + k * (w + gap)
    const color = C.navy.map((v, j) => Math.round(v + (T2C.cyan[j] - v) * (n > 1 ? k / (n - 1) : 0)))
    // chevron: flat left edge on the first phase, notched on the others
    const pts = [[x, y], [x + w - notch, y], [x + w, y + h / 2], [x + w - notch, y + h], [x, y + h], [x + (k ? notch : 0), y + h / 2]]
    doc.setFillColor(...color)
    doc.lines(pts.slice(1).map((p, j) => [p[0] - pts[j][0], p[1] - pts[j][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true)
    const tx = x + (k ? notch : 0) + 2.5
    doc.setTextColor(...C.white)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(`${(s.t2PhaseLabel || 'PHASE').toUpperCase()} ${r[0]}`, tx, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    const name = String(r[1] || '').replace(/^\s*\d+\s*[—–-]\s*/, '')
    doc.text(doc.splitTextToSize(name, w - notch * 2 - 3).slice(0, 2), tx, y + 10)
    // description card under the chevron
    const dy = y + h + 2.5
    doc.setDrawColor(...color)
    doc.setLineWidth(0.6)
    doc.line(x + 1, dy, x + w - notch, dy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.text)
    doc.text(descLines[k], x + 1, dy + 4.5)
  })
  return y + h + descH + 4
}

// ─── Template 2 section 3: source charts ─────────────────────────────────────
function t2SourcesCharts(doc, y, s, d) {
  const w2 = (CW - 4) / 2, h = 62
  y = needsPage(doc, y, h + 4)
  // Under 0.01 GB the value is shown in MB, so small sensors don't read as 0
  const gb = v => (v > 0 && v < 0.01
    ? `${(v * 1024).toLocaleString(_locStr, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`
    : `${Number(v).toLocaleString(_locStr, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`)
  const a = t2Card(doc, ML, y, w2, h, s.t2ChartOrigin || 'Ingestion by origin', s.t2OriginNote || 'GB ingested in the period by sensors and by connectors, before enrichment and compression; % of the total.')
  if (d.sensorGB + d.connGB > 0) {
    t2Chart(doc, a, () => t2PieChart([s.t2Sensors || 'Sensors', s.t2Connectors || 'Connectors'], [d.sensorGB, d.connGB], [C.blue, T2C.cyan], { cutout: 58, legend: 'bottom', fmt: gb }))
  }
  const b = t2Card(doc, ML + w2 + 4, y, w2, h, s.t2ChartConnCat || 'Connectors by category', s.t2ConnCatNote || 'Number of configured connectors in each category; % of the total.')
  if (d.connCat.length) {
    t2Chart(doc, b, () => t2PieChart(d.connCat.map(c => c[0]), d.connCat.map(c => c[1]), T2_PALETTE.slice(0, d.connCat.length)))
  }
  y += h + 4

  if (d.sensors.length) {
    const hs = Math.min(78, 26 + d.sensors.length * 6)
    y = needsPage(doc, y, hs + 4)
    const c = t2Card(doc, ML, y, CW, hs, s.t2ChartSensorGB || 'GB ingested per sensor', s.t2SensorGBNote || 'Data each sensor sent in the period (GB, before enrichment and compression). The exact value is at the end of each bar.')
    t2Chart(doc, c, () => t2HBar(d.sensors.map(r => trunc(r.name, 28)), d.sensors.map(r => r.gb), d.sensors.map(r => ((r.type || '').toLowerCase().includes('modular') ? C.navy : C.blue)), { axisTitle: 'GB', fmt: gb }))
    y += hs + 4
  }

  y = needsPage(doc, y, h + 4)
  const e = t2Card(doc, ML, y, w2, h, s.t2ChartSensorType || 'Sensors by type', s.t2SensorTypeNote || 'Number of sensors of each type; % of the total.')
  if (d.sensorTypes.length) {
    t2Chart(doc, e, () => t2PieChart(d.sensorTypes.map(c => c[0]), d.sensorTypes.map(c => c[1]), T2_PALETTE.slice(0, d.sensorTypes.length), { legend: 'bottom' }))
  }
  const f = t2Card(doc, ML + w2 + 4, y, w2, h, s.t2ChartConnStatus || 'Connectors by status', s.t2ConnStatusNote || 'Number of connectors in each status reported by the API; % of the total.')
  if (d.connStatus.length) {
    t2Chart(doc, f, () => t2PieChart(d.connStatus.map(c => c[0]), d.connStatus.map(c => c[1]),
      d.connStatus.map(c => (['online', 'active', 'connected'].includes(String(c[0]).toLowerCase()) ? C.green : C.red)), { cutout: 58, legend: 'bottom' }))
  }
  return y + h + 5
}

// ─── Template 2 section 4: detection charts ──────────────────────────────────
function t2DetectionCharts(doc, y, s, d) {
  // Trend (Critical / High lines)
  if (d.days.length) {
    const h = 58
    y = needsPage(doc, y, h + 4)
    const a = t2Card(doc, ML, y, CW, h, s.t2ChartTrend || 'Daily case trend (critical and high)', s.t2TrendNote || 'Medium and Low are not included: the report loads only the 100 most recent Medium cases and the Low total.')
    t2Chart(doc, a, () => t2MultiLine(d.days.map(t2DayLabel), [
      { label: s.sevCritical || 'Critical', data: d.daily.critical, color: C.red },
      { label: s.sevHigh || 'High', data: d.daily.high, color: C.orange },
    ]))
    y += h + 4
  }

  // Heatmap weekday × hour (UTC), drawn with rectangles
  const hh = 58
  y = needsPage(doc, y, hh + 4)
  const a = t2Card(doc, ML, y, CW, hh, s.t2ChartHeat || 'When critical and high cases were created (weekday × hour, UTC)', s.t2HeatNote || 'Each cell is one hour of one weekday (UTC). The number is how many critical and high cases were created in that hour over the period; the darker the cell, the more cases. Empty gray = no case.')
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  d.critHigh.forEach(c => { const t = new Date(c.createdAt); if (!isNaN(t)) grid[t.getUTCDay()][t.getUTCHours()]++ })
  const max = Math.max(1, ...grid.flat())
  const labW = 9, cg = 0.4, cw = (a.w - labW) / 24, ch = Math.min(cw, (a.h - 9) / 7)
  const wd = s.t2Weekdays || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...C.muted)
  for (let hr = 0; hr < 24; hr += 3) doc.text(String(hr), a.x + labW + hr * cw + cw / 2, a.y + 2, { align: 'center' })
  grid.forEach((row, r) => {
    const ry = a.y + 3.5 + r * ch
    doc.setTextColor(...C.muted)
    doc.text(wd[r], a.x, ry + ch * 0.7)
    row.forEach((v, hr) => {
      doc.setFillColor(...(v ? tint(C.red, 0.15 + 0.85 * v / max) : [241, 243, 246]))
      doc.rect(a.x + labW + hr * cw, ry, cw - cg, ch - cg, 'F')
      if (v) {
        doc.setFontSize(5)
        doc.setTextColor(...(v / max > 0.5 ? C.white : C.text))
        doc.text(String(v), a.x + labW + hr * cw + (cw - cg) / 2, ry + (ch - cg) / 2 + 0.9, { align: 'center' })
        doc.setFontSize(5.5)
      }
    })
  })
  // Color scale
  const ly = a.y + 3.5 + 7 * ch + 2.5
  doc.setFontSize(5.5)
  doc.setTextColor(...C.muted)
  doc.text(s.t2HeatScale || 'Cases per hour:', a.x + labW, ly + 2)
  let lx = a.x + labW + doc.getTextWidth(s.t2HeatScale || 'Cases per hour:') + 2
  const steps = [0, 0.25, 0.5, 0.75, 1]
  steps.forEach((t, k) => {
    doc.setFillColor(...(k === 0 ? [241, 243, 246] : tint(C.red, 0.15 + 0.85 * t)))
    doc.rect(lx, ly, 6, 2.6, 'F')
    doc.setTextColor(...C.muted)
    doc.text(k === 0 ? '0' : String(Math.max(1, Math.round(t * max))), lx + 3, ly + 5.6, { align: 'center' })
    lx += 7
  })
  y += hh + 4

  // Score histogram | status donut
  const h3 = 68, w2 = (CW - 4) / 2
  y = needsPage(doc, y, h3 + 4)
  const b = t2Card(doc, ML, y, w2, h3, s.t2ChartScoreHist || 'Risk score distribution', s.t2ScoreHistNote || 'Number of cases in each range of the risk score (0 to 100) the platform gives each case. Green below 40, yellow 40 to 59, orange 60 to 79, red 80 or more.')
  const bins = Array(10).fill(0)
  d.cases.forEach(c => { if (typeof c.score === 'number') bins[Math.max(0, Math.min(9, Math.floor(c.score / 10)))]++ })
  t2Chart(doc, b, () => t2VBar(bins.map((_, k) => `${k * 10}–${k * 10 + 9}`), bins, bins.map((_, k) => (k >= 8 ? C.red : k >= 6 ? C.orange : k >= 4 ? C.yellow : C.green)),
    { showValues: true, xTitle: s.t2ScoreAxis || 'Risk score', yTitle: s.t2CasesAxis || 'Cases' }))
  const e = t2Card(doc, ML + w2 + 4, y, w2, h3, s.t2ChartStatus || 'Cases by status', s.t2StatusNote || 'Number of cases in each status, as returned by the API; % of the loaded cases.')
  const st = Object.entries(d.cases.reduce((m, c) => { const k = c.status || '—'; m[k] = (m[k] || 0) + 1; return m }, {})).sort((p, q) => q[1] - p[1])
  if (st.length) {
    t2Chart(doc, e, () => t2PieChart(st.map(x => x[0]), st.map(x => x[1]), st.map(x => statusColor(x[0])).map((c, k) => (c === C.muted ? T2_PALETTE[k % T2_PALETTE.length] : c)), { cutout: 58 }))
  }
  return y + h3 + 8
}

// ─── Template 2 section 5: tactic matrix + radar + XDR donut ─────────────────
function t2TacticMatrix(doc, y, s, tactics) {
  const byId = Object.fromEntries(tactics.map(t => [t.id, t]))
  const max = Math.max(1, ...tactics.map(t => t.alertCount || 0))
  const cols = 7, gap = 1.4, cw = (CW - gap * (cols - 1)) / cols, ch = 17
  y = needsPage(doc, y, 2 * (ch + gap) + 16)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(...C.muted)
  doc.text(s.t2MatrixNote || 'Color scaled by alerts; gray = tactic without detection in the period', ML, y)
  y += 3
  ALL_TACTICS.forEach((ta, k) => {
    const t = byId[ta.id]
    const r = t ? Math.log(1 + (t.alertCount || 0)) / Math.log(1 + max) : 0
    const bg = !t ? T2C.empty : r > 0.75 ? C.navy : r > 0.4 ? C.blue : T2C.light
    const fg = !t ? [138, 150, 168] : r > 0.4 ? C.white : T2C.deep
    const tx = ML + (k % cols) * (cw + gap), ty = y + Math.floor(k / cols) * (ch + gap)
    i(doc, bg)
    doc.roundedRect(tx, ty, cw, ch, 1.5, 1.5, 'F')
    doc.setTextColor(...fg)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.text(ta.id, tx + 2, ty + 3.8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(doc.splitTextToSize(ta.name, cw - 4).slice(0, 2), tx + 2, ty + 7.5)
    doc.setFontSize(8)
    doc.text(t ? fmtNum(t.alertCount) : '—', tx + 2, ty + ch - 2)
  })
  y += 2 * (ch + gap) + 2
  // Legend
  const leg = [[T2C.empty, s.t2LegendNone || 'no detection'], [T2C.light, s.t2LegendLow || 'few alerts'], [C.blue, s.t2LegendMid || 'medium'], [C.navy, s.t2LegendHigh || 'most alerts']]
  let lx = ML
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  leg.forEach(([c, lab]) => {
    i(doc, c)
    doc.rect(lx, y, 4, 2.5, 'F')
    doc.setTextColor(...C.muted)
    doc.text(lab, lx + 5.5, y + 2.2)
    lx += 9 + doc.getTextWidth(lab)
  })
  return y + 9
}

function t2MitreCharts(doc, y, s, d) {
  const h = 86, w2 = (CW - 4) / 2
  y = needsPage(doc, y, h + 4)
  const byId = Object.fromEntries(d.tactics.map(t => [t.id, t]))
  const a = t2Card(doc, ML, y, w2, h, s.t2ChartRadar || 'Cases per tactic', s.t2RadarNote || 'Each axis is a MITRE ATT&CK tactic; the farther the point from the center, the more cases had alerts of that tactic. The number in parentheses is the case count.')
  const short = n => n.replace('Command and Control', 'C2').replace('Resource Development', 'Resource Dev.').replace('Privilege Escalation', 'Priv. Escalation')
  t2Chart(doc, a, () => t2Radar(ALL_TACTICS.map(t => `${short(t.name)} (${byId[t.id]?.caseCount || 0})`), ALL_TACTICS.map(t => byId[t.id]?.caseCount || 0), C.blue))
  const b = t2Card(doc, ML + w2 + 4, y, w2, h, s.t2ChartXdr || 'Stellar XDR proprietary detections (alerts per tactic)', s.t2XdrNote || 'Alerts from the Stellar Cyber proprietary detections (beyond MITRE ATT&CK), per XDR tactic; value and % of the total.')
  if (d.xdr.length) {
    t2Chart(doc, b, () => t2PieChart(d.xdr.map(t => t.name), d.xdr.map(t => t.alertCount), T2_PALETTE.slice(0, d.xdr.length), { cutout: 55, legend: 'bottom' }))
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...C.muted)
    doc.text('—', b.x + b.w / 2, b.y + b.h / 2, { align: 'center' })
  }
  return y + h + 5
}

// ─── Template 2 sections 7.3 / 7.4: series vs license + scenarios ────────────
function t2LicenseCharts(doc, y, s, { title, labels, data, lic, fmt, color, seriesLabel, bars }) {
  const h = 66, wl = CW * 0.62, wr = CW - wl - 4
  y = needsPage(doc, y, h + 4)
  const a = t2Card(doc, ML, y, wl, h, title)
  t2Chart(doc, a, () => t2SeriesWithRefs(labels, data, {
    label: seriesLabel, color, license: lic.recommended, limit: lic.limit, bars,
    licenseLabel: `${s.t2SeriesLicense || 'Recommended license'} (${fmt(lic.recommended)})`,
    limitLabel: `${s.t2SeriesLimit || '110% limit'} (${fmt(lic.limit)})`,
  }))
  const scenLabel = { average: s.licScenAverage || 'Period average', recommended: s.licScenRecommended || 'Recommended', peak: s.licScenPeak || 'Period peak' }
  const b = t2Card(doc, ML + wl + 4, y, wr, h, s.t2ChartScenarios || 'Days above 110% per scenario')
  t2Chart(doc, b, () => t2VBar(
    lic.scenarios.map(sc => [scenLabel[sc.key], fmt(sc.license)]),
    lic.scenarios.map(sc => sc.daysAbove),
    lic.scenarios.map(sc => (sc.level === 'none' ? C.green : sc.level === 'warning' ? C.yellow : C.red)),
    { yMax: lic.stats.days, showValues: true }))
  return y + h + 5
}

// ─── Template 2 section 8: recommendations by priority ───────────────────────
function t2RecPriorityChart(doc, y, s, recs) {
  const counts = ['critical', 'warning', 'info'].map(p => [p, recs.filter(r => r.priority === p).length]).filter(x => x[1] > 0)
  if (!counts.length) return y
  const h = 50
  y = needsPage(doc, y, h + 4)
  const a = t2Card(doc, ML, y, CW * 0.5, h, s.t2ChartRecPrio || 'Recommendations by priority')
  const label = { critical: s.recPrioCritical || 'Critical', warning: s.recPrioWarning || 'Warning', info: s.recPrioInfo || 'Info' }
  const color = { critical: C.red, warning: C.orange, info: C.blue }
  t2Chart(doc, a, () => t2PieChart(counts.map(c => label[c[0]]), counts.map(c => c[1]), counts.map(c => color[c[0]]), { cutout: 55 }))
  return y + h + 5
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generatePDFReport({
  auth,
  cases = [],
  lowCount = 0,
  mediumTotal = 0,
  connectors = [],
  dataSensors = [],
  assets = [],
  recommendations = [],
  ingestionBySensor = [],
  ingestionByConnector = [],
  dailyVolume = [],
  caseTactics = null,
  generatedAt = new Date(),
  pocMeta = {},
  locale = 'pt',
  s = {},
  template = 1,
}) {
  _meta   = pocMeta
  _s      = s
  _locStr = LOC_STR[locale] || LOC_STR.pt
  _tpl    = template === 2 ? 2 : 1
  const T2 = _tpl === 2

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

  // Asset stats from assets[] shape: [{ date, entity_count }] — the official daily
  // license count. Every day counts, 0 included (see utils/assetCompliance).
  const locStr      = _locStr
  const fmtLoc      = n => (n == null ? null : Number(n).toLocaleString(locStr))
  const fmtDay      = d => new Date(`${d}T00:00:00Z`).toLocaleDateString(locStr, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' })
  const entStats    = assetStats(assets)
  const avgEntities = entStats ? fmtLoc(entStats.avg) : null
  const minEntities = entStats ? fmtLoc(entStats.min) : null
  const maxEntities = entStats ? fmtLoc(entStats.max) : null
  const entDaysNote = entStats
    ? (s.entitiesDaysNote || '{days} days in period · {zero} with count 0')
        .replace('{days}', entStats.days).replace('{zero}', entStats.zeroDays)
    : ''

  // lowCount may be the string '500+' when the API capped at 500.
  // Use lowNum (always a number) for arithmetic; keep lowCount for display where the '+' matters.
  const lowNum = typeof lowCount === 'number' ? lowCount : 500

  // Total displayed (crit + high + mediumTotal + lowNum)
  const totalCasesCount = critCases.length + highCases.length + mediumTotal + lowNum
  const totalCasesStr   = typeof lowCount === 'string'
    ? fmtNum(totalCasesCount) + '+'
    : fmtNum(totalCasesCount)

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
  // Stored as a code (older values: a label in any language) → label in the PDF locale
  const verdictKey   = verdictCode(pocMeta.verdict)
  const verdict      = verdictKey ? verdictLabel(verdictKey, locale) : (pocMeta.verdict || '')
  const verdictColor = verdictKey === 'approved' ? C.green : verdictKey === 'conditional' ? C.orange : C.red

  // Total ingested = sum of the daily volume over the whole selected period
  // (/storage-usages, same source as section 7.4). '—' when the API has no data.
  const vol            = volumeStats(dailyVolume)
  const fmtVol         = n => `${Number(n).toLocaleString(_locStr, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`
  const totalIngestStr = vol ? fmtVol(vol.total) : '—'

  // ── Create PDF ──────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'normal')

  // ════════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════════
  const t2Period = T2 ? t2Days(pocMeta.pocStartDate, pocMeta.pocEndDate) : []
  const t2Daily  = T2 ? t2DailyBySeverity(cases, t2Period) : null
  const t2AssetLic = T2 ? assetCompliance(assets) : null
  const t2VolLic   = T2 && vol ? volumeCompliance(dailyVolume) : null
  if (T2) {
    drawCover2(doc, pocMeta, s)
  } else {
    drawCover(doc, pocMeta, s)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Page 3: Context and Objectives + Success Criteria
  // ════════════════════════════════════════════════════════════════════════════
  let y = newPage(doc)
  let t2Dash = null
  if (T2) {
    // Template 2: one-page executive dashboard, then 1.2 / 1.1 on the next page
    const validSc   = cases.filter(c => typeof c.score === 'number' && c.score > 0)
    const findings  = []
    const peakIdx   = t2Period.reduce((best, _d, k) => (t2Daily.critical[k] + t2Daily.high[k] > t2Daily.critical[best] + t2Daily.high[best] ? k : best), 0)
    if (t2Period.length && t2Daily.critical[peakIdx] + t2Daily.high[peakIdx] > 0) {
      findings.push((s.t2FindPeak || 'Peak of {n} critical and high cases on {d}.').replace('{n}', fmtNum(t2Daily.critical[peakIdx] + t2Daily.high[peakIdx])).replace('{d}', fmtDate(t2Period[peakIdx])))
    }
    const topTactic = [...(caseTactics?.mitre?.tactics || [])].sort((a, b) => b.alertCount - a.alertCount)[0]
    if (topTactic) {
      findings.push((s.t2FindTactic || 'Tactic with the most alerts: {t} ({a} alerts in {c} cases).').replace('{t}', topTactic.name).replace('{a}', fmtNum(topTactic.alertCount)).replace('{c}', fmtNum(topTactic.caseCount)))
    }
    const sensorBytes = ingestionBySensor.reduce((t, r) => t + (r.bytesIngested || 0), 0)
    const topSensor   = [...ingestionBySensor].sort((a, b) => (b.bytesIngested || 0) - (a.bytesIngested || 0))[0]
    if (topSensor && sensorBytes > 0) {
      findings.push((s.t2FindSource || 'Sensor with the most ingestion: {s}, {p}% of the sensor volume.').replace('{s}', topSensor.name || '—').replace('{p}', Math.round((topSensor.bytesIngested || 0) / sensorBytes * 100)))
    }
    if (t2AssetLic.recommended != null) findings.push((s.t2FindLicense || 'Recommended asset license: {l}.').replace('{l}', fmtLoc(t2AssetLic.recommended)))
    if (t2VolLic?.recommended != null) findings.push((s.t2FindVolume || 'Recommended volume license: {l} per day.').replace('{l}', fmtVol(t2VolLic.recommended)))
    y = sectionTitle(doc, s.sec1 || '1. Executive Summary', y)
    t2Dash = {
      kpis: [
        { value: totalCasesStr,                      label: s.kpiCasesDetected || 'Cases detected', color: C.navy },
        { value: fmtNum(critCases.length),           label: s.sevCritical || 'Critical',            color: C.red },
        { value: fmtNum(highCases.length),           label: s.sevHigh || 'High',                    color: C.orange },
        { value: `${mitreCovPct}%`,                  label: `${s.kpiMitreCov || 'MITRE Coverage'} (${detectedTactics.size}/${ALL_TACTICS.length})`, color: C.blue },
        { value: avgEntities || '—',                 label: s.kpiAvgEntities || 'Average assets/day', color: C.midBlue },
        { value: totalIngestStr,                     label: s.metTotalIngested || 'Total data ingested', color: T2C.cyan },
      ],
      days: t2Period,
      daily: t2Daily,
      sevData: [critCases.length, highCases.length, mediumTotal, lowNum],
      mitreCovPct,
      tacticsDetected: detectedTactics.size,
      scorecard: [
        { label: s.sc10_1 || 'Detection Capability',     pct: validSc.length ? Math.round(validSc.reduce((t, c) => t + c.score, 0) / validSc.length) : 0 },
        { label: s.sc10_2 || 'Investigation Efficiency', pct: cases.length ? Math.round(resolvedCases.length / cases.length * 100) : 0 },
        { label: s.sc10_4 || 'Integration Coverage',     pct: connectors.length ? Math.round(activeConn.length / connectors.length * 100) : 0 },
        { label: s.sc10_6 || 'MITRE Coverage',           pct: mitreCovPct },
      ],
      findings,
    }
  } else {
    y = sectionTitle(doc, s.sec1 || '1. Executive Summary', y, 12)
    y += 4
  }

  // ── 1.2 Context and Objectives ──────────────────────────────────────────────
  y = subTitle(doc, s.sub1_2 || '1.2 Context and Objectives', y, 11)
  const body1_1 = (
    s.body1_1 ||
    "This Proof of Concept evaluated Stellar Cyber's ISOC Platform against the security environment of {clientName}. The assessment covered {pocStartDate} to {pocEndDate}."
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

  // Template 2: KPI tiles and dashboard charts after 1.2, before the 1.1 table
  if (T2) y = t2ExecDashboard(doc, y, s, t2Dash)

  // ── 1.1 Executive Summary Table ────────────────────────────────────────────
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
      [s.kpiEntitiesNote || 'Média de assets ativos por dia (hosts / usuários / dispositivos)', entDaysNote].filter(Boolean).join(' · '),
    ],
    [s.kpiMinEntities || 'Minimum assets/day', minEntities || '—', s.minEntitiesNote || 'Lowest daily count in the period'],
    [s.kpiMaxEntities || 'Maximum assets/day', maxEntities || '—', s.maxEntitiesNote || 'Highest daily count in the period (peak)'],
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
  // Page 4: Executive Summary — 1.1 KPI Cards + Charts
  // ════════════════════════════════════════════════════════════════════════════
  // Template 2 shows these KPIs and charts on the executive dashboard page
  if (!T2) {
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
    const chartH = 70

    // Row 1: Severity donut (left) | Status donut (right)
    const sevData  = [critCases.length, highCases.length, mediumTotal, lowNum]
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

  // 2.3 Success Criteria
  y = needsPage(doc, y, 40)
  y = subTitle(doc, s.sub2_3 || '2.3 Success Criteria', y)

  // MTTD: median of (created_at − start_timestamp) in minutes across cases in scope
  const mttdValues = cases
    .filter(c => c.startedAt != null && c.detectedAt != null && c.detectedAt > c.startedAt)
    .map(c => (c.detectedAt - c.startedAt) / 1000 / 60)
  const mttdStr = (() => {
    if (!mttdValues.length) return '—'
    const sorted = [...mttdValues].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    return `${median.toFixed(1)} min`
  })()

  // Alert noise reduction: total raw alerts across cases vs number of cases
  const scTotalAlerts = cases.reduce((sum, c) => sum + (c.alertCount || 1), 0)
  const scNoiseRedPct = scTotalAlerts > cases.length
    ? Math.round((1 - cases.length / scTotalAlerts) * 100)
    : 0
  const scCorrRatio = cases.length > 0 ? Math.round(scTotalAlerts / cases.length) : 0
  const noiseStr    = cases.length > 0 ? `${scNoiseRedPct}% (${scCorrRatio}:1)` : '—'

  // Integration coverage: active connectors vs total configured
  const integPct = connectors.length > 0 ? Math.round(activeConn.length / connectors.length * 100) : 0
  const integStr  = connectors.length > 0 ? `${activeConn.length}/${connectors.length} (${integPct}%)` : '—'

  // MITRE detection coverage (already computed above)
  const detectionStr = `${mitreCovPct}%`

  const scRows = [
    [s.sc1 || 'MITRE Detection Coverage', s.sc1target || '≥ 85% tactics detected',      detectionStr],
    [s.sc2 || 'Time to Detect (MTTD)',    s.sc2target || '< 5 min (median)',             mttdStr],
    [s.sc3 || 'Integration Coverage',     s.sc3target || '100% active sources',          integStr],
    [s.sc4 || 'Alert Noise Reduction',    s.sc4target || '> 80% correlated alerts',      noiseStr],
  ]
  y = tableBase(doc,
    [s.scCriteria || 'Criterion', s.scTarget || 'Target', s.scResult || 'Result'],
    scRows, y,
    { columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: CW - 55 - 35 }, 2: { cellWidth: 35 } } }
  )

  // 2.2 Methodology Phases
  y = needsPage(doc, y, 40)
  y = subTitle(doc, s.sub2_2 || '2.2 Methodology Phases', y)
  const methRows = s.methodologyPhases || [
    ['1', s.phase1 || 'Kickoff & Scoping',     s.phase1desc || 'Define success criteria, environments and integrations.'],
    ['2', s.phase2 || 'Deployment',             s.phase2desc || 'Install sensors, configure connectors, validate data flow.'],
    ['3', s.phase3 || 'Detection Validation',   s.phase3desc || 'Execute attack simulations and verify detections.'],
    ['4', s.phase4 || 'Response & Automation',  s.phase4desc || 'Validate playbooks, SOAR workflows and response times.'],
    ['5', s.phase5 || 'Reporting & Debrief',    s.phase5desc || 'Analyze results, identify gaps and present findings.'],
  ]
  if (T2) y = t2MethodologyFlow(doc, y, s, methRows)
  else y = tableBase(doc,
    [s.phaseNum || '#', s.phaseName || 'Phase', s.phaseDesc || 'Description'],
    methRows, y,
    { columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 2: { cellWidth: CW - 55 } } }
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
      // Size from the pixels actually embedded (not the stored on-screen size), so the
      // aspect ratio always matches the image — older uploads could carry a rotated size.
      const props = (() => { try { return doc.getImageProperties(imgData) } catch { return null } })()
      const dims  = props?.width && props?.height ? { w: props.width, h: props.height } : pocMeta.architectureImageDims
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
  // SECTION 3 — Data Sources
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec3 || '3. Data Sources & Ingestion', y)

  // 3.1 Stat cards (4 boxes)
  y = subTitle(doc, s.sub3_1 || '3.1 Ingestion Overview', y)
  const statCardW = (CW - 9) / 4
  const statCardH = 18
  const statCards = [
    { label: s.statTotalSources  || 'Total Sources',  value: fmtNum(connectors.length),       color: C.navy    },
    { label: s.statActiveSources || 'Active Sources', value: fmtNum(activeConn.length),       color: C.green   },
    { label: s.statTotalIngested || 'Total Ingested', value: totalIngestStr,                  color: C.blue    },
    { label: s.statSensorTypes   || 'Sensor Types',   value: fmtNum(ingestionBySensor.length),color: C.midBlue },
  ]
  for (let k = 0; k < statCards.length; k++) {
    const sx = ML + k * (statCardW + 3)
    drawKpiCard(doc, sx, y, statCardW, statCardH, statCards[k].value, statCards[k].label, statCards[k].color)
  }
  y += statCardH + 5

  if (T2) {
    const tally = (arr, key) => Object.entries(arr.reduce((m, x) => { const k = key(x) || '—'; m[k] = (m[k] || 0) + 1; return m }, {})).sort((a, b) => b[1] - a[1])
    y = t2SourcesCharts(doc, y, s, {
      sensorGB:    ingestionBySensor.reduce((t, r) => t + (r.bytesIngested || 0), 0) / 1024 ** 3,
      connGB:      ingestionByConnector.reduce((t, r) => t + (r.bytesIngested || 0), 0) / 1024 ** 3,
      connCat:     Object.entries(connByCategory).sort((a, b) => b[1] - a[1]),
      sensors:     [...ingestionBySensor].sort((a, b) => (b.bytesIngested || 0) - (a.bytesIngested || 0)).slice(0, 10)
                     .map(r => ({ name: r.name || '—', type: r.type, gb: (r.bytesIngested || 0) / 1024 ** 3 })),
      sensorTypes: tally(dataSensors, d => d.type),
      connStatus:  tally(connectors, c => c.status || (c.active ? 'active' : 'inactive')),
    })
  }

  // Bytes lookup for 3.2 table: connector name → bytesIngested (from /ingestion-stats/connector)
  const connIngestionLookup = {}
  for (const r of ingestionByConnector) {
    if (r.name) connIngestionLookup[r.name] = r.bytesIngested || 0
  }

  // 3.2 Connectors table
  y = needsPage(doc, y, 40)
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
    // Template 2 leaves out Status and Last Seen
    const connCols = T2 ? [0, 1, 4] : [0, 1, 2, 3, 4]
    y = tableCompact(doc,
      connCols.map(k => [s.connName || 'Name', s.connType || 'Type', s.connStatus || 'Status', s.connLastSeen || 'Last Seen', s.connIngested || 'Ingested'][k]),
      connRows.map(r => connCols.map(k => r[k])), y
    )
  }

  // 3.3 Data ingestion detail (conditional)
  // Note: ingestion endpoints return total_ingestion (bytes) only — no event count available.
  if (ingestionBySensor.length > 0 || ingestionByConnector.length > 0) {
    y = needsPage(doc, y, 40)
    y = subTitle(doc, s.sub3_3 || '3.3 Data Ingestion Detail', y)
    if (ingestionBySensor.length > 0) {
      const sensorRows = ingestionBySensor.map(r => [
        trunc(r.name || '—', 30),
        r.type    || '—',
        r.version || '—',
        fmtGB(r.bytesIngested || r.bytes || r.size || 0),
      ])
      y = tableCompact(doc,
        [
          s.sensorName    || 'Sensor',
          s.sensorType    || 'Tipo',
          s.sensorVersion || 'Versão',
          s.sensorBytes   || 'Volume',
        ],
        sensorRows, y,
        { columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 38 }, 2: { cellWidth: 22 }, 3: { cellWidth: CW - 100 } } }
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
    // ── 4.2 Detection Metrics ────────────────────────────────────────────────
    y = needsPage(doc, y, 40)
    y = subTitle(doc, s.sub4_2 || '4.2 Detection Metrics', y)
    const avgScore = cases.length > 0
      ? Math.round(cases.reduce((sum, c) => sum + (c.score || 0), 0) / cases.length)
      : 0
    const detMetRows = [
      [s.metCritical  || 'Critical Cases', fmtNum(critCases.length),                    pct(critCases.length, totalCasesCount)],
      [s.metHigh      || 'High Cases',     fmtNum(highCases.length),                    pct(highCases.length, totalCasesCount)],
      [s.metMedium    || 'Medium Cases',   fmtNum(mediumTotal),                         pct(mediumTotal, totalCasesCount)],
      [s.metLow       || 'Low Cases',      fmtNum(lowCount),                            pct(lowNum, totalCasesCount)],
      [s.metOpen      || 'Open Cases',     fmtNum(openCases.length),                    pct(openCases.length, totalCasesCount)],
      [s.metAvgScore  || 'Average Score',  String(avgScore),                            ''],
    ]
    y = tableBase(doc,
      [s.metMetric || 'Metric', s.metValue || 'Value', s.metPct || 'Of Total'],
      detMetRows, y,
      { columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 35 }, 2: { cellWidth: CW - 105 } } }
    )

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

    // ── Timeline chart (full width CW × 45mm) ──────────────────────────────
    // Template 2 replaces it with the trend lines, the weekday × hour heatmap,
    // the score histogram and the status donut.
    if (T2) {
      y = t2DetectionCharts(doc, y, s, { days: t2Period, daily: t2Daily, cases, critHigh: [...critCases, ...highCases] })
    }
    const tlData = T2 ? { labels: [] } : buildTimelineData(cases, pocMeta.pocStartDate, pocMeta.pocEndDate)
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

    // ── 4.1 Detected Cases table ─────────────────────────────────────────────
    y = needsPage(doc, y, 40)
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
    if (lowNum > 0) {
      y = infoNote(
        doc,
        (s.lowOmitted || '{n} low-severity cases omitted from table for brevity.')
          .replace('{n}', fmtNum(lowCount)),
        y
      )
      y += 4
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — MITRE ATT&CK
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc)
  y = sectionTitle(doc, s.sec5 || '5. MITRE ATT&CK Coverage', y)

  // ── 5.2 Coverage Summary ─────────────────────────────────────────────────────
  y = needsPage(doc, y, 40)
  y = subTitle(doc, s.sub5_2 || '5.2 Coverage Summary', y)
  const covCardW = (CW - 6) / 3
  const covCardH = 16
  const covCards = [
    { label: s.covDetected    || 'Detected Tactics',    value: String(detectedTactics.size),                     color: C.blue  },
    { label: s.covNotDetected || 'Not Detected',        value: String(ALL_TACTICS.length - detectedTactics.size), color: C.muted },
    { label: s.covTotal       || 'Total MITRE Tactics', value: String(ALL_TACTICS.length),                       color: C.navy  },
  ]
  for (let k = 0; k < covCards.length; k++) {
    const cx = ML + k * (covCardW + 3)
    drawKpiCard(doc, cx, y, covCardW, covCardH, covCards[k].value, covCards[k].label, covCards[k].color)
  }
  y += covCardH + 6

  // ── MITRE tactic grid (14 cells, jsPDF primitives) ──────────────────────────
  // Template 2: the same grid colored by alert volume (ATT&CK Navigator style).
  if (T2) {
    y = t2TacticMatrix(doc, y, s, caseTactics?.mitre?.tactics || [])
    y = t2MitreCharts(doc, y, s, { tactics: caseTactics?.mitre?.tactics || [], xdr: stellarTacticData })
  } else {
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
  }

  // 5.1 Tactic Coverage
  y = subTitle(doc, s.sub5_1 || '5.1 Tactic Coverage', y)

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

  // ── 5.3 Stellar Cyber XDR Proprietary Detections ────────────────────────────
  if (stellarTacticData.length > 0) {
    y = needsPage(doc, y, 40)
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
      y = needsPage(doc, y, 40)
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

  if (T2) y = drawRisksSection(y)

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

  y = needsPage(doc, y, 40)
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
  y = needsPage(doc, y, 40)
  y = sectionTitle(doc, s.sec7 || '7. Measured Results & ROI', y)
  y = subTitle(doc, s.sub7_1 || '7.1 Real Metrics', y)

  const realMetRows = [
    [s.metTotalCases     || 'Total Cases',           fmtNum(totalCasesCount),                     ''],
    [s.metCritHigh       || 'Critical + High',       fmtNum(critCases.length + highCases.length), pct(critCases.length + highCases.length, totalCasesCount)],
    [s.metMitreCov       || 'MITRE Tactic Coverage', `${mitreCovPct}%`,                           `${detectedTactics.size} / ${ALL_TACTICS.length}`],
    [
      s.metAvgEntitiesDay || 'Média Ativos/Dia',
      avgEntities || '—',
      [s.entitiesNote || 'Assets diários', entDaysNote].filter(Boolean).join(' · '),
    ],
    [s.kpiMinEntities || 'Minimum assets/day', minEntities || '—', s.minEntitiesNote || 'Lowest daily count in the period'],
    [s.kpiMaxEntities || 'Maximum assets/day', maxEntities || '—', s.maxEntitiesNote || 'Highest daily count in the period (peak)'],
    [s.metActiveSources  || 'Active Sources',        fmtNum(activeConn.length),                   `${s.of || 'of'} ${fmtNum(connectors.length)}`],
    [s.metTotalIngested  || 'Total Data Ingested',   totalIngestStr,                              s.ingestedNote || 'Total do período'],
  ]
  y = tableBase(doc,
    [s.roiMetric || 'Metric', s.roiValue || 'Value', s.roiContext || 'Context'],
    realMetRows, y
  )

  y = needsPage(doc, y, 40)
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

  // ── 7.3 License compliance (assets) ────────────────────────────────────────
  // Stellar Cyber 7.0: a level is reached when the daily count is above 110% of the
  // license on each of N consecutive days (Warning 3, Violation 7, Out of Compliance
  // 21). The rule is simulated day by day over the discovery period (utils/assetCompliance).
  y = needsPage(doc, y, 60)
  y = subTitle(doc, s.sub7_3 || '7.3 License Compliance', y)
  y = bodyText(doc, s.licHowCounted || 'Official license count: the platform counts assets of these types: unique devices (internal IPs) and unique users (emails) observed daily.', y)
  y += 2
  const lic = assetCompliance(assets)
  if (!lic.stats) {
    y = infoNote(doc, s.licNoData || 'No asset data in the PoC period.', y)
  } else if (lic.recommended == null) {
    y = infoNote(doc, (s.licInsufficient || 'Insufficient period to recommend ({n} of {d} days)').replace('{n}', lic.stats.days).replace('{d}', 3), y)
  } else {
    if (T2) {
      y = t2LicenseCharts(doc, y, s, {
        title: s.t2ChartAssets || 'Assets per day vs recommended license',
        labels: [...assets].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(a => t2DayLabel(String(a.date).slice(0, 10))),
        data:   [...assets].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(a => Number(a.entity_count) || 0),
        lic, fmt: fmtLoc, color: C.blue, seriesLabel: s.t2SeriesAssets || 'Assets/day',
      })
    }
    y = drawLicenseCompliance(doc, y, lic, {
      fmt: fmtLoc,
      fmtDay,
      txt: {
        recommended:     s.licRecommended     || 'Recommended license quantity: {l} assets',
        recommendedNote: s.licRecommendedNote || 'Highest number of assets present on each of 3 consecutive days ({from} — {to}). With this quantity no notification level is reached in the observed period.',
        limitLine:       s.licLimitLine       || 'Tolerance limit (110%): {t} assets per day.',
        shortPeriod:     s.licShortPeriod     || 'Recommendation based on {n} days of data. 30 days of asset discovery are recommended.',
        licenseCol:      s.licColLicense      || 'Licenses',
        desc: [
          s.licDescIntro     || 'With {l} asset licenses, the platform tolerates up to {t} assets per day (110%). Beyond that:',
          s.licDescWarning   || '• If the daily count stays above {t} assets on 3 consecutive days, the platform issues a Warning: a removable banner appears in the UI.',
          s.licDescViolation || '• If it stays above {t} assets for 7 consecutive days, it enters Violation: the banner can no longer be removed and the account admin receives an email.',
          s.licDescOoc       || '• If it stays above {t} assets for 21 consecutive days (7 to enter Violation + 14 in Violation), the license is Out of Compliance: services cease and a prorated invoice is issued.',
          s.licDescBreak     || 'A single day with {t} assets or fewer — including a day with count 0 — breaks the run, and the consecutive-day count starts over.',
        ],
      },
    })
  }
  y += 4

  // ── 7.4 Data ingestion (daily volume) ──────────────────────────────────────
  // /storage-usages daily volume per tenant (GB, stored after enrichment and
  // compression). Last 31 complete UTC days; the current day is never included.
  // Daily statistics + the same 7.0 compliance logic as 7.3 (volume licenses).
  y = needsPage(doc, y, 50)
  y = subTitle(doc, s.sub7_4 || '7.4 Data Ingestion', y)
  y = bodyText(doc, s.volIntro || 'Daily data volume of the tenant in the period, as recorded by the platform for volume licensing (data stored after enrichment and compression). The current day is not included, since it only closes after 24 hours.', y)
  y += 2
  if (!vol) {
    y = infoNote(doc, s.volNoData || 'No volume data in the period (the API provides the last 31 days).', y)
  } else {
    y = tableBase(doc,
      [s.roiMetric || 'Metric', s.roiValue || 'Value', s.roiContext || 'Context'],
      [
        [s.volAvg || 'Daily average', fmtVol(vol.avg),
          (s.volPeriodNote || '{days} days ({from} — {to})').replace('{days}', vol.days).replace('{from}', fmtDate(vol.from)).replace('{to}', fmtDate(vol.to))
            + ' · ' + (s.volZeroNote || '{zero} days with volume 0').replace('{zero}', vol.zeroDays)],
        [s.volMin || 'Daily minimum', fmtVol(vol.min), fmtDate(vol.minDate)],
        [s.volMax || 'Daily maximum', fmtVol(vol.max), fmtDate(vol.maxDate)],
      ], y,
      { columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } } },
    )
    y = bodyText(doc, s.volNote || 'Values may differ from the per-sensor and per-connector ingestion tables (section 3), which measure data before enrichment and compression.', y, { fontSize: 7.5, color: C.muted })
    y += 3

    const volLic = volumeCompliance(dailyVolume)
    if (volLic.recommended == null) {
      y = infoNote(doc, (s.licInsufficient || 'Insufficient period to recommend ({n} of {d} days)').replace('{n}', vol.days).replace('{d}', 3), y)
    } else {
      if (T2) {
        y = t2LicenseCharts(doc, y, s, {
          title: s.t2ChartVolume || 'Daily volume (GB) vs recommended license',
          labels: [...dailyVolume].sort((a, b) => a.date.localeCompare(b.date)).map(d => t2DayLabel(d.date)),
          data:   [...dailyVolume].sort((a, b) => a.date.localeCompare(b.date)).map(d => Math.round((Number(d.gb) || 0) * 100) / 100),
          lic: volLic, fmt: fmtVol, color: T2C.cyan, seriesLabel: s.t2SeriesVolume || 'GB/day', bars: true,
        })
      }
      y = drawLicenseCompliance(doc, y, volLic, {
        fmt: fmtVol,
        fmtDay,
        hideShortPeriod: T2,
        txt: {
          recommended:     s.volRecommended     || 'Recommended volume license: {l} per day',
          recommendedNote: s.volRecommendedNote || 'Highest daily volume present on each of 3 consecutive days ({from} — {to}). With this volume no notification level is reached in the observed period.',
          limitLine:       s.volLimitLine       || 'Tolerance limit (110%): {t} per day.',
          shortPeriod:     s.volShortPeriod     || 'Recommendation based on {n} days of data. 30 days of data are recommended.',
          licenseCol:      s.volColLicense      || 'License (GB/day)',
          desc: [
            s.volDescIntro     || 'With a {l}/day volume license, the platform tolerates up to {t} per day (110%). Beyond that:',
            s.volDescWarning   || '• If the daily volume stays above {t} on 3 consecutive days, the platform issues a Warning: a removable banner appears in the UI.',
            s.volDescViolation || '• If it stays above {t} for 7 consecutive days, it enters Violation: the banner can no longer be removed and the account admin receives an email.',
            s.volDescOoc       || '• If it stays above {t} for 21 consecutive days (7 to enter Violation + 14 in Violation), the license is Out of Compliance: services cease and a prorated invoice is issued.',
            s.volDescBreak     || 'A single day at {t} or less — including a day with volume 0 — breaks the run, and the consecutive-day count starts over.',
          ],
        },
      })
    }
  }
  y += 4

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 8 — Risks, Gaps & Recommendations
  // ════════════════════════════════════════════════════════════════════════════
  // Template 2 draws it right after section 5 (MITRE); Template 1 keeps it here.
  function drawRisksSection(y) {
    y = needsPage(doc, y, 40)
    y = sectionTitle(doc, s.sec8 || '8. Risks, Gaps & Recommendations', y)

    // 8.1 Operational Recommendations
    y = subTitle(doc, s.sub8_1 || '8.1 Operational Recommendations', y)
    if (opRecs.length === 0) {
      y = infoNote(doc, s.noOpRecs || 'No operational recommendations recorded.', y)
      y += 4
    } else {
      if (T2) y = t2RecPriorityChart(doc, y, s, opRecs)
      const opRecRows = opRecs.map(r => [
        trunc(r.title || r.name || '—', 40),
        ({ critical: s.recPrioCritical, warning: s.recPrioWarning, info: s.recPrioInfo }[r.priority]) || r.priority || r.severity || '—',
        trunc(r.description || r.details || '—', 80),
      ])
      y = tableCompact(doc,
        [s.recTitle || 'Recommendation', s.recPriority || 'Priority', s.recDesc || 'Description'],
        opRecRows, y
      )
    }

    // 8.2 MITRE-based Recommendations — real API techniques + library mitigation lookup
    y = needsPage(doc, y, 40)
    y = subTitle(doc, s.sub8_2 || '8.2 MITRE ATT&CK Recommendations', y)
    if (mitreTechniqueData.length === 0) {
      y = infoNote(doc, s.noMitreRecs || 'No MITRE techniques detected during the POC period.', y)
      y += 4
    } else {
      const mitreRecRows = mitreTechniqueData.map(tech => {
        const mitigation = getMitreMitigation(tech.id, locale)
        const mitigationText = mitigation
          ? mitigation
          : `attack.mitre.org/techniques/${(tech.id || '').replace('.', '/')}`
        return [
          tech.id || '—',
          trunc(tech.name || '—', 40),
          trunc(mitigationText, 110),
        ]
      })
      y = tableCompact(doc,
        [
          s.mitreId          || 'Technique ID',
          s.mitreName        || 'Technique',
          s.mitreMitigation  || 'Mitigation',
        ],
        mitreRecRows, y,
        { columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 48 }, 2: { cellWidth: CW - 70 } } }
      )
    }
    return y
  }
  if (!T2) y = drawRisksSection(y)

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 9 — Next Steps
  // ════════════════════════════════════════════════════════════════════════════
  y = needsPage(doc, y, 40)
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

  // Scorecard: real values derived from API data
  function scoreLabel(p) {
    if (p >= 70) return s.ratingHigh || 'Alto'
    if (p >= 35) return s.ratingMed  || 'Médio'
    return s.ratingLow || 'Baixo'
  }

  // Capacidade de Detecção: avg score of loaded cases
  const validScores = cases.filter(c => typeof c.score === 'number' && c.score > 0)
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((sum, c) => sum + c.score, 0) / validScores.length)
    : 0
  const critHighCount = critCases.length + highCases.length
  const detectionScore = scoreLabel(avgScore)
  const detectionNote  = `${fmtNum(critHighCount)} ${s.sc_critHigh || 'casos Crit+High'} | Score: ${avgScore}`

  // Eficiência de Investigação: % cases closed/resolved
  const totalCasesForPct = cases.length
  const closedPct = totalCasesForPct > 0
    ? Math.round(resolvedCases.length / totalCasesForPct * 100)
    : 0
  const investigScore = scoreLabel(closedPct)
  const investigNote  = `${fmtNum(resolvedCases.length)} ${s.sc_of || 'de'} ${fmtNum(totalCasesForPct)} ${s.sc_closed || 'casos resolvidos'} (${closedPct}%)`

  // Automação de Resposta: NDR (Modular Sensor connected) + EDR connector
  const hasNDR = dataSensors.some(ds =>
    (ds.type || '').toLowerCase().includes('modular') &&
    (ds.connectionStatus || '').toLowerCase() === 'connected'
  )
  const EDR_KEYWORDS = ['edr', 'endpoint', 'crowdstrike', 'sentinelone', 'carbon black', 'defender', 'cybereason', 'cylance', 'sophos', 'cortex']
  const hasEDR = connectors.some(c => {
    const str = ((c.name || '') + ' ' + (c.type || '') + ' ' + (c.category || '')).toLowerCase()
    return EDR_KEYWORDS.some(kw => str.includes(kw))
  })
  const autoScore = hasNDR && hasEDR ? (s.sc_yes || 'Sim') : (s.sc_no || 'Não')
  const autoNote  = hasNDR && hasEDR
    ? (s.sc_autoYes    || 'NDR e EDR integrado')
    : hasNDR
      ? (s.sc_autoNoEDR || 'NDR implementado, falta EDR')
      : (s.sc_autoNoNDR || 'Baixo índice de resposta, falta EDR')

  // Cobertura de Integração: active / total connectors
  const integScore = scoreLabel(integPct)

  // Cobertura MITRE
  const mitreScore = scoreLabel(mitreCovPct)

  const scorecardRows = [
    [s.sc10_1 || 'Detection Capability',     detectionScore, detectionNote],
    [s.sc10_2 || 'Investigation Efficiency', investigScore,  investigNote],
    [s.sc10_3 || 'Response Automation',      autoScore,      autoNote],
    [s.sc10_4 || 'Integration Coverage',     integScore,     integStr],
    [s.sc10_6 || 'MITRE Coverage',           mitreScore,     `${detectedTactics.size} ${s.sc_of || 'de'} ${ALL_TACTICS.length} ${s.sc_tactics || 'táticas'}`],
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
    "Based on the results of this Proof of Concept, Stellar Cyber's ISOC Platform demonstrated {verdict} alignment with {clientName}'s security objectives."
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
  // The executive report (template 2) gets a suffix so both files can coexist
  const suffix = params.template === 2 ? '_Executive' : ''
  doc.save(`StellarCyber_PoC${suffix}_${clientName}_${dateStr}.pdf`)
}

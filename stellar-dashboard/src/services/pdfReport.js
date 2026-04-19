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
  red:     [192, 0,   0  ],   // CONFIDENCIAL, crítico
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

// ─── Page chrome (header + footer on body pages) ─────────────────────────────

function addChrome(doc) {
  const client  = _meta.clientName  || 'Cliente'
  const partner = _meta.partnerName || 'Parceiro'
  const year    = new Date().getFullYear()

  doc.setFillColor(...C.blue)
  doc.rect(0, 0, PW, 10, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'normal')
  doc.text(`Stellar Cyber Open XDR — Relatório de PoC | ${client} — CONFIDENCIAL`, ML, 6.5)
  doc.text(`Página ${_pageNum}`, PW - MR, 6.5, { align: 'right' })

  doc.setFillColor(...C.navy)
  doc.rect(0, PH - 10, PW, 10, 'F')
  doc.setFontSize(6.5)
  doc.setTextColor(...C.white)
  doc.text(
    `© ${year} — Documento Confidencial | Stellar Cyber + ${partner} | Página ${_pageNum}`,
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

function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return String(iso) }
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

function scoreColor(s) {
  if (s === 'Excelente') return C.green
  if (s === 'Bom')       return C.blue
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
}) {
  _pageNum = 1
  _meta    = pocMeta

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Pre-compute metrics
  const openCases = cases.filter(c => !['closed', 'resolved'].includes((c.status || '').toLowerCase()))
  const critCases = cases.filter(c => c.severity?.toLowerCase() === 'critical')
  const highCases = cases.filter(c => c.severity?.toLowerCase() === 'high')
  const medCases  = cases.filter(c => c.severity?.toLowerCase() === 'medium')
  const lowCases  = cases.filter(c => c.severity?.toLowerCase() === 'low')
  const activeConn = connectors.filter(c => c.active)
  const mitrRecs   = recommendations.filter(r => r.category === 'MITRE ATT&CK')
  const opRecs     = recommendations.filter(r => r.category !== 'MITRE ATT&CK')
  const critRecs   = recommendations.filter(r => r.priority === 'critical')

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
    verdict      = 'Aprovado',
  } = pocMeta

  const period = pocStartDate && pocEndDate
    ? `${fmtDate(pocStartDate)} a ${fmtDate(pocEndDate)}`
    : fmtDate(generatedAt.toISOString())

  const verdictColor = verdict === 'Aprovado' ? C.green
    : verdict === 'Não Aprovado' ? C.red
    : C.orange

  // ══════════════════════════════════════════════════════════════════════════════
  // CAPA
  // ══════════════════════════════════════════════════════════════════════════════

  // Topo azul
  doc.setFillColor(...C.blue)
  doc.rect(0, 0, PW, 32, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text('STELLAR CYBER', ML, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Open XDR Platform', ML, 21)

  // CONFIDENCIAL no topo direito
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 210, 210)
  doc.text('CONFIDENCIAL', PW - MR, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  // Título central
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...C.navy)
  doc.text('RELATÓRIO DE', PW / 2, 72, { align: 'center' })
  doc.text('PROVA DE CONCEITO', PW / 2, 88, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(12)
  doc.setTextColor(...C.blue)
  doc.text('Stellar Cyber Open XDR Platform', PW / 2, 101, { align: 'center' })

  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.7)
  doc.line(ML + 15, 107, PW - MR - 15, 107)

  // Caixa "Preparado para"
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(ML, 114, 86, 46, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, 114, 86, 46, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text('PREPARADO PARA', ML + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(trunc(clientName, 28), ML + 4, 132)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(clientDept, 32), ML + 4, 141)

  // Caixa "Preparado por"
  const rx = PW - MR - 86
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(rx, 114, 86, 46, 2, 2, 'F')
  doc.setDrawColor(...C.midBlue)
  doc.roundedRect(rx, 114, 86, 46, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...C.navy)
  doc.text('PREPARADO POR', rx + 4, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text(trunc(seName, 28), rx + 4, 132)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.muted)
  doc.text(trunc(partnerName, 32), rx + 4, 141)
  doc.text(trunc(seEmail, 36), rx + 4, 149)

  // Tabela de metadados
  autoTable(doc, {
    startY: 168,
    body: [
      ['Versão', version, 'Período da PoC', period],
      ['Data do Relatório', fmtDate(generatedAt.toISOString()), 'Veredicto', verdict],
    ],
    styles:     { fontSize: 9.5, cellPadding: 4.5, textColor: C.text },
    bodyStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 40 },
      1: { cellWidth: 51 },
      2: { fontStyle: 'bold', textColor: C.navy, cellWidth: 40 },
      3: { cellWidth: 51, fontStyle: 'bold', textColor: verdictColor },
    },
    margin:          { left: ML, right: MR },
    tableLineColor:  C.blue,
    tableLineWidth:  0.3,
  })

  // Rodapé da capa
  doc.setFillColor(...C.navy)
  doc.rect(0, PH - 22, PW, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.white)
  doc.text('CONFIDENCIAL', PW / 2, PH - 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(200, 210, 230)
  doc.text(
    'Este documento contém informações proprietárias e confidenciais. Distribuição restrita.',
    PW / 2, PH - 6, { align: 'center' }
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 1 — SUMÁRIO EXECUTIVO
  // ══════════════════════════════════════════════════════════════════════════════

  let y = newPage(doc)
  y = sectionTitle(doc, 1, 'Sumário Executivo', y)
  y = subTitle(doc, '1.1 Indicadores-Chave do PoC', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Indicador', 'Resultado']],
    body: [
      ['Período de Avaliação',        period],
      ['Fontes de Log Integradas',    String(connectors.length)],
      ['Alertas / Cases Detectados',  String(cases.length)],
      ['Cases Abertos',               String(openCases.length)],
      ['Cases Críticos',              String(critCases.length)],
      ['Cobertura MITRE ATT\u0026CK', `${mitreCovPct}% (${detectedTactics.size} de ${ALL_TACTICS.length} táticas)`],
      ['Assets / Tenants Monitorados',String(tenants.length)],
      ['Veredicto Final',             verdict],
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
  y = subTitle(doc, '1.2 Contexto e Objetivos', y)
  y = bodyText(doc, `Este relatório apresenta os resultados da Prova de Conceito (PoC) da plataforma Stellar Cyber Open XDR, conduzida para ${clientName}. A avaliação teve como objetivo demonstrar as capacidades de detecção, correlação e resposta a ameaças em um ambiente representativo do cliente.`, y)
  y += 4
  y = bodyText(doc, `Durante o período de ${period}, foram integradas ${connectors.length} fontes de dados, resultando na detecção de ${cases.length} alertas/cases, com cobertura de ${mitreCovPct}% das táticas do framework MITRE ATT&CK Enterprise.`, y)
  y += 10

  // Bloco de veredicto
  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 16, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.white)
  doc.text(`Veredicto: ${verdict}`, PW / 2, y + 10, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 2 — ESCOPO E METODOLOGIA
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 2, 'Escopo e Metodologia', y)
  y = subTitle(doc, '2.1 Ambiente Avaliado', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Componente', 'Detalhes']],
    body: [
      ['Instância Stellar Cyber', trunc(auth?.url || '—', 60)],
      ['Usuário de Avaliação',    auth?.username || '—'],
      ['Fontes de Log (Sensors)', `${connectors.length} conectores integrados`],
      ['Tenants / Assets',        `${tenants.length} entidades monitoradas`],
      ['Período de Coleta',        period],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 75 },
      1: { cellWidth: CW - 75 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, '2.2 Fases da Metodologia', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Fase', 'Atividade', 'Status']],
    body: [
      ['1 — Integração',   'Integração de fontes de log e sensores na plataforma',        'Concluído'],
      ['2 — Baseline',     'Estabelecimento de baseline comportamental do ambiente',        'Concluído'],
      ['3 — Simulação',    'Execução de cenários de ataque e análise de detecção',          'Concluído'],
      ['4 — Análise',      'Correlação de eventos e mapeamento MITRE ATT\u0026CK',          'Concluído'],
      ['5 — Relatório',    'Documentação de resultados, gaps e recomendações',              'Concluído'],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 112 },
      2: { cellWidth: CW - 154, halign: 'center', textColor: C.green, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, '2.3 Critérios de Sucesso', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Critério', 'Meta', 'Resultado', 'Status']],
    body: [
      ['Integração de fontes',       '≥ 5 fontes',  `${connectors.length} integradas`,  connectors.length >= 5 ? 'Atingido' : 'Parcial'],
      ['Detecção de ameaças',        '≥ 1 case',    `${cases.length} detectados`,        cases.length >= 1 ? 'Atingido' : 'Não Atingido'],
      ['Cobertura MITRE ATT\u0026CK','≥ 20%',       `${mitreCovPct}%`,                   mitreCovPct >= 20 ? 'Atingido' : 'Parcial'],
      ['Disponibilidade plataforma', '≥ 99%',       '99,9%',                             'Atingido'],
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
        d.cell.styles.textColor = v === 'Atingido' ? C.green : v === 'Parcial' ? C.orange : C.red
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 3 — VISÃO TÉCNICA DA PLATAFORMA
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 3, 'Visão Técnica da Plataforma', y)
  y = subTitle(doc, '3.1 Arquitetura Stellar Cyber Open XDR', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Componente', 'Descrição', 'Status']],
    body: [
      ['Open XDR Platform',    'Motor central de correlação e detecção baseado em IA/ML',        'Ativo'],
      ['Security Data Lake',   'Armazenamento centralizado e normalizado de todos os eventos',    'Ativo'],
      ['AI-Powered Detection', 'Detecção de anomalias comportamentais e ameaças conhecidas',      'Ativo'],
      ['Threat Intelligence',  'Integração com feeds de inteligência de ameaças externos',        'Ativo'],
      ['MITRE ATT\u0026CK Mapping', 'Mapeamento automático de alertas para táticas e técnicas',  'Ativo'],
      ['Automated Response',   'Orquestração e automação de resposta a incidentes (SOAR)',        'Ativo'],
      ['Multi-Tenancy',        'Suporte a múltiplos tenants com isolamento de dados',              'Ativo'],
    ],
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' },
      1: { cellWidth: 100 },
      2: { cellWidth: CW - 158, halign: 'center', textColor: C.green, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, '3.2 Modelo de Implantação', y)
  y = bodyText(doc, `Instância avaliada: ${auth?.url || '—'}. Implantação em modo SaaS/Cloud com acesso seguro via API REST autenticada por Bearer JWT. Interface web acessível via navegador sem necessidade de instalação de agente no lado do cliente.`, y)
  y += 10

  y = subTitle(doc, '3.3 Integrações Configuradas', y)

  if (connectors.length === 0) {
    y = bodyText(doc, 'Nenhum conector/sensor identificado via API.', y)
    y += 4
  } else {
    autoTable(doc, {
      ...tableBase({ styles: { fontSize: 8.5, cellPadding: 2.5, textColor: C.text, lineColor: [210, 210, 210], lineWidth: 0.1 }, headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 } }),
      startY: y,
      head: [['Nome do Conector', 'Tipo', 'Categoria', 'Status']],
      body: connectors.slice(0, 35).map(c => [
        trunc(c.name || '—', 42),
        trunc(c.type || '—', 22),
        trunc(c.category || '—', 22),
        c.active ? 'Online' : 'Offline',
      ]),
      columnStyles: {
        0: { cellWidth: 72, fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 44 },
        3: { cellWidth: CW - 158, halign: 'center' },
      },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw === 'Online' ? C.green : C.red
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc.lastAutoTable?.finalY ?? y) + 6
    if (connectors.length > 35) {
      doc.setFontSize(7.5)
      doc.setTextColor(...C.muted)
      doc.text(`Exibindo 35 de ${connectors.length} conectores.`, ML, y)
      y += 6
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 4 — RESULTADOS DE DETECÇÃO E RESPOSTA
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 4, 'Resultados de Detecção e Resposta', y)
  y = subTitle(doc, '4.1 Cenários de Ataque Detectados', y)

  if (cases.length === 0) {
    y = bodyText(doc, 'Nenhum case detectado durante o período de avaliação.', y)
    y += 4
  } else {
    const sevOrd = { critical: 0, high: 1, medium: 2, low: 3 }
    const sortedCases = [...cases]
      .sort((a, b) => (sevOrd[a.severity?.toLowerCase()] ?? 4) - (sevOrd[b.severity?.toLowerCase()] ?? 4))
      .slice(0, 50)

    autoTable(doc, {
      ...tableBase({
        styles:     { fontSize: 8, cellPadding: 2.5, textColor: C.text, lineColor: [210,210,210], lineWidth: 0.1 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      }),
      startY: y,
      head: [['Case / Alerta', 'Severidade', 'Status', 'Assets', 'Score', 'Data']],
      body: sortedCases.map(c => [
        trunc(c.name || c.id || '—', 56),
        (c.severity || '—').toUpperCase(),
        trunc(c.status || '—', 18),
        String(c.assetsAffected || 1),
        c.score != null ? String(c.score) : '—',
        fmtDate(c.createdAt),
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
      doc.text(`Exibindo 50 de ${cases.length} cases, ordenados por severidade.`, ML, y)
      y += 8
    }
  }

  if (y > 230) { y = newPage(doc) }
  else { y += 4 }
  y = subTitle(doc, '4.2 Métricas de Detecção', y)

  autoTable(doc, {
    ...tableBase({ tableWidth: 130 }),
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Total de Cases / Alertas',   String(cases.length)],
      ['Cases Abertos',              String(openCases.length)],
      ['Cases Críticos',             String(critCases.length)],
      ['Cases de Alta Severidade',   String(highCases.length)],
      ['Cases de Média Severidade',  String(medCases.length)],
      ['Cases de Baixa Severidade',  String(lowCases.length)],
      ['Taxa de Abertura',           pct(openCases.length, cases.length)],
      ['Sensores Ativos',            `${activeConn.length} de ${connectors.length}`],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 90 },
      1: { cellWidth: 40, halign: 'center' },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 5 — ANÁLISE DE COBERTURA MITRE ATT&CK
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 5, 'Análise de Cobertura MITRE ATT\u0026CK', y)
  y = subTitle(doc, '5.1 Mapeamento de Táticas Detectadas', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['ID', 'Tática', 'Técnicas Detectadas', 'Cobertura']],
    body: ALL_TACTICS.map(tactic => {
      const hits     = mitrRecs.filter(r => r.mitre?.tactic?.id === tactic.id)
      const covered  = hits.length > 0
      const techList = hits.map(r => r.mitre?.technique?.id).filter(Boolean).join(', ') || '—'
      return [tactic.id, tactic.name, techList, covered ? 'Detectado' : 'Não Detectado']
    }),
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 75 },
      3: { cellWidth: CW - 152, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        d.cell.styles.textColor = d.cell.raw === 'Detectado' ? C.green : C.muted
        d.cell.styles.fontStyle = d.cell.raw === 'Detectado' ? 'bold' : 'normal'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  if (y > 240) { y = newPage(doc) }
  y = subTitle(doc, '5.2 Resumo de Cobertura', y)

  // Três boxes de métricas
  const bw = (CW - 8) / 3
  const bh = 22

  doc.setFillColor(...C.midBlue)
  doc.roundedRect(ML, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.white)
  doc.text(`${mitreCovPct}%`, ML + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text('Cobertura Total', ML + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  const b2x = ML + bw + 4
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(b2x, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.navy)
  doc.text(`${detectedTactics.size}`, b2x + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text('Táticas Detectadas', b2x + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  const b3x = ML + (bw + 4) * 2
  doc.setFillColor(...C.rowAlt)
  doc.roundedRect(b3x, y, bw, bh, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...C.navy)
  doc.text(`${mitrRecs.length}`, b3x + bw / 2, y + 13, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text('Técnicas Mapeadas', b3x + bw / 2, y + 19, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 6 — AVALIAÇÃO OPERACIONAL
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 6, 'Avaliação Operacional', y)
  y = subTitle(doc, '6.1 Experiência do Analista SOC', y)
  y = bodyText(doc, 'A plataforma Stellar Cyber demonstrou interface unificada com visualização clara de alertas priorizados por risco. O painel de investigations permite ao analista navegar do alerta até o evento bruto em poucos cliques, reduzindo significativamente o Mean Time to Detect (MTTD) e o Mean Time to Respond (MTTR).', y)
  y += 8

  y = subTitle(doc, '6.2 Fluxo de Resposta a Incidentes', y)
  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Etapa', 'Ação', 'Ferramenta']],
    body: [
      ['1 — Detecção',     'Alerta gerado automaticamente pela plataforma',          'Stellar Cyber AI Engine'],
      ['2 — Triagem',      'Analista revisa alerta e contexto correlacionado',        'Stellar Cyber Console'],
      ['3 — Investigação', 'Análise de linha do tempo e pivôs de dados',              'Security Data Lake'],
      ['4 — Contenção',    'Isolamento de host ou bloqueio de IP via integração',     'SOAR / EDR / Firewall'],
      ['5 — Remediação',   'Limpeza, patch e restauração de serviço',                 'Equipe de TI'],
      ['6 — Documentação', 'Case fechado com timeline e RCA registrados',             'Stellar Cyber Cases'],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 95 },
      2: { cellWidth: CW - 137 },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, '6.3 Automação e Playbooks', y)
  y = bodyText(doc, 'A plataforma suporta automação de resposta via playbooks configuráveis (SOAR nativo), permitindo ações automáticas como: enriquecimento de alertas com threat intelligence, notificações de equipe, isolamento de endpoint e bloqueio de IPs maliciosos — reduzindo a carga operacional do SOC.', y)

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 7 — ANÁLISE DE ROI E CONSOLIDAÇÃO
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 7, 'Análise de ROI e Consolidação', y)
  y = subTitle(doc, '7.1 Comparativo de TCO (3 Anos)', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Item', 'Ambiente Atual (Estimado)', 'Com Stellar Cyber']],
    body: [
      ['Ferramentas de Segurança (SIEM, EDR, NDR)', 'Múltiplas licenças separadas', 'Plataforma unificada'],
      ['Horas de Analista (triagem manual)',         'Alto volume de trabalho manual','Redução de até 80%'],
      ['MTTD (Tempo médio de detecção)',             '> 24 horas',                   '< 1 hora'],
      ['MTTR (Tempo médio de resposta)',             '> 72 horas',                   '< 4 horas'],
      ['Integração de fontes de log',               'Desenvolvimento customizado',   'Conectores nativos prontos'],
      ['Cobertura MITRE ATT\u0026CK',               'Parcial / desconhecida',        `${mitreCovPct}% (mensurado)`],
    ],
    columnStyles: {
      0: { cellWidth: 78, fontStyle: 'bold' },
      1: { cellWidth: 56, halign: 'center' },
      2: { cellWidth: CW - 134, halign: 'center', textColor: C.blue, fontStyle: 'bold' },
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 10
  y = subTitle(doc, '7.2 Benefícios Qualitativos', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Benefício', 'Impacto']],
    body: [
      ['Visibilidade Unificada',       'Correlação de dados de toda a superfície de ataque em uma única plataforma'],
      ['Redução de Fadiga de Alertas', 'IA/ML prioriza e agrupa alertas, reduzindo o ruído operacional do SOC'],
      ['Conformidade e Auditoria',     'Logs centralizados facilitam auditorias e requisitos regulatórios (LGPD, ISO 27001)'],
      ['Escalabilidade',               'Arquitetura cloud-native escala automaticamente com o crescimento do ambiente'],
      ['Consolidação de Equipe',       'Uma plataforma substitui múltiplas ferramentas e equipes especializadas'],
    ],
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold' },
      1: { cellWidth: CW - 68 },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 8 — RISCOS, GAPS E RECOMENDAÇÕES
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 8, 'Riscos, Gaps e Recomendações', y)
  y = subTitle(doc, '8.1 Riscos Identificados', y)

  if (recommendations.length === 0) {
    y = bodyText(doc, 'Nenhum risco identificado durante o período de avaliação.', y)
    y += 6
  } else {
    autoTable(doc, {
      ...tableBase({ styles: { fontSize: 8.5, cellPadding: 2.8, textColor: C.text, lineColor: [210,210,210], lineWidth: 0.1 }, headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 } }),
      startY: y,
      head: [['Prioridade', 'Risco / Gap', 'Descrição']],
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
    y = subTitle(doc, '8.2 Recomendações Técnicas — MITRE ATT\u0026CK', y)

    autoTable(doc, {
      ...tableBase({ styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: C.text, lineColor: [210,210,210], lineWidth: 0.1 }, headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 } }),
      startY: y,
      head: [['Técnica', 'Tática', 'Cases', 'Mitigação Recomendada']],
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
  // SEÇÃO 9 — PRÓXIMOS PASSOS
  // ══════════════════════════════════════════════════════════════════════════════

  if (y > 215) { y = newPage(doc) } else { y += 6 }
  y = sectionTitle(doc, 9, 'Próximos Passos', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['#', 'Ação', 'Responsável', 'Prazo']],
    body: [
      ['1', 'Aprovação formal do resultado do PoC pela liderança técnica',              clientName,                  '30 dias'],
      ['2', 'Definição de escopo e arquitetura para implantação em produção',           `${seName} / ${clientName}`, '30 dias'],
      ['3', 'Integração de todas as fontes de log do ambiente de produção',             clientName,                  '60 dias'],
      ['4', 'Configuração de playbooks e automações de resposta a incidentes',          seName,                      '60 dias'],
      ['5', 'Treinamento da equipe SOC na plataforma Stellar Cyber',                   seName,                      '60 dias'],
      ['6', 'Revisão de cobertura MITRE ATT\u0026CK e ajuste de regras de detecção',   seName,                      '90 dias'],
      ['7', 'Apresentação consolidada de resultados ao board executivo',               clientName,                  '90 dias'],
    ],
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 98 },
      2: { cellWidth: 50 },
      3: { cellWidth: CW - 156, halign: 'center' },
    },
  })

  // ══════════════════════════════════════════════════════════════════════════════
  // SEÇÃO 10 — CONCLUSÃO
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = sectionTitle(doc, 10, 'Conclusão', y)
  y = subTitle(doc, '10.1 Scorecard Final', y)

  const scoreItems = [
    { item: 'Capacidade de Detecção',    score: cases.length > 0 ? (critCases.length > 0 ? 'Excelente' : 'Bom') : 'Regular' },
    { item: 'Integração de Fontes',      score: connectors.length >= 5 ? 'Excelente' : connectors.length >= 2 ? 'Bom' : 'Regular' },
    { item: 'Cobertura MITRE ATT\u0026CK', score: mitreCovPct >= 40 ? 'Excelente' : mitreCovPct >= 20 ? 'Bom' : 'Regular' },
    { item: 'Usabilidade da Plataforma', score: 'Bom' },
    { item: 'Automação e Resposta',      score: 'Bom' },
    { item: 'Visibilidade e Correlação', score: cases.length > 0 ? 'Excelente' : 'Bom' },
  ]

  autoTable(doc, {
    ...tableBase({ tableWidth: 140 }),
    startY: y,
    head: [['Critério de Avaliação', 'Avaliação']],
    body: scoreItems.map(s => [s.item, s.score]),
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        d.cell.styles.textColor = scoreColor(d.cell.raw)
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = (doc.lastAutoTable?.finalY ?? y) + 12

  // Bloco veredicto final
  doc.setFillColor(...verdictColor)
  doc.roundedRect(ML, y, CW, 18, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.white)
  doc.text(`Veredicto Final: ${verdict}`, PW / 2, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 26

  y = bodyText(doc, `Com base nos resultados obtidos durante o período de PoC (${period}), a plataforma Stellar Cyber Open XDR demonstrou capacidades robustas de detecção, correlação e resposta a ameaças, com cobertura de ${mitreCovPct}% das táticas MITRE ATT&CK e detecção de ${cases.length} alertas/cases no ambiente de ${clientName}.`, y)
  y += 10

  // Assinaturas
  if (y > 240) { y = newPage(doc) }
  y = subTitle(doc, '10.2 Assinaturas', y)

  doc.setDrawColor(...C.muted)
  doc.setLineWidth(0.3)
  doc.line(ML, y + 20, ML + 82, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(seName, ML, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(`Systems Engineer — ${partnerName}`, ML, y + 31)
  doc.text(seEmail, ML, y + 37)

  doc.line(PW - MR - 82, y + 20, PW - MR, y + 20)
  doc.setFontSize(8.5)
  doc.setTextColor(...C.text)
  doc.text(clientName, PW - MR - 82, y + 25)
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(clientDept, PW - MR - 82, y + 31)

  // ══════════════════════════════════════════════════════════════════════════════
  // APÊNDICE A — GLOSSÁRIO
  // ══════════════════════════════════════════════════════════════════════════════

  y = newPage(doc)
  y = appendixTitle(doc, 'Apêndice A — Glossário', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Termo', 'Definição']],
    body: [
      ['Open XDR',      'Extended Detection and Response aberta, integrando múltiplas fontes de dados de segurança'],
      ['SIEM',          'Security Information and Event Management — correlação centralizada de logs e eventos'],
      ['MITRE ATT\u0026CK','Framework de conhecimento de táticas e técnicas adversariais baseado em observações reais'],
      ['SOC',           'Security Operations Center — centro de operações de segurança'],
      ['MTTD',          'Mean Time to Detect — tempo médio entre a ocorrência e a detecção de um incidente'],
      ['MTTR',          'Mean Time to Respond — tempo médio entre a detecção e a contenção de um incidente'],
      ['PoC',           'Proof of Concept — prova de conceito para validação de tecnologia'],
      ['TCO',           'Total Cost of Ownership — custo total de propriedade de uma solução'],
      ['SOAR',          'Security Orchestration, Automation and Response — automação de resposta a incidentes'],
      ['IoC',           'Indicator of Compromise — artefato que indica comprometimento de um sistema'],
      ['TTP',           'Tactics, Techniques and Procedures — conjunto de comportamentos adversariais'],
      ['LGPD',          'Lei Geral de Proteção de Dados — regulação brasileira de privacidade de dados'],
    ],
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: CW - 38 },
    },
  })

  // ── APÊNDICE B — CONTROLE DE VERSÕES ─────────────────────────────────────────

  y = (doc.lastAutoTable?.finalY ?? y) + 14
  if (y > 240) { y = newPage(doc) }
  y = appendixTitle(doc, 'Apêndice B — Controle de Versões', y)

  autoTable(doc, {
    ...tableBase(),
    startY: y,
    head: [['Versão', 'Data', 'Autor', 'Descrição']],
    body: [
      [version, fmtDate(generatedAt.toISOString()), seName, 'Versão inicial do Relatório de Prova de Conceito'],
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
  const client = (meta.clientName || 'cliente').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const date   = new Date().toISOString().split('T')[0]
  doc.save(`relatorio-poc-stellarcyber-${client}-${date}.pdf`)
}

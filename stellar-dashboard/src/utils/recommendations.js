import { correlateMitre } from './mitreMapping'

export function generateRecommendations({ cases, connectors, sensors, tenants, assets, ingestionTimeline }) {
  const recs = []

  const allConnectors = connectors ?? sensors ?? []

  // 1. Connector Coverage
  const totalConnectors  = allConnectors.length
  const offlineConnectors = allConnectors.filter(c => !c.active && c.status === 'offline').length
  const offlinePct       = totalConnectors > 0 ? (offlineConnectors / totalConnectors) * 100 : 0
  if (offlinePct > 20) {
    recs.push({
      id: 'connector-coverage',
      priority: offlinePct > 50 ? 'critical' : 'warning',
      title: 'Conectores Inativos Detectados',
      description: `${offlineConnectors} de ${totalConnectors} conectores (${offlinePct.toFixed(0)}%) estão inativos, reduzindo a cobertura de visibilidade.`,
      steps: [
        'Identifique os conectores inativos na página de Sensores',
        'Verifique a conectividade de rede dos conectores afetados',
        'Confirme as credenciais e permissões de cada conector',
        'Revise as regras de firewall para portas de comunicação',
        'Contate o suporte Stellar Cyber se os conectores permanecerem offline por mais de 30 minutos',
      ],
      impact:   Math.min(100, offlinePct * 1.5),
      category: 'Infrastructure',
    })
  }

  // 2. Data Gap Detection
  const lastEvent = ingestionTimeline?.[0]
  if (lastEvent) {
    const hrsAgo = (Date.now() - new Date(lastEvent.timestamp).getTime()) / 3600000
    if (hrsAgo > 2) {
      recs.push({
        id: 'data-gap',
        priority: hrsAgo > 6 ? 'critical' : 'warning',
        title: 'Potential Data Ingestion Gap',
        description: `Last data received ${hrsAgo.toFixed(1)} hours ago. Gaps longer than 2 hours may indicate an ingestion pipeline issue.`,
        steps: [
          'Check the Data Reception Timeline for the last known source',
          'Verify data connectors are running in the Stellar Cyber UI',
          'Check source system logs for export failures',
          'Review disk space and queue depth on ingestion nodes',
          'Restart the ingestion service if necessary',
        ],
        impact:   Math.min(100, hrsAgo * 10),
        category: 'Data Pipeline',
      })
    }
  }

  // 3. Case Backlog
  const openCases = cases.filter(c => ['new', 'open'].includes((c.status || '').toLowerCase())).length
  if (openCases > 50) {
    recs.push({
      id: 'case-backlog',
      priority: openCases > 100 ? 'critical' : 'warning',
      title: 'High Case Backlog Detected',
      description: `${openCases} open cases detected. A backlog above 50 cases risks analyst fatigue and delayed response times.`,
      steps: [
        'Sort cases by severity — address Critical and High first',
        'Enable auto-triage rules in Cases > Settings',
        'Assign cases to available analysts via the team queue',
        'Close or merge duplicate/low-confidence cases',
        'Review alert tuning to reduce false positives',
      ],
      impact:   Math.min(100, openCases * 0.8),
      category: 'Operations',
    })
  }

  // 4. Critical cases open > 24h
  const staleCritical = cases.filter(c => {
    if ((c.severity || '').toLowerCase() !== 'critical') return false
    const hrs = (Date.now() - new Date(c.createdAt).getTime()) / 3600000
    return hrs > 24
  })
  if (staleCritical.length > 0) {
    recs.push({
      id: 'stale-critical',
      priority: 'critical',
      title: `${staleCritical.length} Critical Case(s) Open Over 24 Hours`,
      description: 'Unresolved critical cases older than 24 hours indicate a potential escalation risk and SLA breach.',
      steps: [
        'Immediately review the listed critical cases in the Cases page',
        'Escalate to senior SOC analyst or incident commander',
        'Initiate incident response playbook if not already done',
        'Document all response actions taken',
        'Notify stakeholders per your escalation matrix',
      ],
      impact:   95,
      category: 'Incident Response',
    })
  }

  // 5. Connectors without recent data (> 48h)
  const staleConnectors = allConnectors.filter(c => {
    const ts = c.lastDataReceived || c.lastActivity || c.lastSeen
    if (!ts) return true
    const hrs = (Date.now() - new Date(ts).getTime()) / 3600000
    return hrs > 48
  })
  if (staleConnectors.length > 0 && allConnectors.length > 0) {
    const pct = ((staleConnectors.length / allConnectors.length) * 100).toFixed(0)
    recs.push({
      id: 'stale-connectors',
      priority: Number(pct) > 30 ? 'warning' : 'info',
      title: `${staleConnectors.length} Conectores Sem Dados Recentes`,
      description: `${pct}% dos conectores não reportaram atividade nas últimas 48 horas — possível ponto cego de visibilidade.`,
      steps: [
        'Revise a lista de conectores na página de Sensores',
        'Verifique credenciais e status de cada conector afetado',
        'Cheque se a fonte de log ainda está ativa e exportando dados',
        'Ative o monitoramento automático de conectores inativos',
      ],
      impact:   Math.min(85, staleConnectors.length * 2),
      category: 'Data Coverage',
    })
  }

  // 6. MITRE ATT&CK-enriched recommendations from open cases
  const mitreRecs = generateMitreRecommendations(cases)
  recs.push(...mitreRecs)

  if (recs.length === 0) {
    recs.push({
      id: 'all-good',
      priority: 'info',
      title: 'All Systems Nominal',
      description: 'No critical recommendations at this time. Your security posture looks healthy.',
      steps: [
        'Continue monitoring sensor and ingestion health',
        'Review weekly case trends for emerging patterns',
        'Schedule a quarterly security posture review',
      ],
      impact:   5,
      category: 'General',
    })
  }

  return recs.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
  })
}

/**
 * Groups open cases by MITRE ATT&CK technique and returns one recommendation per technique.
 * Each recommendation includes the MITRE technique, tactic, risk, and mitigation.
 */
function generateMitreRecommendations(cases) {
  const techniqueMap = new Map()

  for (const c of cases) {
    if (['closed', 'resolved'].includes((c.status || '').toLowerCase())) continue
    const correlation = correlateMitre(c.name || c.description || '')
    if (!correlation) continue

    const key = correlation.technique.id
    if (!techniqueMap.has(key)) {
      techniqueMap.set(key, { correlation, cases: [] })
    }
    techniqueMap.get(key).cases.push(c)
  }

  return Array.from(techniqueMap.values()).map(({ correlation, cases: affected }) => {
    const hasCritical = affected.some(c => c.severity?.toLowerCase() === 'critical')
    const hasHigh     = affected.some(c => c.severity?.toLowerCase() === 'high')

    return {
      id:       `mitre-${correlation.technique.id}`,
      priority: hasCritical ? 'critical' : 'warning',
      title:    `${correlation.technique.id}: ${correlation.technique.name}`,
      description:
        `${affected.length} caso(s) associado(s) à tática ${correlation.tactic.name} (${correlation.tactic.id}). ` +
        correlation.risk,
      steps: [
        correlation.mitigation,
        `Revise ${affected.length} caso(s) afetado(s) na página de Cases`,
        `Referência MITRE ATT&CK: attack.mitre.org/techniques/${correlation.technique.id.replace('.', '/')}`,
      ],
      impact:   hasCritical ? 90 : hasHigh ? 70 : 50,
      category: 'MITRE ATT&CK',
      mitre: {
        technique:     correlation.technique,
        tactic:        correlation.tactic,
        risk:          correlation.risk,
        mitigation:    correlation.mitigation,
        affectedCases: affected.length,
      },
    }
  })
}

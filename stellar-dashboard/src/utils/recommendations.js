import { correlateMitre, getMitreById } from './mitreMapping'
import { translate } from '../i18n/messages'

export function generateRecommendations({ cases, connectors, sensors, tenants, assets, ingestionTimeline, mitreTechniques = [], locale = 'pt' }) {
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
      title:       translate('recOps.connectorCoverage.title', { offline: offlineConnectors, total: totalConnectors, pct: offlinePct.toFixed(0) }, locale),
      description: translate('recOps.connectorCoverage.description', { offline: offlineConnectors, total: totalConnectors, pct: offlinePct.toFixed(0) }, locale),
      steps:       translate('recOps.connectorCoverage.steps', { offline: offlineConnectors, total: totalConnectors, pct: offlinePct.toFixed(0) }, locale),
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
        title:       translate('recOps.dataGap.title', { hours: hrsAgo.toFixed(1) }, locale),
        description: translate('recOps.dataGap.description', { hours: hrsAgo.toFixed(1) }, locale),
        steps:       translate('recOps.dataGap.steps', { hours: hrsAgo.toFixed(1) }, locale),
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
      title:       translate('recOps.caseBacklog.title', { open: openCases }, locale),
      description: translate('recOps.caseBacklog.description', { open: openCases }, locale),
      steps:       translate('recOps.caseBacklog.steps', { open: openCases }, locale),
      impact:   Math.min(100, openCases * 0.8),
      category: 'Operations',
    })
  }

  // 4. Critical cases open > 24h
  const staleCritical = cases.filter(c => {
    if ((c.severity || '').toLowerCase() !== 'critical') return false
    if (!c.createdAt) return false
    const hrs = (Date.now() - new Date(c.createdAt).getTime()) / 3600000
    return hrs > 24
  })
  if (staleCritical.length > 0) {
    recs.push({
      id: 'stale-critical',
      priority: 'critical',
      title:       translate('recOps.staleCritical.title', { n: staleCritical.length }, locale),
      description: translate('recOps.staleCritical.description', { n: staleCritical.length }, locale),
      steps:       translate('recOps.staleCritical.steps', { n: staleCritical.length }, locale),
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
      title:       translate('recOps.staleConnectors.title', { n: staleConnectors.length, pct }, locale),
      description: translate('recOps.staleConnectors.description', { n: staleConnectors.length, pct }, locale),
      steps:       translate('recOps.staleConnectors.steps', { n: staleConnectors.length, pct }, locale),
      impact:   Math.min(85, staleConnectors.length * 2),
      category: 'Data Coverage',
    })
  }

  // 6. MITRE ATT&CK recommendations — real API techniques + library lookup by ID
  const mitreRecs = generateMitreRecommendations(mitreTechniques, locale)
  recs.push(...mitreRecs)

  const hasData = cases.length > 0 || allConnectors.length > 0 || (ingestionTimeline?.length ?? 0) > 0
  if (recs.length === 0 && hasData) {
    recs.push({
      id: 'all-good',
      priority: 'info',
      title:       translate('recOps.allGood.title', {}, locale),
      description: translate('recOps.allGood.description', {}, locale),
      steps:       translate('recOps.allGood.steps', {}, locale),
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
 * Builds MITRE ATT&CK recommendations from real API technique data.
 * Each technique detected by the API is looked up in the local MITRE library by ID.
 * Techniques not in the library get a reference link to attack.mitre.org.
 */
function generateMitreRecommendations(mitreTechniques, locale) {
  if (!mitreTechniques || mitreTechniques.length === 0) return []

  return mitreTechniques.map(tech => {
    const rule       = getMitreById(tech.id)
    const mitigation = rule?.mitigation?.[locale] || rule?.mitigation?.pt || null
    const techPath   = (tech.id || '').replace('.', '/')
    const refUrl     = `attack.mitre.org/techniques/${techPath}`

    return {
      id:          `mitre-${tech.id}`,
      priority:    tech.caseCount >= 5 ? 'critical' : tech.caseCount >= 2 ? 'warning' : 'info',
      title:       `${tech.id}: ${tech.name || tech.id}`,
      description: mitigation || refUrl,
      steps:       mitigation
        ? [mitigation, `${tech.caseCount} case(s) · ${tech.alertCount} alert(s)`, refUrl]
        : [`${tech.caseCount} case(s) · ${tech.alertCount} alert(s)`, refUrl],
      impact:      Math.min(90, (tech.caseCount || 0) * 8 + Math.min((tech.alertCount || 0), 10)),
      category:    'MITRE ATT&CK',
      mitre: {
        technique:  { id: tech.id,       name: tech.name      },
        tactic:     { id: tech.tacticId, name: tech.tacticName },
        mitigation: mitigation || refUrl,
        caseCount:  tech.caseCount,
        alertCount: tech.alertCount,
      },
    }
  })
}

export function generateRecommendations({ cases, sensors, assets, ingestionTimeline }) {
  const recs = []

  // 1. Sensor Coverage
  const totalSensors = sensors.length
  const offlineSensors = sensors.filter(s => s.status === 'offline').length
  const offlinePct = totalSensors > 0 ? (offlineSensors / totalSensors) * 100 : 0
  if (offlinePct > 20) {
    recs.push({
      id: 'sensor-coverage',
      priority: offlinePct > 50 ? 'critical' : 'warning',
      title: 'Sensor Connectivity Issues Detected',
      description: `${offlineSensors} of ${totalSensors} sensors (${offlinePct.toFixed(0)}%) are currently offline, reducing your visibility coverage.`,
      steps: [
        'Identify offline sensors in the Sensors page',
        'Check network connectivity to affected sensor hosts',
        'Verify sensor service is running: `systemctl status stellar-sensor`',
        'Review firewall rules for sensor communication ports',
        'Contact Stellar Cyber support if sensors remain offline after 30 minutes',
      ],
      impact: Math.min(100, offlinePct * 1.5),
      category: 'Infrastructure',
    })
  }

  // 2. Data Gap Detection
  const lastEvent = ingestionTimeline[0]
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
        impact: Math.min(100, hrsAgo * 10),
        category: 'Data Pipeline',
      })
    }
  }

  // 3. Case Backlog
  const openCases = cases.filter(c => c.status === 'open').length
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
      impact: Math.min(100, openCases * 0.8),
      category: 'Operations',
    })
  }

  // 4. Critical cases open > 24h
  const staleCritical = cases.filter(c => {
    if (c.severity !== 'critical') return false
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
      impact: 95,
      category: 'Incident Response',
    })
  }

  // 5. Asset Blind Spots
  const staleAssets = assets.filter(a => {
    if (!a.lastSeen) return true
    const hrs = (Date.now() - new Date(a.lastSeen).getTime()) / 3600000
    return hrs > 48
  })
  if (staleAssets.length > 0 && assets.length > 0) {
    const pct = ((staleAssets.length / assets.length) * 100).toFixed(0)
    recs.push({
      id: 'asset-blind-spots',
      priority: pct > 30 ? 'warning' : 'info',
      title: `${staleAssets.length} Assets Not Recently Active`,
      description: `${pct}% of monitored assets have not reported activity in the last 48 hours — potential visibility blind spots.`,
      steps: [
        'Review the asset list in the Assets page',
        'Verify agents or sensors are deployed on stale assets',
        'Check if assets have been decommissioned and remove from inventory',
        'Enable automated asset discovery to detect new unmonitored assets',
      ],
      impact: Math.min(85, staleAssets.length * 2),
      category: 'Asset Coverage',
    })
  }

  // All good
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
      impact: 5,
      category: 'General',
    })
  }

  return recs.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
  })
}

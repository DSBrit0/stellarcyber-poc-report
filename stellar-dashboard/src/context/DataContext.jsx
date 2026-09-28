import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import {
  fetchCases,
  fetchEntityUsage,
  fetchConnectors,
  fetchIngestionStats,
  fetchIngestionTimeline,
  fetchIngestionBySensor,
  fetchIngestionByConnector,
  fetchDataSensors,
  fetchDailyVolume,
  fetchCaseTactics,
  fetchCaseStats,
  caseAlertPages,
  emptyTactics,
} from '../services/api'
import { useAuth } from './AuthContext'
import { warn } from '../utils/logger'
import { translate } from '../i18n/messages'

const DataContext = createContext(null)

const EMPTY_DATA = {
  cases:                [],
  lowCount:             0,
  mediumTotal:          0,
  assets:               [],
  connectors:           [],
  ingestionStats:       [],
  ingestionTimeline:    [],
  ingestionBySensor:    [],
  ingestionByConnector: [],
  dataSensors:          [],
  dailyVolume:          [],
  caseTactics:          null,
  caseStats:            null,
}

export function DataProvider({ children }) {
  const { auth, disconnect } = useAuth()

  const [data, setData]             = useState(EMPTY_DATA)
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [syncedAt, setSyncedAt]     = useState(null)
  const [syncConfig, setSyncConfig] = useState({ pocStartDate: '', pocEndDate: '' })
  // Sync progress 0–100: the 10 data fetches + (on Sync) every alert page of the cases.
  const [progress, setProgress]     = useState(null)

  const intervalRef  = useRef(null)
  const syncDatesRef = useRef({ pocStartDate: '', pocEndDate: '' })
  // O intervalo de polling guarda o fetchAll do momento do Sync; lendo o auth por ref,
  // cada ciclo usa o JWT atual (renovado a cada ~9 min) em vez do token do Sync.
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth }, [auth])
  // A Sync with case alerts can take longer than the 5-min polling interval. runRef
  // numbers each run: a polling tick is skipped while a run is in flight (it would
  // otherwise finish first and mark the data "Synced" before the MITRE tactics
  // arrive), and a run superseded by resetData / logout / a new Sync is discarded.
  const runRef  = useRef(0)
  const busyRef = useRef(false)

  // withTactics: busca os alerts dos cases (MITRE/XDR). Só no Sync — é a etapa mais
  // pesada (paginação de alerts); no polling o resultado anterior é mantido.
  const fetchAll = useCallback(async ({ withTactics = false } = {}) => {
    const auth = authRef.current
    if (!auth) return
    if (!withTactics && busyRef.current) return   // polling tick during a Sync
    const run = ++runRef.current
    const current = () => run === runRef.current
    busyRef.current = true
    setLoading(true)
    setProgress(0)
    const newErrors = {}
    const dates = syncDatesRef.current

    // Progress: the total is known once the cases arrive (their alert pages);
    // until then it stays at 0%, and it never goes backwards.
    const FETCHES = 10
    let done = 0, total = null
    const report = () => { if (total && current()) setProgress(Math.min(100, Math.floor((done / total) * 100))) }
    const step   = (n = 1) => { done += n; report() }
    const track  = p => p.finally(() => step())
    const casesP = fetchCases(auth, dates).then(
      v => { total = FETCHES + (withTactics ? caseAlertPages(v?.cases) : 0); report(); return v },
      e => { total = FETCHES; report(); throw e },
    )

    // MITRE + Stellar XDR tactics: each case pages through /cases/{id}/alerts. Starts as
    // soon as the cases arrive, in parallel with the other data fetches.
    const tacticsP = withTactics
      ? casesP.then(
          v => (v?.cases?.length > 0
            ? fetchCaseTactics(auth, v.cases, step).catch(err => {
                warn('DataContext', 'fetchCaseTactics fallback', { error: err.message })
                return emptyTactics()
              })
            : null),
          () => null,
        )
      : Promise.resolve(null)

    const results = await Promise.allSettled([
      track(casesP),                               // 0
      track(fetchEntityUsage(auth, dates)),        // 1
      track(fetchConnectors(auth)),                // 2
      track(fetchIngestionStats(auth)),            // 3
      track(fetchIngestionTimeline(auth)),         // 4
      track(fetchIngestionBySensor(auth, dates)),  // 5
      track(fetchIngestionByConnector(auth, dates)), // 6
      track(fetchDataSensors(auth)),               // 7
      track(fetchDailyVolume(auth, dates)),        // 8
      track(fetchCaseStats(auth, dates)),          // 9
    ])

    // index 0 = fetchCases → returns { cases, lowCount, mediumTotal }
    const keys = ['cases', 'assets', 'connectors', 'ingestionStats', 'ingestionTimeline', 'ingestionBySensor', 'ingestionByConnector', 'dataSensors', 'dailyVolume', 'caseStats']

    const caseTactics = await tacticsP

    if (!current()) return   // superseded (tenant switch, logout or a newer Sync)

    // Enrich ingestionBySensor: /ingestion-stats/sensor returns only UUIDs (entry_identifier).
    // Cross-reference with /data_sensors (sensor_id) to get hostname, type, and version.
    let enrichedIngestionBySensor = null
    const dataSensorsResult = results[7]  // fetchDataSensors → array of sensor metadata
    const sensorIngResult   = results[5]  // fetchIngestionBySensor → array of sensors
    if (
      dataSensorsResult?.status === 'fulfilled' &&
      sensorIngResult?.status === 'fulfilled' &&
      Array.isArray(sensorIngResult.value) &&
      Array.isArray(dataSensorsResult.value)
    ) {
      const sensorMetaMap = {}
      for (const ds of dataSensorsResult.value) {
        if (ds.id) sensorMetaMap[ds.id] = ds
      }
      enrichedIngestionBySensor = sensorIngResult.value.map((s, idx) => {
        const meta = sensorMetaMap[s.id]
        if (meta) {
          return { ...s, name: meta.hostname, type: meta.type, version: meta.version }
        }
        return { ...s, name: `Sensor ${idx + 1}` }
      })
    }

    setData(prev => {
      const next = { ...prev }
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'fulfilled') {
          if (i === 0) {
            next.cases       = result.value.cases
            next.lowCount    = result.value.lowCount
            next.mediumTotal = result.value.mediumTotal
          } else {
            next[keys[i]] = result.value
          }
        } else {
          const err = result.reason
          if (err?.status === 401 || err?.message?.includes('(401)')) {
            disconnect()
            return prev
          }
          newErrors[keys[i]] = err?.message || translate('errors.fetchFailed')
          // keep previous data on error
        }
      }
      if (caseTactics !== null) next.caseTactics = caseTactics
      if (enrichedIngestionBySensor !== null) next.ingestionBySensor = enrichedIngestionBySensor
      return next
    })

    setErrors(newErrors)
    setProgress(100)
    await new Promise(r => setTimeout(r, 500))  // data is already set; lets "100%" show before "Synced"
    if (!current()) return
    setSyncedAt(new Date())
    setLoading(false)
    busyRef.current = false
  }, [disconnect])

  // sync(dates) — manual trigger from UI; updates dates + fetches + restarts 5-min interval
  const sync = useCallback((dates) => {
    const normalized = {
      pocStartDate: dates?.pocStartDate || '',
      pocEndDate:   dates?.pocEndDate   || '',
    }
    syncDatesRef.current = normalized
    setSyncConfig({ ...normalized })
    clearInterval(intervalRef.current)
    fetchAll({ withTactics: true })
    intervalRef.current = setInterval(() => fetchAll(), 5 * 60 * 1000)
  }, [fetchAll])

  // resetData() — descarta os dados carregados e para o polling (ex.: troca de tenant),
  // para que o relatório nunca misture dados de tenants diferentes. Exige novo Sync.
  const resetData = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null
    runRef.current++          // discard any run still in flight
    busyRef.current = false
    setLoading(false)
    syncDatesRef.current = { pocStartDate: '', pocEndDate: '' }
    setSyncedAt(null)
    setSyncConfig({ pocStartDate: '', pocEndDate: '' })
    setData(EMPTY_DATA)
    setErrors({})
    setProgress(null)
  }, [])

  // Reset all state when user disconnects
  useEffect(() => {
    if (!auth) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      runRef.current++
      busyRef.current = false
      setLoading(false)
      setSyncedAt(null)
      setSyncConfig({ pocStartDate: '', pocEndDate: '' })
      syncDatesRef.current = { pocStartDate: '', pocEndDate: '' }
      setData(EMPTY_DATA)
      setErrors({})
    }
  }, [auth])

  // Cleanup interval on unmount
  useEffect(() => () => clearInterval(intervalRef.current), [])

  return (
    <DataContext.Provider value={{
      data,
      loading,
      errors,
      syncedAt,
      syncConfig,
      progress,
      sync,
      resetData,
      // backward compat aliases used by Header and Recommendations
      lastRefresh: syncedAt,
      refresh:     () => fetchAll(),
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

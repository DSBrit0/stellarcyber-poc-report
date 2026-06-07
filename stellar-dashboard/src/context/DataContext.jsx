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
  fetchCaseTactics,
  emptyTactics,
} from '../services/api'
import { useAuth } from './AuthContext'
import { warn } from '../utils/logger'

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
  caseTactics:          null,
}

export function DataProvider({ children }) {
  const { auth, disconnect } = useAuth()

  const [data, setData]             = useState(EMPTY_DATA)
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [syncedAt, setSyncedAt]     = useState(null)
  const [syncConfig, setSyncConfig] = useState({ pocStartDate: '', pocEndDate: '' })

  const intervalRef  = useRef(null)
  const syncDatesRef = useRef({ pocStartDate: '', pocEndDate: '' })

  const fetchAll = useCallback(async () => {
    if (!auth) return
    setLoading(true)
    const newErrors = {}
    const dates = syncDatesRef.current

    const results = await Promise.allSettled([
      fetchCases(auth, dates),              // 0
      fetchEntityUsage(auth, dates),        // 1
      fetchConnectors(auth),                // 2
      fetchIngestionStats(auth),            // 3
      fetchIngestionTimeline(auth),         // 4
      fetchIngestionBySensor(auth, dates),  // 5
      fetchIngestionByConnector(auth, dates), // 6
      fetchDataSensors(auth),               // 7
    ])

    // index 0 = fetchCases → returns { cases, lowCount, mediumTotal }
    const keys = ['cases', 'assets', 'connectors', 'ingestionStats', 'ingestionTimeline', 'ingestionBySensor', 'ingestionByConnector', 'dataSensors']

    // Fetch MITRE + Stellar XDR tactic data for cases in the POC period.
    // Runs after cases are available; each case triggers one /cases/{id}/alerts call.
    let caseTactics = null
    const casesResult = results[0]
    if (casesResult.status === 'fulfilled' && casesResult.value?.cases?.length > 0) {
      try {
        caseTactics = await fetchCaseTactics(auth, casesResult.value.cases)
      } catch (err) {
        warn('DataContext', 'fetchCaseTactics fallback', { error: err.message })
        caseTactics = emptyTactics()
      }
    }

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
          newErrors[keys[i]] = err?.message || 'Falha ao buscar dados'
          // keep previous data on error
        }
      }
      if (caseTactics !== null) next.caseTactics = caseTactics
      if (enrichedIngestionBySensor !== null) next.ingestionBySensor = enrichedIngestionBySensor
      return next
    })

    setErrors(newErrors)
    setSyncedAt(new Date())
    setLoading(false)
  }, [auth, disconnect])

  // sync(dates) — manual trigger from UI; updates dates + fetches + restarts 5-min interval
  const sync = useCallback((dates) => {
    const normalized = {
      pocStartDate: dates?.pocStartDate || '',
      pocEndDate:   dates?.pocEndDate   || '',
    }
    syncDatesRef.current = normalized
    setSyncConfig({ ...normalized })
    clearInterval(intervalRef.current)
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 5 * 60 * 1000)
  }, [fetchAll])

  // Reset all state when user disconnects
  useEffect(() => {
    if (!auth) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
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
      sync,
      // backward compat aliases used by Header and Recommendations
      lastRefresh: syncedAt,
      refresh:     fetchAll,
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

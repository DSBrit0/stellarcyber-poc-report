import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import {
  fetchCases,
  fetchEntityUsage,
  fetchConnectors,
  fetchIngestionStats,
  fetchIngestionTimeline,
  fetchIngestionBySensor,
  fetchIngestionByConnector,
} from '../services/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

const EMPTY_DATA = {
  cases:                [],
  assets:               [],
  connectors:           [],
  ingestionStats:       [],
  ingestionTimeline:    [],
  ingestionBySensor:    [],
  ingestionByConnector: [],
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
      fetchCases(auth, dates),
      fetchEntityUsage(auth, dates),
      fetchConnectors(auth),
      fetchIngestionStats(auth),
      fetchIngestionTimeline(auth),
      fetchIngestionBySensor(auth, dates),
      fetchIngestionByConnector(auth, dates),
    ])

    const keys = ['cases', 'assets', 'connectors', 'ingestionStats', 'ingestionTimeline', 'ingestionBySensor', 'ingestionByConnector']

    setData(prev => {
      const next = { ...prev }
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'fulfilled') {
          next[keys[i]] = result.value
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

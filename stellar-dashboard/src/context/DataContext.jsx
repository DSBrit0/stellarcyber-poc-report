import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { fetchCases, fetchAssets, fetchSensors, fetchIngestionStats, fetchIngestionTimeline } from '../services/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { auth } = useAuth()
  const [data, setData] = useState({
    cases: [],
    assets: [],
    sensors: [],
    ingestionStats: [],
    ingestionTimeline: [],
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!auth) return
    setLoading(true)
    const newErrors = {}

    const results = await Promise.allSettled([
      fetchCases(auth),
      fetchAssets(auth),
      fetchSensors(auth),
      fetchIngestionStats(auth),
      fetchIngestionTimeline(auth),
    ])

    const keys = ['cases', 'assets', 'sensors', 'ingestionStats', 'ingestionTimeline']
    const newData = {}
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        newData[keys[i]] = result.value
      } else {
        newErrors[keys[i]] = result.reason?.message || 'Failed to fetch'
        newData[keys[i]] = data[keys[i]] // keep stale data
      }
    })

    setData(prev => ({ ...prev, ...newData }))
    setErrors(newErrors)
    setLastRefresh(new Date())
    setLoading(false)
  }, [auth])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!auth) return
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(intervalRef.current)
  }, [auth, fetchAll])

  return (
    <DataContext.Provider value={{ data, loading, errors, lastRefresh, refresh: fetchAll }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

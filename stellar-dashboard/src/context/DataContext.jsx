import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import {
  fetchCases,
  fetchEntityUsage,
  fetchConnectors,
  fetchIngestionStats,
  fetchIngestionTimeline,
} from '../services/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { auth, disconnect } = useAuth()

  const [data, setData] = useState({
    cases:             [],
    assets:            [],
    connectors:        [],
    ingestionStats:    [],
    ingestionTimeline: [],
  })
  const [loading, setLoading]         = useState(false)
  const [errors, setErrors]           = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!auth) return
    setLoading(true)
    const newErrors = {}

    const results = await Promise.allSettled([
      fetchCases(auth),
      fetchEntityUsage(auth),
      fetchConnectors(auth),
      fetchIngestionStats(auth),
      fetchIngestionTimeline(auth),
    ])

    const keys = ['cases', 'assets', 'connectors', 'ingestionStats', 'ingestionTimeline']
    const newData = {}

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        newData[keys[i]] = result.value
      } else {
        const err = result.reason
        if (err?.status === 401 || err?.message?.includes('(401)')) {
          disconnect()
          setLoading(false)
          return
        }
        newErrors[keys[i]] = err?.message || 'Falha ao buscar dados'
        newData[keys[i]] = data[keys[i]]
      }
    }

    setData(prev => ({ ...prev, ...newData }))
    setErrors(newErrors)
    setLastRefresh(new Date())
    setLoading(false)
  }, [auth, disconnect]) // eslint-disable-line react-hooks/exhaustive-deps

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

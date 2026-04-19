import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import {
  fetchCases,
  fetchAssets,
  fetchConnectors,
  fetchIngestionStats,
  fetchIngestionTimeline,
} from '../services/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { auth } = useAuth()

  const [data, setData] = useState({
    cases: [],
    tenants: [],      // substituiu "assets" — lista de tenants da instância
    connectors: [],   // substituiu "sensors" — fontes de log / conectores
    ingestionStats: [],
    ingestionTimeline: [],
  })
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!auth) return
    setLoading(true)
    const newErrors = {}

    const results = await Promise.allSettled([
      fetchCases(auth),
      fetchAssets(auth),
      fetchConnectors(auth),
      fetchIngestionStats(auth),
      fetchIngestionTimeline(auth),
    ])

    const keys = ['cases', 'tenants', 'connectors', 'ingestionStats', 'ingestionTimeline']
    const newData = {}

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        newData[keys[i]] = result.value
      } else {
        newErrors[keys[i]] = result.reason?.message || 'Falha ao buscar dados'
        newData[keys[i]] = data[keys[i]]  // mantém dados anteriores em caso de erro
      }
    })

    setData(prev => ({ ...prev, ...newData }))
    setErrors(newErrors)
    setLastRefresh(new Date())
    setLoading(false)
  }, [auth]) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca inicial + auto-refresh a cada 5 minutos
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

import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'poc_meta'
const SETUP_KEY   = 'poc_setup_done'

const DEFAULTS = {
  clientName:   '',
  clientDept:   '',
  seName:       '',
  partnerName:  '',
  seEmail:      '',
  pocStartDate: '',
  pocEndDate:   '',
  version:      '1.0',
  verdict:      '',
}

const PocMetaContext = createContext(null)

export function PocMetaProvider({ children }) {
  const [pocMeta, setPocMetaState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS }
    } catch {
      return { ...DEFAULTS }
    }
  })

  const [setupDone, setSetupDone] = useState(() => {
    return localStorage.getItem(SETUP_KEY) === 'true'
  })

  function setPocMeta(updates) {
    setPocMetaState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function completeSetup(formData) {
    const next = { ...pocMeta, ...formData }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setPocMetaState(next)
    setSetupDone(true)
    localStorage.setItem(SETUP_KEY, 'true')
  }

  function resetSetup() {
    setSetupDone(false)
    localStorage.removeItem(SETUP_KEY)
  }

  return (
    <PocMetaContext.Provider value={{ pocMeta, setPocMeta, setupDone, completeSetup, resetSetup }}>
      {children}
    </PocMetaContext.Provider>
  )
}

export function usePocMeta() {
  const ctx = useContext(PocMetaContext)
  if (!ctx) throw new Error('usePocMeta must be used within PocMetaProvider')
  return ctx
}

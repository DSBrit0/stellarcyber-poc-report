import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'poc_meta'

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
  comments:     '',
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

  function setPocMeta(updates) {
    setPocMetaState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <PocMetaContext.Provider value={{ pocMeta, setPocMeta }}>
      {children}
    </PocMetaContext.Provider>
  )
}

export function usePocMeta() {
  const ctx = useContext(PocMetaContext)
  if (!ctx) throw new Error('usePocMeta must be used within PocMetaProvider')
  return ctx
}

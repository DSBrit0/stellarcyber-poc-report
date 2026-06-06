import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'poc_meta'

const DEFAULTS = {
  clientName:      '',
  clientDept:      '',
  clientEmail:     '',
  analysts:        [],
  successCriteria: '',
  seName:          '',
  seEmail:         '',
  sePhone:         '',
  partnerName:     '',
  partnerEmail:    '',
  partnerSite:     '',
  pocStartDate:    '',
  pocEndDate:      '',
  version:         '1.0',
  verdict:         '',
  comments:        '',
}

const PocMetaContext = createContext(null)

export function PocMetaProvider({ children }) {
  const [pocMeta, setPocMetaState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      // dates are session-only — always start empty to force the user to set the period each session
      const loaded = saved ? JSON.parse(saved) : {}
      const { pocStartDate: _s, pocEndDate: _e, ...persisted } = loaded
      return { ...DEFAULTS, ...persisted }
    } catch {
      return { ...DEFAULTS }
    }
  })

  function setPocMeta(updates) {
    setPocMetaState(prev => {
      const next = { ...prev, ...updates }
      // never persist dates to localStorage
      const { pocStartDate: _s, pocEndDate: _e, ...toStore } = next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
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

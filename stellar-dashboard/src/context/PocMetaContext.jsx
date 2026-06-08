import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const STORAGE_KEY    = 'poc_meta'
const ARCH_IMAGE_KEY = 'poc_arch_image'

const DEFAULTS = {
  clientName:           '',
  clientDept:           '',
  clientEmail:          '',
  analysts:             [],
  successCriteria:      '',
  seName:               '',
  seEmail:              '',
  sePhone:              '',
  partnerName:          '',
  partnerEmail:         '',
  partnerSite:          '',
  pocStartDate:         '',
  pocEndDate:           '',
  platformVersion:      '',
  region:               '',
  version:              '1.0',
  verdict:              '',
  comments:             '',
  architectureImageDims: null,
}

const PocMetaContext = createContext(null)

export function PocMetaProvider({ children }) {
  const { auth } = useAuth()

  const [pocMeta, setPocMetaState] = useState(() => ({ ...DEFAULTS, architectureImage: '' }))

  // On login: load from localStorage. On logout (auth → null): clear storage and reset to DEFAULTS.
  useEffect(() => {
    if (auth) {
      try {
        const saved   = localStorage.getItem(STORAGE_KEY)
        const archImg = localStorage.getItem(ARCH_IMAGE_KEY) || ''
        const loaded  = saved ? JSON.parse(saved) : {}
        const { pocStartDate: _s, pocEndDate: _e, ...persisted } = loaded
        setPocMetaState({ ...DEFAULTS, ...persisted, architectureImage: archImg })
      } catch {
        setPocMetaState({ ...DEFAULTS, architectureImage: '' })
      }
    } else {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(ARCH_IMAGE_KEY)
      setPocMetaState({ ...DEFAULTS, architectureImage: '' })
    }
  }, [!!auth])

  function setPocMeta(updates) {
    setPocMetaState(prev => {
      const next = { ...prev, ...updates }
      // never persist dates or image blob to the main JSON
      const { pocStartDate: _s, pocEndDate: _e, architectureImage: _img, ...toStore } = next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
      // image data URL goes to its own key to avoid hitting the JSON size limit
      if ('architectureImage' in updates) {
        if (updates.architectureImage) {
          try { localStorage.setItem(ARCH_IMAGE_KEY, updates.architectureImage) } catch {}
        } else {
          localStorage.removeItem(ARCH_IMAGE_KEY)
        }
      }
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

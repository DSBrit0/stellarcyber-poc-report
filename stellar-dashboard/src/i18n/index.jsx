import { createContext, useContext, useState, useCallback } from 'react'
import pt from './locales/pt'
import en from './locales/en'
import es from './locales/es'

const LOCALES = { pt, en, es }

const STORAGE_KEY = 'stellar_locale'

const LocaleContext = createContext(null)

export const LOCALE_OPTIONS = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
]

export function LocaleProvider({ children }) {
  const [locale, _setLocale] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LOCALES[saved] ? saved : 'pt'
  })

  const setLocale = useCallback((code) => {
    if (!LOCALES[code]) return
    localStorage.setItem(STORAGE_KEY, code)
    _setLocale(code)
  }, [])

  const t = useCallback((key, vars = {}) => {
    const messages = LOCALES[locale] || pt
    const value = key.split('.').reduce((obj, k) => obj?.[k], messages) ?? key
    if (typeof value !== 'string') return key
    return value.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? vars[k] : `{${k}}`
    )
  }, [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

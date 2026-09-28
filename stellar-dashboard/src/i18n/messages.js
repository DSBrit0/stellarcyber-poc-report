// Translation for non-React modules (logger, recommendations). Uses the same locale
// files and the same stored locale as useLocale() — see i18n/index.jsx.
import pt from './locales/pt'
import en from './locales/en'
import es from './locales/es'

const LOCALES     = { pt, en, es }
const STORAGE_KEY = 'stellar_locale'

export function currentLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LOCALES[saved] ? saved : 'pt'
  } catch {
    return 'pt'
  }
}

const lookup = (messages, key) => key.split('.').reduce((obj, k) => obj?.[k], messages)
const fill   = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`))

// translate('errors.http404', { url }) → string in the current (or given) locale.
// Arrays (e.g. recommendation steps) are returned with each item filled in.
export function translate(key, vars = {}, locale = currentLocale()) {
  const value = lookup(LOCALES[locale] || pt, key) ?? lookup(pt, key)
  if (Array.isArray(value)) return value.map(v => fill(String(v), vars))
  return typeof value === 'string' ? fill(value, vars) : key
}

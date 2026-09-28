// PoC verdict stored as a language-independent code; the label is resolved in the
// language of the screen or of the PDF being generated.
import pt from '../i18n/locales/pt'
import en from '../i18n/locales/en'
import es from '../i18n/locales/es'

const LOCALES = { pt, en, es }

export const VERDICTS = ['approved', 'conditional', 'rejected']

const LABEL_KEY = {
  approved:    'verdictApproved',
  conditional: 'verdictCond',
  rejected:    'verdictRejected',
}

// Code for a stored value. Older values were saved as the translated label (in any
// of the three languages), so those are matched back to their code.
export function verdictCode(value) {
  if (!value) return ''
  if (VERDICTS.includes(value)) return value
  const v = String(value).trim().toLowerCase()
  for (const code of VERDICTS) {
    if (Object.values(LOCALES).some(l => l.report?.[LABEL_KEY[code]]?.toLowerCase() === v)) return code
  }
  return ''
}

// i18n key of the label (for t() on screen).
export function verdictLabelKey(code) {
  return LABEL_KEY[code] ? `report.${LABEL_KEY[code]}` : ''
}

// Label in a given locale (for the PDF).
export function verdictLabel(code, locale) {
  return LABEL_KEY[code] ? ((LOCALES[locale] || pt).report?.[LABEL_KEY[code]] || '') : ''
}

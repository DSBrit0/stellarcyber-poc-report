import { useState } from 'react'
import { Shield, Calendar, ChevronRight, AlertTriangle } from 'lucide-react'
import { usePocMeta } from '../context/PocMetaContext'
import { useLocale } from '../i18n'

const INPUT = {
  background:   'rgba(255,255,255,0.06)',
  border:       '1px solid rgba(0,212,255,0.2)',
  color:        '#e2e8f0',
  borderRadius: '8px',
  padding:      '9px 12px',
  fontSize:     '13px',
  width:        '100%',
  outline:      'none',
  boxSizing:    'border-box',
}

const INPUT_ERROR = {
  ...INPUT,
  border: '1px solid rgba(239,68,68,0.5)',
}

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function PocSetupModal() {
  const { pocMeta, completeSetup } = usePocMeta()
  const { t } = useLocale()

  const [form, setForm] = useState({
    clientName:   pocMeta.clientName   || '',
    clientDept:   pocMeta.clientDept   || '',
    seName:       pocMeta.seName       || '',
    partnerName:  pocMeta.partnerName  || '',
    seEmail:      pocMeta.seEmail      || '',
    pocStartDate: pocMeta.pocStartDate || '',
    pocEndDate:   pocMeta.pocEndDate   || '',
    version:      pocMeta.version      || '1.0',
    verdict:      pocMeta.verdict      || '',
  })

  const [errors, setErrors] = useState({})

  function set(key) {
    return e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  function validate() {
    const errs = {}
    if (!form.pocStartDate) errs.pocStartDate = t('pocSetup.errorRequired')
    if (!form.pocEndDate)   errs.pocEndDate   = t('pocSetup.errorRequired')

    if (form.pocStartDate && form.pocEndDate) {
      const start = new Date(form.pocStartDate).getTime()
      const end   = new Date(form.pocEndDate).getTime()
      if (end < start) {
        errs.pocEndDate = t('pocSetup.errorEndBeforeStart')
      } else if ((end - start) > 30 * 86400000) {
        errs.pocEndDate = t('pocSetup.errorMax30Days')
      }
    }

    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    completeSetup(form)
  }

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(0,0,0,0.75)',
        backdropFilter:  'blur(6px)',
        padding:         '16px',
      }}
    >
      <div
        style={{
          background:   'linear-gradient(160deg, #0d1526 0%, #0a0e1a 100%)',
          border:       '1px solid rgba(0,212,255,0.2)',
          borderRadius: '16px',
          width:        '100%',
          maxWidth:     '560px',
          maxHeight:    '90vh',
          overflowY:    'auto',
          boxShadow:    '0 0 60px rgba(0,212,255,0.12), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '10px',
              background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={16} style={{ color: '#00d4ff' }} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              {t('pocSetup.title')}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {t('pocSetup.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Period section — required */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Calendar size={13} style={{ color: '#00d4ff' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t('pocSetup.periodSection')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label={t('pocSetup.startDate')} required>
                <input
                  type="date"
                  style={errors.pocStartDate ? INPUT_ERROR : INPUT}
                  value={form.pocStartDate}
                  onChange={set('pocStartDate')}
                />
                {errors.pocStartDate && (
                  <span style={{ fontSize: '11px', color: '#ef4444' }}>{errors.pocStartDate}</span>
                )}
              </Field>

              <Field label={t('pocSetup.endDate')} required>
                <input
                  type="date"
                  style={errors.pocEndDate ? INPUT_ERROR : INPUT}
                  value={form.pocEndDate}
                  onChange={set('pocEndDate')}
                />
                {errors.pocEndDate && (
                  <span style={{ fontSize: '11px', color: '#ef4444' }}>{errors.pocEndDate}</span>
                )}
              </Field>
            </div>

            <div style={{
              marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: '7px',
            }}>
              <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: '11px', color: '#d97706', lineHeight: '1.5' }}>
                {t('pocSetup.periodNote')}
              </span>
            </div>
          </div>

          {/* Client info section — optional */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '14px' }}>
              {t('pocSetup.clientSection')}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label={t('pocSetup.clientName')}>
                  <input style={INPUT} placeholder={t('pocSetup.clientPlaceholder')} value={form.clientName} onChange={set('clientName')} />
                </Field>
                <Field label={t('pocSetup.clientDept')}>
                  <input style={INPUT} placeholder={t('pocSetup.deptPlaceholder')} value={form.clientDept} onChange={set('clientDept')} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label={t('pocSetup.seName')}>
                  <input style={INPUT} placeholder={t('pocSetup.sePlaceholder')} value={form.seName} onChange={set('seName')} />
                </Field>
                <Field label={t('pocSetup.partnerName')}>
                  <input style={INPUT} placeholder={t('pocSetup.partnerPlaceholder')} value={form.partnerName} onChange={set('partnerName')} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <Field label={t('pocSetup.seEmail')}>
                  <input style={INPUT} type="email" placeholder="se@stellarcyber.ai" value={form.seEmail} onChange={set('seEmail')} />
                </Field>
                <Field label={t('pocSetup.version')}>
                  <input style={INPUT} placeholder="1.0" value={form.version} onChange={set('version')} />
                </Field>
                <Field label={t('pocSetup.verdict')}>
                  <select style={{ ...INPUT, cursor: 'pointer' }} value={form.verdict} onChange={set('verdict')}>
                    <option value="">{t('pocSetup.verdictEmpty')}</option>
                    <option value="Aprovado">{t('pocSetup.verdictApproved')}</option>
                    <option value="Aprovado com Ressalvas">{t('pocSetup.verdictCond')}</option>
                    <option value="Não Aprovado">{t('pocSetup.verdictRejected')}</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '8px',
              padding:        '12px 24px',
              borderRadius:   '10px',
              fontSize:       '14px',
              fontWeight:     700,
              color:          'white',
              background:     'linear-gradient(135deg, #0066ff, #00d4ff)',
              border:         'none',
              cursor:         'pointer',
              boxShadow:      '0 0 20px rgba(0,212,255,0.25)',
              width:          '100%',
            }}
          >
            {t('pocSetup.submit')}
            <ChevronRight size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}

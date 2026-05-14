import { useState } from 'react'
import {
  FileText, Download, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Shield, Layers, Radio, Lightbulb, Loader,
  Clock, Settings2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { usePocMeta } from '../context/PocMetaContext'
import { useLocale, getPdfStrings } from '../i18n'
import { generateRecommendations } from '../utils/recommendations'
import { downloadPDFReport } from '../services/pdfReport'
import { formatRelative } from '../utils/formatters'

const INPUT = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,212,255,0.18)',
  color: '#e2e8f0',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, children, onHelp }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</label>
        {onHelp && (
          <button
            type="button"
            onClick={onHelp}
            style={{
              width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff', fontSize: '9px', fontWeight: 700, lineHeight: 1,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            ?
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Report() {
  const { auth }                                              = useAuth()
  const { data, loading, errors, lastRefresh, refresh }      = useData()
  const { t, locale }                                         = useLocale()
  const { pocMeta, setPocMeta }                               = usePocMeta()
  const [generating, setGenerating]                          = useState(false)
  const [downloaded, setDownloaded]                          = useState(false)
  const [showVerdictGuide, setShowVerdictGuide]              = useState(false)

  function setField(key) {
    return e => setPocMeta({ [key]: e.target.value })
  }

  const { cases, assets, connectors, ingestionTimeline, ingestionBySensor, ingestionByConnector } = data


  const recommendations = generateRecommendations({ cases, connectors, ingestionTimeline })

  const critCases    = cases.filter(c => c.severity?.toLowerCase() === 'critical').length
  const openCases    = cases.filter(c => !['closed', 'resolved'].includes((c.status || '').toLowerCase())).length
  const activeConn   = connectors.filter(c => c.active).length
  const critRecs     = recommendations.filter(r => r.priority === 'critical').length
  const mitreRecs    = recommendations.filter(r => r.category === 'MITRE ATT&CK').length
  const avgEntities  = assets.length > 0
    ? Math.round(assets.reduce((s, d) => s + (d.entity_count || 0), 0) / assets.length)
    : 0

  const hasErrors = Object.keys(errors).length > 0
  const apiOk     = !hasErrors && cases.length + connectors.length > 0

  async function handleDownload() {
    setGenerating(true)
    setDownloaded(false)
    try {
      downloadPDFReport({
        auth,
        cases,
        connectors,
        assets,
        recommendations,
        ingestionBySensor,
        ingestionByConnector,
        generatedAt: new Date(),
        pocMeta,
        locale,
        s: getPdfStrings(locale),
      })
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 4000)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wide flex items-center gap-3" style={{ color: '#f1f5f9' }}>
            <FileText size={24} style={{ color: '#00d4ff' }} />
            {t('report.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {t('report.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('report.sync')}
          </button>

          <button
            onClick={handleDownload}
            disabled={generating || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: generating || loading ? 'rgba(0,102,255,0.4)' : 'linear-gradient(135deg, #0066ff, #00d4ff)',
              color: 'white',
              boxShadow: generating || loading ? 'none' : '0 0 20px rgba(0,212,255,0.3)',
            }}
          >
            {generating ? (
              <><Loader size={14} className="animate-spin" />{t('report.generating')}</>
            ) : downloaded ? (
              <><CheckCircle2 size={14} />{t('report.downloaded')}</>
            ) : (
              <><Download size={14} />{t('report.download')}</>
            )}
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-3">
        <StatusPill ok={apiOk} okLabel={t('report.apiOk')} errLabel={t('report.apiError')} loading={loading} />
        {lastRefresh && (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <Clock size={12} />
            {t('report.lastSync')} {formatRelative(lastRefresh.toISOString())}
          </div>
        )}
      </div>

      {/* API error banner */}
      {hasErrors && (
        <div className="rounded-lg p-4 text-sm space-y-1"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle size={14} />{t('report.dataError')}
          </div>
          {Object.entries(errors).map(([key, msg]) => (
            <div key={key} className="text-xs ml-5">
              <span style={{ color: '#94a3b8' }}>{key}:</span> {msg}
            </div>
          ))}
        </div>
      )}

      {/* Data summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard icon={Shield}    color="#ff4444" label={t('report.cases')}           value={cases.length}           sub={`${openCases} · ${critCases} ${t('report.critical')}`}              loading={loading} error={!!errors.cases} />
        <SummaryCard icon={Layers}    color="#00d4ff" label={t('report.assets')}           value={avgEntities}            sub={t('report.assetsMonitored')}                                        loading={loading} error={!!errors.assets} />
        <SummaryCard icon={Radio}     color="#22c55e" label={t('report.sensors')}          value={connectors.length}      sub={`${activeConn} ${t('report.active')}`}                             loading={loading} error={!!errors.connectors} />
        <SummaryCard icon={Lightbulb} color="#f59e0b" label={t('report.recommendations')} value={recommendations.length} sub={`${critRecs} ${t('report.critical')} · ${mitreRecs} ${t('report.mitre')}`} loading={loading} error={false} />
      </div>

      {/* PoC metadata form */}
      <div className="rounded-xl" style={{ background: 'rgba(15,22,40,0.7)', border: '1px solid rgba(0,212,255,0.12)' }}>
        <div className="flex items-center gap-2 px-5 py-4 text-sm font-semibold" style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Settings2 size={15} style={{ color: '#00d4ff' }} />
          {t('report.formTitle')}
        </div>

        <div className="px-5 pb-5 pt-4 space-y-4">

            {/* Row 1 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('report.clientName')}>
                <input style={INPUT} placeholder={t('report.clientPlaceholder')} value={pocMeta.clientName} onChange={setField('clientName')} />
              </Field>
              <Field label={t('report.clientDept')}>
                <input style={INPUT} placeholder={t('report.deptPlaceholder')} value={pocMeta.clientDept} onChange={setField('clientDept')} />
              </Field>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('report.seName')}>
                <input style={INPUT} placeholder={t('report.sePlaceholder')} value={pocMeta.seName} onChange={setField('seName')} />
              </Field>
              <Field label={t('report.partnerName')}>
                <input style={INPUT} placeholder={t('report.partnerPlaceholder')} value={pocMeta.partnerName} onChange={setField('partnerName')} />
              </Field>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t('report.seEmail')}>
                <input style={INPUT} type="email" placeholder={t('report.emailPlaceholder')} value={pocMeta.seEmail} onChange={setField('seEmail')} />
              </Field>
              <Field label={t('report.pocStart')}>
                <input style={INPUT} type="date" value={pocMeta.pocStartDate} onChange={setField('pocStartDate')} />
              </Field>
              <Field label={t('report.pocEnd')}>
                <input style={INPUT} type="date" value={pocMeta.pocEndDate} onChange={setField('pocEndDate')} />
              </Field>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('report.version')}>
                <input style={INPUT} placeholder="1.0" value={pocMeta.version} onChange={setField('version')} />
              </Field>
              <Field label={t('report.verdict')} onHelp={() => setShowVerdictGuide(true)}>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={pocMeta.verdict} onChange={setField('verdict')}>
                  <option value="">— selecione —</option>
                  <option value={t('report.verdictApproved')}>{t('report.verdictApproved')}</option>
                  <option value={t('report.verdictCond')}>{t('report.verdictCond')}</option>
                  <option value={t('report.verdictRejected')}>{t('report.verdictRejected')}</option>
                </select>
              </Field>
            </div>

            {/* Comments */}
            <Field label={t('report.comments')}>
              <div style={{ position: 'relative' }}>
                <textarea
                  style={{ ...INPUT, resize: 'vertical', minHeight: '96px', lineHeight: '1.5' }}
                  placeholder={t('report.commentsPlaceholder')}
                  maxLength={1500}
                  value={pocMeta.comments}
                  onChange={setField('comments')}
                />
                <span style={{
                  position: 'absolute', bottom: '8px', right: '10px',
                  fontSize: '10px', color: (pocMeta.comments?.length ?? 0) >= 1400 ? '#f59e0b' : '#475569',
                  pointerEvents: 'none',
                }}>
                  {t('report.commentsChars', { n: pocMeta.comments?.length ?? 0 })}
                </span>
              </div>
            </Field>
          </div>
      </div>

      {showVerdictGuide && <VerdictGuideModal onClose={() => setShowVerdictGuide(false)} />}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ ok, okLabel, errLabel, loading }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
      <Loader size={11} className="animate-spin" />Carregando…
    </div>
  )
  return (
    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
      style={{
        background: ok ? 'rgba(34,197,94,0.08)'  : 'rgba(239,68,68,0.08)',
        border:     ok ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
        color:      ok ? '#4ade80' : '#fca5a5',
      }}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {ok ? okLabel : errLabel}
    </div>
  )
}

function SummaryCard({ icon: Icon, color, label, value, sub, loading, error }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'rgba(15,22,40,0.7)', border: `1px solid ${error ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color }} />
        <span className="text-xs font-medium" style={{ color: '#64748b' }}>{label}</span>
        {error && <XCircle size={11} style={{ color: '#ef4444', marginLeft: 'auto' }} />}
      </div>
      {loading ? (
        <div className="h-7 rounded skeleton" style={{ width: '60%' }} />
      ) : (
        <div className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>{value}</div>
      )}
      <div className="text-xs" style={{ color: '#64748b' }}>{sub}</div>
    </div>
  )
}

// ─── VerdictGuideModal ────────────────────────────────────────────────────────

function VerdictGuideModal({ onClose }) {
  const { t } = useLocale()

  const verdicts = [
    { key: 'approved', color: '#22c55e', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)'   },
    { key: 'cond',     color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'  },
    { key: 'rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)'   },
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0d1526 0%, #0a0e1a 100%)',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '16px',
          width: '100%', maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 0 60px rgba(0,212,255,0.1), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            {t('report.verdictGuide.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', color: '#64748b', fontSize: '16px', lineHeight: 1,
              padding: '3px 8px', cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {verdicts.map(v => (
            <div key={v.key} style={{
              background: v.bg, border: `1px solid ${v.border}`,
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: v.color, marginBottom: '10px' }}>
                {t(`report.verdictGuide.${v.key}.title`)}
              </div>

              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {t('report.verdictGuide.meaningLabel')}
                </span>
                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.65', margin: '4px 0 0' }}>
                  {t(`report.verdictGuide.${v.key}.meaning`)}
                </p>
              </div>

              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.65', margin: '0 0 8px' }}>
                {t(`report.verdictGuide.${v.key}.detail`)}
              </p>

              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {t('report.verdictGuide.alignLabel')}
                </span>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.65', margin: '4px 0 0', fontStyle: 'italic' }}>
                  {t(`report.verdictGuide.${v.key}.alignment`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

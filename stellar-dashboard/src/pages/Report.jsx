import { useState } from 'react'
import {
  FileText, Download, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Shield, Layers, Radio, Lightbulb, Loader,
  Activity, Clock, Settings2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
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

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  )
}

export default function Report() {
  const { auth }                                              = useAuth()
  const { data, loading, errors, lastRefresh, refresh }      = useData()
  const { t, locale }                                         = useLocale()
  const [generating, setGenerating]                          = useState(false)
  const [downloaded, setDownloaded]                          = useState(false)
  const [formOpen, setFormOpen]                              = useState(true)

  const [pocMeta, setPocMeta] = useState({
    clientName:   '',
    clientDept:   '',
    seName:       '',
    partnerName:  '',
    seEmail:      '',
    pocStartDate: '',
    pocEndDate:   '',
    version:      '1.0',
    verdict:      '',
  })

  function setField(key) {
    return e => setPocMeta(prev => ({ ...prev, [key]: e.target.value }))
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
        <button
          onClick={() => setFormOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold"
          style={{ color: '#94a3b8' }}
        >
          <span className="flex items-center gap-2">
            <Settings2 size={15} style={{ color: '#00d4ff' }} />
            {t('report.formTitle')}
          </span>
          <span style={{ color: '#00d4ff', fontSize: '11px' }}>{formOpen ? t('report.collapse') : t('report.expand')}</span>
        </button>

        {formOpen && (
          <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs pt-3" style={{ color: '#64748b' }}>
              Estes dados aparecem na capa, cabeçalho e rodapé do PDF.
            </p>

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
              <Field label={t('report.verdict')}>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={pocMeta.verdict} onChange={setField('verdict')}>
                  <option value="">{t('report.verdictApproved')}</option>
                  <option value={t('report.verdictApproved')}>{t('report.verdictApproved')}</option>
                  <option value={t('report.verdictCond')}>{t('report.verdictCond')}</option>
                  <option value={t('report.verdictRejected')}>{t('report.verdictRejected')}</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* PDF contents preview */}
      <div className="rounded-xl p-5" style={{ background: 'rgba(15,22,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#94a3b8' }}>
          <Activity size={14} />
          {t('report.pdfContents')}
        </h2>
        <div className="space-y-2">
          {[
            { label: 'Capa',                              desc: `Cliente: ${pocMeta.clientName || '—'} · SE: ${pocMeta.seName || '—'} · Veredicto: ${pocMeta.verdict}` },
            { label: '1. Sumário Executivo',              desc: `Indicadores-chave do PoC · período · fontes · veredicto` },
            { label: '2. Escopo e Metodologia',           desc: 'Ambiente avaliado, metodologia em 5 fases, critérios de sucesso' },
            { label: '3. Visão Técnica da Plataforma',    desc: `Arquitetura, implantação (${auth?.url || '—'}), ${connectors.length} integrações` },
            { label: `4. Detecção e Resposta (${cases.length} cases)`, desc: `Ordenados por severidade · ${critCases} críticos · métricas` },
            { label: '5. Cobertura MITRE ATT&CK',         desc: `14 táticas · ${mitreRecs} correlações detectadas` },
            { label: '6. Avaliação Operacional',          desc: 'SOC, fluxo IR, automação e playbooks' },
            { label: '7. ROI e Consolidação',             desc: 'TCO comparativo 3 anos, benefícios qualitativos' },
            { label: `8. Riscos e Recomendações (${recommendations.length})`, desc: `Gaps operacionais + ${mitreRecs} MITRE ATT&CK` },
            { label: '9. Próximos Passos',                desc: 'Plano de ação com 7 etapas e prazos' },
            { label: '10. Conclusão',                     desc: 'Scorecard final, veredicto, assinaturas' },
            { label: 'Apêndices',                         desc: 'Glossário (12 termos) · Controle de versões' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 text-sm">
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
              <div>
                <span className="font-medium" style={{ color: '#e2e8f0' }}>{item.label}</span>
                <span className="ml-2 text-xs" style={{ color: '#64748b' }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MITRE overview */}
      {mitreRecs > 0 && (
        <div className="rounded-xl p-5"
          style={{ background: 'rgba(10,30,70,0.5)', border: '1px solid rgba(0,102,255,0.2)' }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#93c5fd' }}>
            <Shield size={14} />
            {t('report.mitreDetections')}
          </h2>
          <div className="grid gap-2">
            {recommendations
              .filter(r => r.category === 'MITRE ATT&CK')
              .map(r => (
                <div key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold mr-2" style={{ color: '#60a5fa' }}>
                      {r.mitre?.technique?.id}
                    </span>
                    <span style={{ color: '#e2e8f0' }}>{r.mitre?.technique?.name}</span>
                    <span className="ml-2 text-xs" style={{ color: '#64748b' }}>· {r.mitre?.tactic?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: r.priority === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                        color:      r.priority === 'critical' ? '#fca5a5' : '#fdba74',
                        border:     r.priority === 'critical' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(249,115,22,0.3)',
                      }}>
                      {t('report.casesN', { n: r.mitre?.affectedCases ?? 0 })}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
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

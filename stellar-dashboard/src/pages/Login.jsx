import { useState } from 'react'
import {
  ShieldCheck, Eye, EyeOff, Loader, AlertCircle,
  Globe, User, Lock, Hash, HelpCircle, X, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale, LOCALE_OPTIONS } from '../i18n'

export default function Login() {
  const { connect, connecting, authError } = useAuth()
  const { t, locale, setLocale } = useLocale()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0a0e1a' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,102,255,0.09) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
        }} />
      </div>

      {/* Language picker — top right */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        {LOCALE_OPTIONS.map(opt => (
          <button
            key={opt.code}
            onClick={() => setLocale(opt.code)}
            title={opt.label}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: locale === opt.code ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${locale === opt.code ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: locale === opt.code ? '#00d4ff' : '#475569',
            }}
          >
            {opt.flag} {opt.code.toUpperCase()}
          </button>
        ))}
      </div>

      <div
        className="w-full max-w-md relative z-10 animate-fade-in"
        style={{
          background: 'rgba(15,22,40,0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          boxShadow: '0 0 60px rgba(0,102,255,0.15), 0 24px 48px rgba(0,0,0,0.5)',
          padding: '2.5rem',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
              boxShadow: '0 0 32px rgba(0,212,255,0.35)',
            }}
          >
            <ShieldCheck size={32} color="white" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#f1f5f9' }}>
            Stellar Cyber POC Report
          </h1>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            {t('login.subtitle')}
          </p>
        </div>

        <CredentialsForm
          onSubmit={connect}
          connecting={connecting}
          authError={authError}
        />
      </div>

      <p className="mt-5 text-xs relative z-10" style={{ color: '#1e293b' }}>
        {t('login.securityNote')}
      </p>
    </div>
  )
}

// ─── Credentials Step ────────────────────────────────────────────────────────

function CredentialsForm({ onSubmit, connecting, authError }) {
  const { t } = useLocale()
  const [form, setForm]         = useState({ url: '', username: '', password: '', tenantId: '' })
  const [showPass, setShowPass] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  function set(k) {
    return e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await onSubmit({ url: form.url, username: form.username, password: form.password, tenant: form.tenantId.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <IconField
        icon={Globe}
        label={t('login.urlLabel')}
        type="url"
        placeholder={t('login.urlPlaceholder')}
        value={form.url}
        onChange={set('url')}
        required
      />

      <IconField
        icon={User}
        label={t('login.userLabel')}
        type="text"
        placeholder={t('login.userPlaceholder')}
        value={form.username}
        onChange={set('username')}
        required
        autoComplete="username"
      />

      {/* Password field */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
          {t('login.passwordLabel')}
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
            <Lock size={14} />
          </div>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
            required
            autoComplete="current-password"
            className="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none transition-all font-mono"
            style={fieldStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: '#475569' }}
            tabIndex={-1}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Tenant ID field */}
      <IconField
        icon={Hash}
        label={t('login.tenantLabel')}
        type="text"
        placeholder={t('login.tenantPlaceholder')}
        value={form.tenantId}
        onChange={set('tenantId')}
        required
      />

      <ErrorBanner message={authError} />

      <SubmitButton connecting={connecting} />

      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'rgba(0,102,255,0.06)',
          border: '1px solid rgba(0,102,255,0.15)',
          color: '#60a5fa',
        }}
      >
        <HelpCircle size={13} />
        {t('login.apiGuideBtn')}
      </button>

      {showGuide && <ApiGuideModal onClose={() => setShowGuide(false)} />}
    </form>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div
      className="flex items-start gap-2 rounded-lg p-3 text-xs animate-fade-in"
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        color: '#fca5a5',
      }}
    >
      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

function SubmitButton({ connecting }) {
  const { t } = useLocale()
  return (
    <button
      type="submit"
      disabled={connecting}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: connecting
          ? 'rgba(0,102,255,0.45)'
          : 'linear-gradient(135deg, #0066ff, #00d4ff)',
        color: 'white',
        boxShadow: connecting ? 'none' : '0 0 24px rgba(0,212,255,0.3)',
      }}
    >
      {connecting ? (
        <><Loader size={16} className="animate-spin" />{t('login.submitting')}</>
      ) : t('login.submit')}
    </button>
  )
}

function ApiGuideModal({ onClose }) {
  const { t } = useLocale()
  const g = key => t(`login.apiGuide.${key}`)

  const steps = [
    {
      label: g('step1'),
      sub: [g('step1_1'), g('step1_2')],
    },
    {
      label: g('step2'),
      sub: [g('step2_1'), g('step2_2'), g('step2_3'), g('step2_4')],
    },
    {
      label: g('step3'),
      sub: [g('step3_1'), g('step3_2')],
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden animate-fade-in"
        style={{
          background: 'rgba(12,18,35,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 0 60px rgba(0,102,255,0.2), 0 24px 48px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <HelpCircle size={16} style={{ color: '#00d4ff' }} />
            <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>
              {g('title')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: '#475569' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-5">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{
                  background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
                  color: 'white',
                }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>
                  {step.label}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {step.sub.map((s, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs" style={{ color: '#94a3b8' }}>
                      <span
                        className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                        style={{ background: '#00d4ff' }}
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* Warning */}
          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3 text-xs"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#fcd34d',
            }}
          >
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{g('warning')}</span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
              color: 'white',
              boxShadow: '0 0 16px rgba(0,212,255,0.25)',
            }}
          >
            {g('close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function IconField({ icon: Icon, label, value, onChange, type, placeholder, required, autoComplete }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
          <Icon size={14} />
        </div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none transition-all"
          style={fieldStyle}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const fieldStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: '#e2e8f0',
}

function focusStyle(e) {
  e.target.style.border     = '1px solid rgba(0,212,255,0.45)'
  e.target.style.boxShadow  = '0 0 0 3px rgba(0,212,255,0.07)'
  e.target.style.background = 'rgba(255,255,255,0.06)'
}

function blurStyle(e) {
  e.target.style.border     = '1px solid rgba(255,255,255,0.09)'
  e.target.style.boxShadow  = ''
  e.target.style.background = 'rgba(255,255,255,0.04)'
}

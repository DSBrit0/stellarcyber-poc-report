import { useState, useRef, useEffect } from 'react'
import {
  ShieldCheck, Eye, EyeOff, Loader, AlertCircle,
  Zap, Globe, User, Lock, KeyRound, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { connect, verifyMFA, resetAuthStep, connecting, authError, authStep } = useAuth()

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
            Stellar Dashboard
          </h1>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            {authStep === 'otp'
              ? 'Digite o código de autenticação'
              : 'Conecte-se à sua instância Stellar Cyber'}
          </p>
        </div>

        {authStep === 'otp'
          ? <OTPForm
              onSubmit={verifyMFA}
              onBack={resetAuthStep}
              connecting={connecting}
              authError={authError}
            />
          : <CredentialsForm
              onSubmit={connect}
              connecting={connecting}
              authError={authError}
            />
        }
      </div>

      <p className="mt-5 text-xs relative z-10" style={{ color: '#1e293b' }}>
        Credenciais ficam apenas em memória de sessão e nunca são gravadas em disco.
      </p>
    </div>
  )
}

// ─── Credentials Step ────────────────────────────────────────────────────────

function CredentialsForm({ onSubmit, connecting, authError }) {
  const [form, setForm]         = useState({ url: '', username: '', password: '' })
  const [showPass, setShowPass] = useState(false)

  function set(k) {
    return e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await onSubmit(form)
    // Navigation is handled automatically by LoginRoute when auth is set
  }

  async function handleDemo() {
    await onSubmit({
      url:      'https://demo.stellarcyber.ai',
      username: 'demo',
      password: 'demo',
      jwtToken: 'DEMO_MODE_TOKEN',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <IconField
        icon={Globe}
        label="URL da Instância"
        type="url"
        placeholder="https://poc.stellarcyber.cloud"
        value={form.url}
        onChange={set('url')}
        required
      />
      <IconField
        icon={User}
        label="Usuário"
        type="text"
        placeholder="usuario@empresa.com"
        value={form.username}
        onChange={set('username')}
        required
        autoComplete="username"
      />

      {/* Password field */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
          Senha / API Key
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

      <ErrorBanner message={authError} />

      <SubmitButton connecting={connecting} label="Conectar" />

      <Divider />

      <button
        type="button"
        onClick={handleDemo}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-60"
        style={{
          background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.25)',
          color: '#a78bfa',
        }}
      >
        <Zap size={14} />
        Explorar em modo demo
      </button>

      <AuthFlowInfo />
    </form>
  )
}

// ─── OTP Step ────────────────────────────────────────────────────────────────

function OTPForm({ onSubmit, onBack, connecting, authError }) {
  const [code, setCode] = useState('')
  const inputRef        = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await onSubmit(code)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(0,102,255,0.2)', color: '#94a3b8' }}>1</div>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #0066ff, #00d4ff)', color: 'white' }}>2</div>
        <span className="text-xs ml-1" style={{ color: '#64748b' }}>Verificação</span>
      </div>

      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: '#94a3b8' }}
      >
        <KeyRound size={13} className="inline-block mr-1.5 mb-0.5" style={{ color: '#00d4ff' }} />
        Digite o código do seu autenticador (TOTP) ou o código de verificação enviado pela instância.
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
          Código de Autenticação
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }}>
            <KeyRound size={14} />
          </div>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            placeholder="000 000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^0-9 ]/g, ''))}
            maxLength={7}
            required
            autoComplete="one-time-code"
            className="w-full rounded-lg pl-9 pr-3 py-3 text-lg tracking-widest outline-none transition-all font-mono text-center"
            style={{ ...fieldStyle, letterSpacing: '0.3em' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>
      </div>

      <ErrorBanner message={authError} />

      <SubmitButton connecting={connecting} label="Verificar Código" />

      <button
        type="button"
        onClick={onBack}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-60"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#64748b',
        }}
      >
        <ArrowLeft size={14} />
        Voltar ao login
      </button>
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

function SubmitButton({ connecting, label }) {
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
        <><Loader size={16} className="animate-spin" />Autenticando…</>
      ) : label}
    </button>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <span className="text-xs" style={{ color: '#334155' }}>ou</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function AuthFlowInfo() {
  return (
    <div
      className="mt-2 rounded-lg px-4 py-3 text-xs"
      style={{
        background: 'rgba(0,102,255,0.05)',
        border: '1px solid rgba(0,102,255,0.12)',
        color: '#475569',
      }}
    >
      <div className="font-medium mb-1" style={{ color: '#64748b' }}>Fluxo de autenticação</div>
      <ol className="space-y-0.5 list-decimal list-inside">
        <li>Credenciais enviadas via <code className="text-blue-400">HTTP Basic Auth</code></li>
        <li>Instância retorna <code className="text-blue-400">access_token</code> (JWT)</li>
        <li>Se MFA habilitado, etapa de verificação de código</li>
        <li>Token usado como <code className="text-blue-400">Bearer</code> em todas as chamadas</li>
      </ol>
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

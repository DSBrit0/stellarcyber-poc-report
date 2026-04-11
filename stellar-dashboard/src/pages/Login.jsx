import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, Loader, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { connect, connecting, authError } = useAuth()
  const navigate = useNavigate()

  async function handleDemo() {
    await connect({
      url: 'https://demo.stellarcyber.ai',
      username: 'demo',
      password: 'demo',
      tenant: 'demo',
      jwtToken: 'DEMO_MODE_TOKEN',
    })
    navigate('/dashboard')
  }

  const [form, setForm] = useState({
    url: '', username: '', password: '', tenant: '', jwtToken: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [showJwt, setShowJwt] = useState(false)

  function set(k) {
    return e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const ok = await connect(form)
    if (ok) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0a0e1a' }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,102,255,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
        }} />
      </div>

      {/* Card */}
      <div className="w-full max-w-md glass rounded-2xl p-8 relative z-10 animate-fade-in"
        style={{ boxShadow: '0 0 60px rgba(0,102,255,0.15), 0 24px 48px rgba(0,0,0,0.4)' }}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #0066ff, #00d4ff)',
              boxShadow: '0 0 30px rgba(0,212,255,0.4)',
            }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#f1f5f9' }}>
            Stellar Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">Connect to your Stellar Cyber instance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Instance URL" type="url" placeholder="https://your-instance.stellarcyber.ai"
            value={form.url} onChange={set('url')} required />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" type="text" placeholder="admin"
              value={form.username} onChange={set('username')} required />
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                  className="w-full rounded-lg px-3 py-2.5 pr-9 text-sm outline-none transition-all"
                  style={fieldStyle}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <Field label="Tenant" type="text" placeholder="tenant-name or tenant-id"
            value={form.tenant} onChange={set('tenant')} required />

          {/* JWT override (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowJwt(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showJwt ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              JWT Token Override (optional)
            </button>
            {showJwt && (
              <div className="mt-2 animate-fade-in">
                <textarea
                  placeholder="Paste Bearer token to skip password auth..."
                  value={form.jwtToken}
                  onChange={set('jwtToken')}
                  rows={2}
                  className="w-full rounded-lg px-3 py-2.5 text-xs outline-none transition-all resize-none font-mono"
                  style={fieldStyle}
                />
              </div>
            )}
          </div>

          {/* Error */}
          {authError && (
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs animate-fade-in"
              style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#fca5a5' }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: connecting
                ? 'rgba(0,102,255,0.5)'
                : 'linear-gradient(135deg, #0066ff, #00d4ff)',
              color: 'white',
              boxShadow: connecting ? 'none' : '0 0 20px rgba(0,212,255,0.3)',
            }}
          >
            {connecting ? (
              <>
                <Loader size={16} className="animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>

          {/* Demo mode */}
          <button
            type="button"
            onClick={handleDemo}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all duration-200"
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
            }}
          >
            <Zap size={14} />
            Try Demo Mode
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-700 relative z-10">
        Credentials are stored in memory only and never persisted to disk.
      </p>
    </div>
  )
}

const fieldStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
}

function Field({ label, value, onChange, type, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
        style={fieldStyle}
        onFocus={e => {
          e.target.style.border = '1px solid rgba(0,212,255,0.4)'
          e.target.style.boxShadow = '0 0 0 3px rgba(0,212,255,0.08)'
        }}
        onBlur={e => {
          e.target.style.border = '1px solid rgba(255,255,255,0.1)'
          e.target.style.boxShadow = ''
        }}
      />
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, RotateCcw, Shield } from 'lucide-react'

export default function Settings() {
  const { auth, disconnect } = useAuth()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)

  function handleDisconnect() {
    if (!confirmed) { setConfirmed(true); return }
    disconnect()
    navigate('/')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Settings</h2>
        <p className="text-xs text-gray-500 mt-0.5">Connection and application settings</p>
      </div>

      {/* Connection info */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={15} style={{ color: '#00d4ff' }} />
          <h3 className="text-sm font-semibold text-gray-200">Current Connection</h3>
        </div>
        <InfoRow label="Instance URL" value={auth?.url} />
        <InfoRow label="Username" value={auth?.username} />
        <InfoRow label="Tenant" value={auth?.tenant} />
        <InfoRow label="Token" value={auth?.token ? `${auth.token.slice(0, 20)}...` : '—'} mono />
      </div>

      {/* Actions */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Actions</h3>

        <button
          onClick={() => { disconnect(); navigate('/') }}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-colors w-full"
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
            color: '#00d4ff',
          }}
        >
          <RotateCcw size={14} />
          Reconnect with new credentials
        </button>

        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-all w-full"
          style={{
            background: confirmed ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${confirmed ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
            color: '#ef4444',
          }}
        >
          <LogOut size={14} />
          {confirmed ? 'Click again to confirm disconnect' : 'Disconnect'}
        </button>
      </div>

      <p className="text-xs text-gray-600">
        All credentials and tokens are stored in memory only. They are cleared when you disconnect or close the browser tab.
      </p>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-gray-300 text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

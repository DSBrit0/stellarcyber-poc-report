import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, RotateCcw, Shield, Terminal, Trash2, Download, RefreshCw, ChevronDown } from 'lucide-react'
import {
  getLogs, filterLogs, clearLogs, exportLogsJSON, exportLogsText, Level,
} from '../utils/logger'

// ─── Página de Configurações + Logs ──────────────────────────────────────────

export default function Settings() {
  const { auth, disconnect } = useAuth()
  const navigate             = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const [showLogs, setShowLogs]   = useState(false)

  function handleDisconnect() {
    if (!confirmed) { setConfirmed(true); return }
    disconnect()
    navigate('/')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Configurações</h2>
        <p className="text-xs text-gray-500 mt-0.5">Conexão e diagnóstico da aplicação</p>
      </div>

      {/* Conexão atual */}
      <div className="glass rounded-xl p-5 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={15} style={{ color: '#00d4ff' }} />
          <h3 className="text-sm font-semibold text-gray-200">Conexão Atual</h3>
        </div>
        <InfoRow label="URL da Instância" value={auth?.url} />
        <InfoRow label="Usuário"          value={auth?.username} />
        <InfoRow label="Token (preview)"  value={auth?.token ? `${auth.token.slice(0, 24)}…` : '—'} mono />
      </div>

      {/* Ações */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Ações</h3>

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
          Reconectar com novas credenciais
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
          {confirmed ? 'Clique novamente para confirmar' : 'Desconectar'}
        </button>
      </div>

      {/* Painel de logs */}
      <div className="glass rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.02]"
          onClick={() => setShowLogs(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Terminal size={15} style={{ color: '#7c3aed' }} />
            <span className="text-sm font-semibold text-gray-200">Logs de Diagnóstico</span>
          </div>
          <ChevronDown
            size={15}
            style={{
              color: '#6b7280',
              transform: showLogs ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>
        {showLogs && <LogPanel />}
      </div>

      <p className="text-xs text-gray-600">
        Credenciais e tokens ficam apenas em memória e são apagados ao desconectar ou fechar a aba.
      </p>
    </div>
  )
}

// ─── Painel de Logs ───────────────────────────────────────────────────────────

const LEVEL_COLORS = {
  DEBUG: { text: '#7c3aed', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' },
  INFO:  { text: '#00d4ff', bg: 'rgba(0,212,255,0.10)', border: 'rgba(0,212,255,0.25)' },
  WARN:  { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)' },
  ERROR: { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
}

function LogPanel() {
  const [entries, setEntries]   = useState([])
  const [minLevel, setMinLevel] = useState(Level.DEBUG)
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(new Set())

  const refresh = useCallback(() => {
    setEntries(filterLogs({ minLevel, search: search || undefined }))
  }, [minLevel, search])

  useEffect(() => { refresh() }, [refresh])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleClear() {
    clearLogs()
    setEntries([])
  }

  const counts = getLogs().reduce((acc, e) => {
    acc[e.level] = (acc[e.level] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>

        {/* Filtro de nível */}
        <select
          value={minLevel}
          onChange={e => setMinLevel(e.target.value)}
          className="text-xs rounded-lg px-2 py-1.5 outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
        >
          {Object.values(Level).map(l => (
            <option key={l} value={l}>{l}+</option>
          ))}
        </select>

        {/* Busca */}
        <input
          type="text"
          placeholder="Filtrar mensagens…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-xs rounded-lg px-3 py-1.5 outline-none min-w-[120px]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
        />

        {/* Contadores */}
        <div className="flex gap-1.5 ml-auto">
          {Object.entries(counts).map(([lvl, n]) => {
            const c = LEVEL_COLORS[lvl]
            return (
              <span key={lvl} className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
                {lvl[0]} {n}
              </span>
            )
          })}
        </div>

        {/* Botões */}
        <button onClick={refresh} title="Atualizar"
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#64748b' }}>
          <RefreshCw size={13} />
        </button>
        <button onClick={() => exportLogsJSON()} title="Exportar JSON"
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#64748b' }}>
          <Download size={13} />
        </button>
        <button onClick={() => exportLogsText()} title="Exportar TXT"
          className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: '#64748b' }}>
          TXT
        </button>
        <button onClick={handleClear} title="Limpar logs"
          className="p-1.5 rounded-lg transition-colors hover:bg-red-900/20" style={{ color: '#ef4444' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Lista de logs */}
      <div className="overflow-y-auto font-mono text-xs" style={{ maxHeight: 420 }}>
        {entries.length === 0 ? (
          <div className="text-center py-10 text-gray-600">Nenhum log encontrado</div>
        ) : (
          [...entries].reverse().map(entry => {
            const c    = LEVEL_COLORS[entry.level] || LEVEL_COLORS.INFO
            const hasData = entry.data !== null && entry.data !== undefined
            const isOpen  = expanded.has(entry.id)
            const ts      = entry.timestamp.replace('T', ' ').slice(0, 19)

            return (
              <div key={entry.id}
                className={hasData ? 'cursor-pointer hover:bg-white/[0.02]' : ''}
                onClick={() => hasData && toggleExpand(entry.id)}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-start gap-2 px-4 py-2">
                  {/* Nível */}
                  <span className="px-1.5 py-0.5 rounded text-xs flex-shrink-0 leading-tight"
                    style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
                    {entry.level[0]}
                  </span>

                  {/* Timestamp */}
                  <span className="flex-shrink-0 text-gray-600 text-xs leading-5">{ts}</span>

                  {/* Context */}
                  <span className="flex-shrink-0 text-xs leading-5" style={{ color: '#7c3aed' }}>
                    [{entry.context}]
                  </span>

                  {/* Mensagem */}
                  <span className="text-gray-300 leading-5 break-all flex-1">{entry.message}</span>

                  {/* Indicador de dados */}
                  {hasData && (
                    <span className="flex-shrink-0 text-xs text-gray-600 leading-5">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {/* Dados expandidos */}
                {hasData && isOpen && (
                  <pre className="px-4 pb-3 text-xs overflow-x-auto leading-relaxed"
                    style={{ color: '#94a3b8', background: 'rgba(0,0,0,0.2)' }}>
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-2 text-xs text-gray-600"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
        <span>{entries.length} entrada{entries.length !== 1 ? 's' : ''} exibida{entries.length !== 1 ? 's' : ''}</span>
        <span>Total em memória: {getLogs().length}</span>
      </div>
    </div>
  )
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

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

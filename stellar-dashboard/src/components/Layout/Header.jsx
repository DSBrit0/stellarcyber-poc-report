import { Menu, RefreshCw, Sun, Moon, LogOut, Wifi } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatDate } from '../../utils/formatters'

export default function Header({ onMenuClick, darkMode, onToggleDark }) {
  const { auth, disconnect } = useAuth()
  const { loading, lastRefresh, refresh } = useData()

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(10,14,26,0.9)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        height: '60px',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Menu size={20} />
        </button>
        {auth && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <Wifi size={13} style={{ color: '#22c55e' }} />
            <span style={{ color: '#22c55e' }}>Connected</span>
            <span className="mx-1 text-gray-700">•</span>
            <span>{auth.url?.replace(/https?:\/\//, '').replace(/\/$/, '')}</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {lastRefresh && (
          <span className="hidden md:block text-xs text-gray-600">
            Refreshed {formatDate(lastRefresh)}
          </span>
        )}

        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh data"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <button
          onClick={onToggleDark}
          title="Toggle theme"
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={disconnect}
          title="Disconnect"
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

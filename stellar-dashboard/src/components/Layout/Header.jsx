import { useState, useRef, useEffect } from 'react'
import { Menu, RefreshCw, Sun, Moon, LogOut, Wifi, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useLocale, LOCALE_OPTIONS } from '../../i18n'
import { formatDate } from '../../utils/formatters'

export default function Header({ onMenuClick, darkMode, onToggleDark }) {
  const { auth, disconnect }          = useAuth()
  const { loading, lastRefresh, refresh } = useData()
  const { locale, setLocale, t }      = useLocale()
  const [langOpen, setLangOpen]       = useState(false)
  const dropdownRef                   = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentFlag = LOCALE_OPTIONS.find(o => o.code === locale)?.flag ?? '🌐'

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
            <span style={{ color: '#22c55e' }}>{t('header.connected')}</span>
            <span className="mx-1 text-gray-700">•</span>
            <span>{auth.url?.replace(/https?:\/\//, '').replace(/\/$/, '')}</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {lastRefresh && (
          <span className="hidden md:block text-xs text-gray-600">
            {t('header.refreshed', { date: formatDate(lastRefresh) })}
          </span>
        )}

        <button
          onClick={refresh}
          disabled={loading}
          title={t('header.refreshData')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <button
          onClick={onToggleDark}
          title={t('header.toggleTheme')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Language switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setLangOpen(v => !v)}
            title={t('header.language') ?? 'Language'}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Globe size={16} />
            <span className="text-xs hidden sm:inline">{currentFlag}</span>
          </button>

          {langOpen && (
            <div
              className="absolute right-0 mt-1 w-40 rounded-xl overflow-hidden z-50"
              style={{
                background: 'rgba(13,18,33,0.97)',
                border: '1px solid rgba(0,212,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {LOCALE_OPTIONS.map(opt => (
                <button
                  key={opt.code}
                  onClick={() => { setLocale(opt.code); setLangOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-white/[0.06]"
                  style={{
                    color: locale === opt.code ? '#00d4ff' : '#94a3b8',
                    fontWeight: locale === opt.code ? 600 : 400,
                  }}
                >
                  <span>{opt.flag}</span>
                  <span>{opt.label}</span>
                  {locale === opt.code && (
                    <span className="ml-auto text-xs" style={{ color: '#00d4ff' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={disconnect}
          title={t('header.disconnect')}
          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

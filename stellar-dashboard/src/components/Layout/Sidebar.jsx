import { NavLink } from 'react-router-dom'
import {
  Settings, ShieldCheck, X, ChevronRight, FileText,
} from 'lucide-react'
import { useLocale } from '../../i18n'

export default function Sidebar({ open, onClose }) {
  const { t } = useLocale()

  const navItems = [
    { to: '/report',   icon: FileText,  label: t('nav.report') },
    { to: '/settings', icon: Settings,  label: t('nav.settings') },
  ]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className="fixed top-0 left-0 z-30 h-full w-64 flex flex-col transition-transform duration-300"
        style={{
          background: 'linear-gradient(180deg, #0d1221 0%, #080c18 100%)',
          borderRight: '1px solid rgba(0,212,255,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #0066ff)', boxShadow: '0 0 16px #00d4ff55' }}>
              <ShieldCheck size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide" style={{ color: '#00d4ff' }}>STELLAR</div>
              <div className="text-xs text-gray-500 tracking-widest">DASHBOARD</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(90deg, rgba(0,212,255,0.15), rgba(0,102,255,0.08))',
                border: '1px solid rgba(0,212,255,0.2)',
                boxShadow: '0 0 12px rgba(0,212,255,0.1)',
              } : {}}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                      style={{ background: '#00d4ff', boxShadow: '0 0 8px #00d4ff' }} />
                  )}
                  <Icon size={17} style={{ color: isActive ? '#00d4ff' : undefined }} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto" style={{ color: '#00d4ff55' }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 text-xs text-gray-600" style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}>
          <div>{t('nav.footer')}</div>
          <div className="mt-0.5" style={{ color: '#00d4ff44' }}>v2.0.0</div>
        </div>
      </aside>
    </>
  )
}

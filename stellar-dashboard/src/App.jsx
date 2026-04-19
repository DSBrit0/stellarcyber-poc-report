import { useState, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { LocaleProvider } from './i18n'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'
import Login from './pages/Login'
import Report from './pages/Report'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import Assets from './pages/Assets'
import Sensors from './pages/Sensors'
import Recommendations from './pages/Recommendations'
import Settings from './pages/Settings'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-8">
          <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>Something went wrong</div>
          <div className="text-xs text-center max-w-md text-gray-500">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs px-4 py-2 rounded-lg"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedLayout() {
  const { auth } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode]       = useState(true)

  if (!auth) return <Navigate to="/" replace />

  return (
    <DataProvider>
      <div className="flex min-h-screen" style={{ background: darkMode ? '#0a0e1a' : '#f0f4f8' }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div
          className="flex-1 flex flex-col min-w-0 transition-all duration-300"
          style={{ marginLeft: sidebarOpen ? '256px' : '0' }}
        >
          <Header
            onMenuClick={() => setSidebarOpen(v => !v)}
            darkMode={darkMode}
            onToggleDark={() => setDarkMode(v => !v)}
          />
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Routes>
                <Route path="/report"          element={<Report />} />
                <Route path="/dashboard"       element={<Dashboard />} />
                <Route path="/cases"           element={<Cases />} />
                <Route path="/assets"          element={<Assets />} />
                <Route path="/sensors"         element={<Sensors />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/settings"        element={<Settings />} />
                <Route path="*"                element={<Navigate to="/report" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </DataProvider>
  )
}

function LoginRoute() {
  const { auth } = useAuth()
  if (auth) return <Navigate to="/report" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
      <AuthProvider>
        <Routes>
          <Route path="/"   element={<LoginRoute />} />
          <Route path="/*"  element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  )
}

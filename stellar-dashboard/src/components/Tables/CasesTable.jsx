import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { severityColor, formatDate } from '../../utils/formatters'

const PAGE_SIZE = 10

function SeverityBadge({ severity }) {
  const c = severityColor(severity)
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {severity}
    </span>
  )
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <div className="w-3" />
  return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export default function CasesTable({ cases, loading }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ col: 'createdAt', dir: 'desc' })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return cases.filter(c =>
      !q ||
      String(c.id).toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.severity?.toLowerCase().includes(q) ||
      c.status?.toLowerCase().includes(q)
    )
  }, [cases, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sort.col], vb = b[sort.col]
      if (sort.col === 'createdAt') { va = new Date(va); vb = new Date(vb) }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(col) {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    )
    setPage(1)
  }

  function exportCSV() {
    const headers = ['Case ID', 'Name', 'Severity', 'Status', 'Assets Affected', 'Created At']
    const rows = sorted.map(c => [c.id, `"${c.name}"`, c.severity, c.status, c.assetsAffected, c.createdAt])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'cases.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const cols = [
    { key: 'id', label: 'Case ID' },
    { key: 'name', label: 'Name' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
    { key: 'assetsAffected', label: 'Assets' },
    { key: 'createdAt', label: 'Created' },
  ]

  if (loading) {
    return (
      <div className="glass rounded-xl p-5">
        <div className="skeleton h-4 w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Open Cases</h3>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.length} cases</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search cases..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="text-xs rounded-lg pl-8 pr-3 py-2 w-48 outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0',
              }}
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.2)',
              color: '#00d4ff',
            }}
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="text-left py-2 px-3 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {c.label}
                    <SortIcon col={c.key} sort={sort} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">No cases found</td>
              </tr>
            ) : (
              paginated.map(c => (
                <tr
                  key={c.id}
                  className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="py-2.5 px-3 font-mono" style={{ color: '#00d4ff' }}>{c.id}</td>
                  <td className="py-2.5 px-3 text-gray-300 max-w-[200px] truncate">{c.name}</td>
                  <td className="py-2.5 px-3"><SeverityBadge severity={c.severity} /></td>
                  <td className="py-2.5 px-3">
                    <span className="capitalize text-gray-400">{c.status}</span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">{c.assetsAffected}</td>
                  <td className="py-2.5 px-3 text-gray-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
        <span>Page {page} of {totalPages}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            if (pg > totalPages) return null
            return (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className="w-6 h-6 rounded text-xs transition-colors"
                style={pg === page ? {
                  background: 'rgba(0,212,255,0.2)',
                  color: '#00d4ff',
                } : {}}
              >
                {pg}
              </button>
            )
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

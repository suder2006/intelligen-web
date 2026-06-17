'use client'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

function loginStatus(lastSignIn) {
  if (!lastSignIn) return { label: 'Never', color: '#f87171', bg: 'rgba(248,113,113,0.15)' }
  const d = new Date(lastSignIn)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0)
  if (d >= today) return { label: 'Today', color: '#34d399', bg: 'rgba(52,211,153,0.15)' }
  if (d >= weekAgo) return { label: 'This Week', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' }
  return { label: 'Inactive', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' }
}

function formatLastLogin(lastSignIn) {
  if (!lastSignIn) return '—'
  const d = new Date(lastSignIn)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  let rel
  if (diffMins < 1) rel = 'just now'
  else if (diffMins < 60) rel = `${diffMins}m ago`
  else if (diffHours < 24) rel = `${diffHours}h ago`
  else if (diffDays < 30) rel = `${diffDays}d ago`
  else rel = `${Math.floor(diffDays / 30)}mo ago`
  const abs = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return { rel, abs }
}

export default function AdminParentsPage() {
  const { schoolId } = useSchool()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | today | week | inactive | never

  useEffect(() => { if (schoolId) fetchData() }, [schoolId])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/parent-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load parent activity')
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const stats = data || { total: 0, today: 0, week: 0, never: 0, pushEnabled: 0, parents: [] }

  const filtered = (stats.parents || []).filter(p => {
    const st = loginStatus(p.last_sign_in_at).label
    if (filter === 'today' && st !== 'Today') return false
    if (filter === 'week' && st !== 'This Week') return false
    if (filter === 'inactive' && st !== 'Inactive') return false
    if (filter === 'never' && st !== 'Never') return false
    if (search) {
      const q = search.toLowerCase()
      return (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q)
    }
    return true
  })

  const cards = [
    { label: 'Total Parents', value: stats.total, icon: '👪', color: '#a78bfa', key: 'all' },
    { label: 'Logged In Today', value: stats.today, icon: '🟢', color: '#34d399', key: 'today' },
    { label: 'This Week', value: stats.week, icon: '📅', color: '#38bdf8', key: 'week' },
    { label: 'Never Logged In', value: stats.never, icon: '🚫', color: '#f87171', key: 'never' },
    { label: 'Push Enabled', value: stats.pushEnabled, icon: '🔔', color: '#fbbf24', key: null },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; transition: all 0.15s; }
        .stat-card.clickable { cursor: pointer; }
        .stat-card.clickable:hover { border-color: rgba(56,189,248,0.3); background: rgba(255,255,255,0.05); }
        .stat-card.active { border-color: #38bdf8; background: rgba(56,189,248,0.06); }
        .ptable { width: 100%; border-collapse: collapse; }
        .ptable th { text-align: left; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); text-transform: uppercase; letter-spacing: 0.5px; }
        .ptable td { padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 14px; vertical-align: middle; }
        .ptable tr:hover td { background: rgba(255,255,255,0.02); }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .input { padding: 10px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #fff; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>👪 Parents</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Registered parents & login activity</p>
          </div>
          <button className="input" onClick={fetchData} style={{ cursor: 'pointer' }}>🔄 Refresh</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', color: '#f87171', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {cards.map(c => (
            <div
              key={c.label}
              className={`stat-card ${c.key ? 'clickable' : ''} ${c.key && filter === c.key ? 'active' : ''}`}
              onClick={() => c.key && setFilter(filter === c.key ? 'all' : c.key)}
            >
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{c.icon}</span> {c.label}
              </div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: c.color }}>
                {loading ? '…' : c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="🔍 Search name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '240px' }}
          />
          <select className="input" value={filter} onChange={e => setFilter(e.target.value)} style={{ backgroundColor: '#1e293b' }}>
            <option value="all">All statuses</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="inactive">Inactive</option>
            <option value="never">Never logged in</option>
          </select>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {filtered.length} of {stats.total} shown
          </span>
        </div>

        {/* Parent table */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Push</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    {stats.total === 0 ? 'No parents registered yet.' : 'No parents match your filters.'}
                  </td></tr>
                ) : filtered.map(p => {
                  const st = loginStatus(p.last_sign_in_at)
                  const last = formatLastLogin(p.last_sign_in_at)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: '600' }}>{p.full_name || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>{p.email || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>{p.phone || '—'}</td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {last === '—' ? '—' : (
                          <span title={last.abs}>{last.rel}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td>
                        {p.push_enabled
                          ? <span style={{ color: '#34d399', fontWeight: '600' }}>🔔 Yes</span>
                          : <span style={{ color: 'rgba(255,255,255,0.3)' }}>No</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

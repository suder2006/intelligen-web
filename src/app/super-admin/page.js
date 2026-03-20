'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ schools: 0, students: 0, staff: 0, admissions: 0 })
  const [schools, setSchools] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const [sc, st, sf, ad] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact' }).in('role', ['teacher', 'staff']),
      supabase.from('admissions').select('id', { count: 'exact' }).eq('status', 'pending'),
    ])
    // Get per-school student and staff counts
    const schoolsWithStats = await Promise.all((sc.data || []).map(async school => {
      const [stuCount, staffCount] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }).eq('school_id', school.id).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('school_id', school.id).in('role', ['teacher', 'staff'])
      ])
      return { ...school, student_count: stuCount.count || 0, staff_count: staffCount.count || 0 }
    }))
    setSchools(schoolsWithStats)
    setStats({ schools: sc.data?.length || 0, students: st.count || 0, staff: sf.count || 0, admissions: ad.count || 0 })
    setLoading(false)
  }

  const addSchool = async () => {
    if (!form.name) return
    setSaving(true)
    await supabase.from('schools').insert([form])
    setForm({ name: '', address: '', phone: '', email: '' })
    setShowAdd(false)
    setSaving(false)
    loadData()
  }

  const deleteSchool = async (id) => {
    if (!confirm('Delete this school? This cannot be undone.')) return
    await supabase.from('schools').delete().eq('id', id)
    loadData()
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const statCards = [
    { label: 'Total Schools', value: stats.schools, icon: '🏫', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    { label: 'Total Students', value: stats.students, icon: '👶', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Total Staff', value: stats.staff, icon: '👩‍🏫', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    { label: 'Pending Admissions', value: stats.admissions, icon: '📋', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 8px; }
        .logo span { color: #38bdf8; }
        .role-badge { background: rgba(245,158,11,0.15); color: #fbbf24; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin: 0 12px 24px; display: inline-block; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; }
        .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-top: 4px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .logout-btn { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
        .stat-value { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: rgba(255,255,255,0.8); }
        .schools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .school-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; }
        .school-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
        .school-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .school-info { color: rgba(255,255,255,0.4); font-size: 13px; margin-bottom: 4px; }
        .school-actions { display: flex; gap: 8px; margin-top: 16px; }
        .btn-manage { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); border-radius: 8px; padding: 7px 14px; color: #38bdf8; font-size: 13px; cursor: pointer; text-decoration: none; font-family: 'DM Sans', sans-serif; display: inline-block; }
        .del-btn { background: rgba(239,68,68,0.1); border: none; border-radius: 8px; padding: 7px 14px; color: #f87171; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-input:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        <div className="role-badge">⭐ Super Admin</div>
        <Link href="/super-admin" className="nav-item active">🏫 All Schools</Link>
        <Link href="/super-admin/schools" className="nav-item">🏫 Manage Schools</Link>
        <Link href="/admin" className="nav-item">⊞ School Dashboard</Link>
        <div style={{ flex: 1 }} />
        <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
      </div>

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">🌍 Platform Overview</div>
            <div className="page-sub">Manage all IntelliGen schools from one place</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add New School</button>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {statCards.map(card => (
            <div key={card.label} className="stat-card">
              <div className="stat-icon" style={{ background: card.bg }}>{card.icon}</div>
              <div className="stat-value" style={{ color: card.color }}>{loading ? '...' : card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Schools */}
        <div className="section-title">🏫 All Schools ({schools.length})</div>
        {schools.length === 0 && !loading ? (
          <div className="empty">
            <div className="empty-icon">🏫</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No schools yet</div>
            <div style={{ fontSize: '14px' }}>Click "+ Add New School" to get started</div>
          </div>
        ) : (
          <div className="schools-grid">
            {schools.map(school => (
              <div key={school.id} className="school-card">
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏫</div>
                <div className="school-name">{school.name}</div>
                {school.address && <div className="school-info">📍 {school.address}</div>}
                {school.phone && <div className="school-info">📞 {school.phone}</div>}
                {school.email && <div className="school-info">✉️ {school.email}</div>}
                <div style={{ display: 'flex', gap: '16px', margin: '10px 0', flexWrap: 'wrap' }}>
                  <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>👶 {school.student_count} Students</span>
                  <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600' }}>👩‍🏫 {school.staff_count} Staff</span>
                </div>
                <div className="school-info">
                  Added {new Date(school.created_at).toLocaleDateString()}
                </div>
                <div className="school-actions">
                  <a href={`/super-admin/schools?id=${school.id}`} className="btn-manage">⊞ Manage</a>
                  <button className="del-btn" onClick={() => deleteSchool(school.id)}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add School Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🏫 Add New School</div>
            <label className="form-label">School Name *</label>
            <input className="form-input" placeholder="e.g. Little Stars Academy" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <label className="form-label">Address</label>
            <input className="form-input" placeholder="e.g. 123 Main St, Dallas TX" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="e.g. +1 234 567 8900" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <label className="form-label">Email</label>
            <input className="form-input" placeholder="e.g. info@school.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addSchool} disabled={saving}>{saving ? 'Saving...' : 'Add School'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
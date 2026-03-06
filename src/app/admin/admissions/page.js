'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ child_name: '', date_of_birth: '', parent_name: '', parent_email: '', parent_phone: '', notes: '' })

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '⊞' },
    { href: '/admin/students', label: 'Students', icon: '👶' },
    { href: '/admin/classes', label: 'Classes', icon: '📚' },
    { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
    { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
    { href: '/admin/fees', label: 'Fees', icon: '💳' },
    { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
  ]

  useEffect(() => { fetchAdmissions() }, [])

  const fetchAdmissions = async () => {
    setLoading(true)
    const { data } = await supabase.from('admissions').select('*').order('created_at', { ascending: false })
    setAdmissions(data || [])
    setLoading(false)
  }

  const addAdmission = async () => {
    if (!form.child_name || !form.parent_name) return
    setSaving(true)
    await supabase.from('admissions').insert([{ ...form, status: 'pending' }])
    setForm({ child_name: '', date_of_birth: '', parent_name: '', parent_email: '', parent_phone: '', notes: '' })
    setShowAdd(false)
    setSaving(false)
    fetchAdmissions()
  }

  const updateStatus = async (id, status) => {
    await supabase.from('admissions').update({ status }).eq('id', id)
    fetchAdmissions()
  }

  const filtered = filter === 'all' ? admissions : admissions.filter(a => a.status === filter)

  const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', waitlist: '#a78bfa' }
  const statusBg = { pending: 'rgba(245,158,11,0.15)', approved: 'rgba(16,185,129,0.15)', rejected: 'rgba(239,68,68,0.15)', waitlist: 'rgba(167,139,250,0.15)' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; }
        .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-top: 4px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .filters { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .filter-btn { padding: 7px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .filter-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .child-name { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
        .parent-info { color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 3px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .card-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
        .action-btn { padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-input:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.3); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/admissions' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">📋 Admissions</div>
            <div className="page-sub">{admissions.length} total applications</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ New Application</button>
        </div>

        <div className="filters">
          {['all', 'pending', 'approved', 'waitlist', 'rejected'].map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? '📋 All' : f === 'pending' ? '⏳ Pending' : f === 'approved' ? '✅ Approved' : f === 'waitlist' ? '📌 Waitlist' : '❌ Rejected'}
              {' '}({f === 'all' ? admissions.length : admissions.filter(a => a.status === f).length})
            </button>
          ))}
        </div>

        {loading ? <div className="empty">Loading admissions...</div> :
         filtered.length === 0 ? <div className="empty">No applications found.</div> : (
          <div className="cards-grid">
            {filtered.map(a => (
              <div key={a.id} className="card">
                <div className="card-header">
                  <div>
                    <div className="child-name">👶 {a.child_name}</div>
                    {a.date_of_birth && <div className="parent-info">🎂 DOB: {a.date_of_birth}</div>}
                  </div>
                  <span className="badge" style={{ background: statusBg[a.status], color: statusColor[a.status] }}>
                    {a.status}
                  </span>
                </div>
                <div className="parent-info">👤 Parent: {a.parent_name}</div>
                {a.parent_email && <div className="parent-info">✉️ {a.parent_email}</div>}
                {a.parent_phone && <div className="parent-info">📞 {a.parent_phone}</div>}
                {a.notes && <div className="parent-info" style={{ marginTop: '8px', fontStyle: 'italic' }}>📝 {a.notes}</div>}
                <div className="parent-info" style={{ marginTop: '8px' }}>{new Date(a.created_at).toLocaleDateString()}</div>
                <div className="card-actions">
                  {a.status !== 'approved' && <button className="action-btn" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }} onClick={() => updateStatus(a.id, 'approved')}>✅ Approve</button>}
                  {a.status !== 'waitlist' && <button className="action-btn" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }} onClick={() => updateStatus(a.id, 'waitlist')}>📌 Waitlist</button>}
                  {a.status !== 'rejected' && <button className="action-btn" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }} onClick={() => updateStatus(a.id, 'rejected')}>❌ Reject</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📋 New Admission Application</div>
            <label className="form-label">Child's Full Name *</label>
            <input className="form-input" placeholder="e.g. Emma Johnson" value={form.child_name} onChange={e => setForm({...form, child_name: e.target.value})} />
            <label className="form-label">Date of Birth</label>
            <input className="form-input" type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
            <label className="form-label">Parent / Guardian Name *</label>
            <input className="form-input" placeholder="e.g. Robert Johnson" value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} />
            <label className="form-label">Parent Email</label>
            <input className="form-input" type="email" placeholder="e.g. robert@email.com" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} />
            <label className="form-label">Parent Phone</label>
            <input className="form-input" placeholder="e.g. +1 234 567 8900" value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} />
            <label className="form-label">Notes</label>
            <input className="form-input" placeholder="Any additional notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addAdmission} disabled={saving}>{saving ? 'Saving...' : 'Submit Application'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
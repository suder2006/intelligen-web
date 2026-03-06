'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', position: '', department: '', join_date: '' })

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

  useEffect(() => { fetchStaff() }, [])

  const fetchStaff = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').in('role', ['teacher', 'school_admin']).order('created_at', { ascending: false })
    setStaff(data || [])
    setLoading(false)
  }

  const addStaff = async () => {
    if (!form.full_name || !form.email) return
    setSaving(true)
    const { data: authData, error } = await supabase.auth.admin?.createUser?.({ email: form.email, password: 'Staff@123456', email_confirm: true })
    await supabase.from('profiles').insert([{
      full_name: form.full_name, email: form.email, phone: form.phone, role: 'teacher'
    }])
    setForm({ full_name: '', email: '', phone: '', position: '', department: '', join_date: '' })
    setShowAdd(false)
    setSaving(false)
    fetchStaff()
  }

  const deleteStaff = async (id) => {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('profiles').delete().eq('id', id)
    fetchStaff()
  }

  const deptColors = { Teaching: '#38bdf8', Admin: '#f59e0b', Support: '#10b981', Management: '#a78bfa' }

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
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; }
        .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-top: 4px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .staff-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; }
        .staff-card:hover { border-color: rgba(56,189,248,0.2); transform: translateY(-2px); }
        .avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 16px; }
        .staff-name { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
        .staff-role { color: #38bdf8; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
        .staff-info { color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 4px; }
        .del-btn { background: rgba(239,68,68,0.1); border: none; border-radius: 8px; padding: 7px 14px; color: #f87171; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; margin-top: 16px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-input:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .hint { background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 20px; }
        .empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.3); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/staff' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">👩‍🏫 Staff</div>
            <div className="page-sub">{staff.length} staff members</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
        </div>

        {loading ? <div className="empty">Loading staff...</div> :
         staff.length === 0 ? <div className="empty">No staff added yet.</div> : (
          <div className="grid">
            {staff.map(s => (
              <div key={s.id} className="staff-card">
                <div className="avatar">{s.full_name?.[0]?.toUpperCase() || '?'}</div>
                <div className="staff-name">{s.full_name}</div>
                <div className="staff-role">{s.role === 'teacher' ? '👩‍🏫 Teacher' : '🏫 School Admin'}</div>
                {s.email && <div className="staff-info">✉️ {s.email}</div>}
                {s.phone && <div className="staff-info">📞 {s.phone}</div>}
                <div className="staff-info">📅 Joined {new Date(s.created_at).toLocaleDateString()}</div>
                <button className="del-btn" onClick={() => deleteStaff(s.id)}>🗑 Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">👩‍🏫 Add Staff Member</div>
            <div className="hint">💡 Staff will be added as a Teacher. Default password: <strong>Staff@123456</strong></div>
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="e.g. Sarah Williams" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="e.g. sarah@school.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="e.g. +1 234 567 8900" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addStaff} disabled={saving}>{saving ? 'Saving...' : 'Add Staff'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
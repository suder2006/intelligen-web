'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ClassesPage() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', age_group: '', capacity: '', schedule: '' })

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '⊞' },
    { href: '/admin/students', label: 'Students', icon: '👶' },
    { href: '/admin/classes', label: 'Classes', icon: '📚' },
    { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
    { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
    { href: '/admin/fees', label: 'Fees', icon: '💳' },
    { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
    { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
    { href: '/admin/curriculum', label: 'Curriculum', icon: '📖' },
    { href: '/admin/moments', label: 'Moments', icon: '📸' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
    { href: '/admin/skills', label: 'Skills & Progress', icon: '🎯' },
  ]

  useEffect(() => { fetchClasses() }, [])

  const fetchClasses = async () => {
    setLoading(true)
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false })
    setClasses(data || [])
    setLoading(false)
  }

  const addClass = async () => {
    if (!form.name) return
    setSaving(true)
    await supabase.from('classes').insert([{ ...form, capacity: form.capacity ? parseInt(form.capacity) : null }])
    setForm({ name: '', age_group: '', capacity: '', schedule: '' })
    setShowAdd(false)
    setSaving(false)
    fetchClasses()
  }

  const deleteClass = async (id) => {
    if (!confirm('Delete this class?')) return
    await supabase.from('classes').delete().eq('id', id)
    fetchClasses()
  }

  const ageGroupColors = { 'Toddler (1-2)': '#f59e0b', 'Nursery (2-3)': '#10b981', 'Pre-K (3-4)': '#38bdf8', 'Kindergarten (4-5)': '#a78bfa' }

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
        .class-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; }
        .class-card:hover { border-color: rgba(56,189,248,0.2); transform: translateY(-2px); }
        .class-icon { font-size: 36px; margin-bottom: 12px; }
        .class-name { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
        .class-info { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 6px; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
        .del-btn { background: rgba(239,68,68,0.1); border: none; border-radius: 8px; padding: 7px 14px; color: #f87171; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; }
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
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/classes' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">📚 Classes</div>
            <div className="page-sub">{classes.length} classes running</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Class</button>
        </div>

        {loading ? <div className="empty">Loading classes...</div> :
         classes.length === 0 ? <div className="empty">No classes yet. Add your first class!</div> : (
          <div className="grid">
            {classes.map(c => {
              const color = ageGroupColors[c.age_group] || '#38bdf8'
              return (
                <div key={c.id} className="class-card">
                  <div className="class-icon">📚</div>
                  <div className="class-name">{c.name}</div>
                  {c.age_group && <span className="badge" style={{ background: `${color}20`, color }}>{c.age_group}</span>}
                  {c.capacity && <div className="class-info">👥 Capacity: {c.capacity} students</div>}
                  {c.schedule && <div className="class-info">🕐 {c.schedule}</div>}
                  <div className="class-info">📅 Created {new Date(c.created_at).toLocaleDateString()}</div>
                  <div style={{ marginTop: '16px' }}>
                    <button className="del-btn" onClick={() => deleteClass(c.id)}>🗑 Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📚 Add New Class</div>
            <label className="form-label">Class Name *</label>
            <input className="form-input" placeholder="e.g. Sunshine Class" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <label className="form-label">Age Group</label>
            <select className="form-input" value={form.age_group} onChange={e => setForm({...form, age_group: e.target.value})}>
              <option value="">Select age group</option>
              <option>Toddler (1-2)</option>
              <option>Nursery (2-3)</option>
              <option>Pre-K (3-4)</option>
              <option>Kindergarten (4-5)</option>
            </select>
            <label className="form-label">Capacity</label>
            <input className="form-input" type="number" placeholder="e.g. 20" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
            <label className="form-label">Schedule</label>
            <input className="form-input" placeholder="e.g. Mon-Fri, 8AM - 12PM" value={form.schedule} onChange={e => setForm({...form, schedule: e.target.value})} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addClass} disabled={saving}>{saving ? 'Saving...' : 'Add Class'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
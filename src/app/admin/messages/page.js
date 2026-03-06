'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function MessagesPage() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', audience: 'all' })

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

  useEffect(() => { fetchAnnouncements() }, [])

  const fetchAnnouncements = async () => {
    setLoading(true)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  const sendAnnouncement = async () => {
    if (!form.title || !form.content) return
    setSaving(true)
    await supabase.from('announcements').insert([form])
    setForm({ title: '', content: '', audience: 'all' })
    setShowAdd(false)
    setSaving(false)
    fetchAnnouncements()
  }

  const deleteAnnouncement = async (id) => {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  const audienceColor = { all: '#38bdf8', parents: '#a78bfa', teachers: '#10b981', staff: '#f59e0b' }
  const audienceBg = { all: 'rgba(56,189,248,0.15)', parents: 'rgba(167,139,250,0.15)', teachers: 'rgba(16,185,129,0.15)', staff: 'rgba(245,158,11,0.15)' }

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
        .announce-list { display: flex; flex-direction: column; gap: 12px; }
        .announce-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; }
        .announce-card:hover { border-color: rgba(56,189,248,0.15); }
        .announce-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
        .announce-title { font-size: 17px; font-weight: 700; }
        .announce-content { color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
        .announce-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .announce-time { color: rgba(255,255,255,0.3); font-size: 13px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .del-btn { background: rgba(239,68,68,0.1); border: none; border-radius: 6px; padding: 6px 12px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 520px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-textarea { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; resize: vertical; min-height: 100px; }
        .form-input:focus, .form-textarea:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.3); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/messages' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">💬 Messages & Announcements</div>
            <div className="page-sub">{announcements.length} announcements sent</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ New Announcement</button>
        </div>

        {loading ? <div className="empty">Loading...</div> :
         announcements.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No announcements yet</div>
            <div style={{ fontSize: '14px' }}>Send your first announcement to parents, teachers or all staff</div>
          </div>
        ) : (
          <div className="announce-list">
            {announcements.map(a => (
              <div key={a.id} className="announce-card">
                <div className="announce-header">
                  <div className="announce-title">📢 {a.title}</div>
                  <span className="badge" style={{ background: audienceBg[a.audience], color: audienceColor[a.audience], whiteSpace: 'nowrap' }}>
                    {a.audience === 'all' ? '🌍 Everyone' : a.audience === 'parents' ? '👪 Parents' : a.audience === 'teachers' ? '👩‍🏫 Teachers' : '👥 Staff'}
                  </span>
                </div>
                <div className="announce-content">{a.content}</div>
                <div className="announce-footer">
                  <div className="announce-time">📅 {new Date(a.created_at).toLocaleString()}</div>
                  <button className="del-btn" onClick={() => deleteAnnouncement(a.id)}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📢 New Announcement</div>
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. School Closed on Friday" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <label className="form-label">Message *</label>
            <textarea className="form-textarea" placeholder="Write your announcement here..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
            <label className="form-label">Send To</label>
            <select className="form-input" value={form.audience} onChange={e => setForm({...form, audience: e.target.value})}>
              <option value="all">🌍 Everyone</option>
              <option value="parents">👪 Parents Only</option>
              <option value="teachers">👩‍🏫 Teachers Only</option>
              <option value="staff">👥 Staff Only</option>
            </select>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={sendAnnouncement} disabled={saving}>{saving ? 'Sending...' : '📢 Send Announcement'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
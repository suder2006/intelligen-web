'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function FeesPage() {
  const [fees, setFees] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ student_id: '', title: '', amount: '', due_date: '', status: 'unpaid' })

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

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [f, s] = await Promise.all([
      supabase.from('fees').select('*, students(full_name)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, full_name').eq('status', 'active')
    ])
    setFees(f.data || [])
    setStudents(s.data || [])
    setLoading(false)
  }

  const addFee = async () => {
    if (!form.title || !form.amount) return
    setSaving(true)
    await supabase.from('fees').insert([{ ...form, amount: parseFloat(form.amount) }])
    setForm({ student_id: '', title: '', amount: '', due_date: '', status: 'unpaid' })
    setShowAdd(false)
    setSaving(false)
    fetchData()
  }

  const markPaid = async (id) => {
    await supabase.from('fees').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    fetchData()
  }

  const deleteFee = async (id) => {
    if (!confirm('Delete this fee?')) return
    await supabase.from('fees').delete().eq('id', id)
    fetchData()
  }

  const filtered = filter === 'all' ? fees : fees.filter(f => f.status === filter)
  const totalUnpaid = fees.filter(f => f.status === 'unpaid').reduce((sum, f) => sum + Number(f.amount), 0)
  const totalPaid = fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0)

  const statusColor = { unpaid: '#f59e0b', paid: '#10b981', overdue: '#ef4444' }
  const statusBg = { unpaid: 'rgba(245,158,11,0.15)', paid: 'rgba(16,185,129,0.15)', overdue: 'rgba(239,68,68,0.15)' }

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
        .summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .sum-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; }
        .sum-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .sum-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .filters { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .filter-btn { padding: 7px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .filter-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 14px 20px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        td { padding: 16px 20px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
        tr:last-child td { border-bottom: none; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .pay-btn { background: rgba(16,185,129,0.15); border: none; border-radius: 6px; padding: 6px 12px; color: #34d399; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; margin-right: 6px; }
        .del-btn { background: rgba(239,68,68,0.1); border: none; border-radius: 6px; padding: 6px 12px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 480px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-input:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/fees' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">💳 Fees & Payments</div>
            <div className="page-sub">{fees.length} total fee records</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Fee</button>
        </div>

        <div className="summary">
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#ef4444' }}>${totalUnpaid.toLocaleString()}</div>
            <div className="sum-label">💳 Total Unpaid</div>
          </div>
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#10b981' }}>${totalPaid.toLocaleString()}</div>
            <div className="sum-label">✅ Total Collected</div>
          </div>
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#38bdf8' }}>{fees.length}</div>
            <div className="sum-label">📋 Total Invoices</div>
          </div>
        </div>

        <div className="filters">
          {['all', 'unpaid', 'paid', 'overdue'].map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {' '}({f === 'all' ? fees.length : fees.filter(x => x.status === f).length})
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Fee Title</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty">Loading fees...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty">No fee records found.</td></tr>
              ) : filtered.map(f => (
                <tr key={f.id}>
                  <td>{f.students?.full_name || '—'}</td>
                  <td style={{ fontWeight: 500 }}>{f.title}</td>
                  <td style={{ color: '#38bdf8', fontWeight: 600 }}>${Number(f.amount).toLocaleString()}</td>
                  <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{f.due_date || '—'}</td>
                  <td><span className="badge" style={{ background: statusBg[f.status], color: statusColor[f.status] }}>{f.status}</span></td>
                  <td>
                    {f.status !== 'paid' && <button className="pay-btn" onClick={() => markPaid(f.id)}>✅ Mark Paid</button>}
                    <button className="del-btn" onClick={() => deleteFee(f.id)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💳 Add Fee Invoice</div>
            <label className="form-label">Student</label>
            <select className="form-input" value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}>
              <option value="">Select student (optional)</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <label className="form-label">Fee Title *</label>
            <input className="form-input" placeholder="e.g. Monthly Tuition - January" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <label className="form-label">Amount ($) *</label>
            <input className="form-input" type="number" placeholder="e.g. 250" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addFee} disabled={saving}>{saving ? 'Saving...' : 'Create Invoice'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
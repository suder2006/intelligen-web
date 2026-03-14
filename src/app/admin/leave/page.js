'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills & Progress', icon: '🎯' },
  { href: '/admin/leave', label: 'Leave Management', icon: '🏖️' },
]

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Annual Leave', 'Emergency Leave']
const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

export default function AdminLeavePage() {
  const [view, setView] = useState('requests') // requests | balances | absences | calendar
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState([])
  const [balances, setBalances] = useState([])
  const [absences, setAbsences] = useState([])
  const [staff, setStaff] = useState([])
  const [filterStatus, setFilterStatus] = useState('pending')
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [showBalanceModal, setShowBalanceModal] = useState(null) // staff object
  const [balanceForm, setBalanceForm] = useState({ casual_total: 12, sick_total: 12, annual_total: 15, emergency_total: 5 })
  const [rejectComment, setRejectComment] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(null)

  useEffect(() => { fetchAll() }, [academicYear])

  const fetchAll = async () => {
    setLoading(true)
    const [lrRes, balRes, absRes, staffRes] = await Promise.all([
      supabase.from('leave_requests').select('*, profiles!leave_requests_staff_id_fkey(full_name, role)').order('created_at', { ascending: false }),
      supabase.from('leave_balances').select('*, profiles(full_name)').eq('academic_year', academicYear),
      supabase.from('student_absences').select('*, students(full_name, program), profiles(full_name)').order('absence_date', { ascending: false }).limit(100),
      supabase.from('profiles').select('*').in('role', ['teacher', 'staff', 'school_admin']).order('full_name')
    ])
   
    setLeaveRequests(lrRes.data || [])
    setBalances(balRes.data || [])
    setAbsences(absRes.data || [])
    setStaff(staffRes.data || [])
    setLoading(false)
  }

  const approveLeave = async (leave) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('leave_requests').update({
      status: 'approved', approved_by: user.id, approved_at: new Date().toISOString()
    }).eq('id', leave.id)

    // Update leave balance
    const bal = balances.find(b => b.staff_id === leave.staff_id && b.academic_year === leave.academic_year)
    if (bal) {
      const field = leave.leave_type === 'Casual Leave' ? 'casual_used' : leave.leave_type === 'Sick Leave' ? 'sick_used' : leave.leave_type === 'Annual Leave' ? 'annual_used' : 'emergency_used'
      await supabase.from('leave_balances').update({ [field]: (bal[field] || 0) + leave.no_of_days }).eq('id', bal.id)
    }

    // Notify staff via chat
    await supabase.from('chat_messages').insert({
      sender_id: user.id, receiver_id: leave.staff_id,
      sender_name: 'Admin',
      content: `✅ Your ${leave.leave_type} from ${leave.from_date} to ${leave.to_date} (${leave.no_of_days} day${leave.no_of_days > 1 ? 's' : ''}) has been APPROVED.`
    })
    await fetchAll()
    setSaving(false)
  }

  const rejectLeave = async () => {
    if (!showRejectModal) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('leave_requests').update({
      status: 'rejected', admin_comment: rejectComment,
      approved_by: user.id, approved_at: new Date().toISOString()
    }).eq('id', showRejectModal.id)

    await supabase.from('chat_messages').insert({
      sender_id: user.id, receiver_id: showRejectModal.staff_id,
      sender_name: 'Admin',
      content: `❌ Your ${showRejectModal.leave_type} from ${showRejectModal.from_date} to ${showRejectModal.to_date} has been REJECTED.${rejectComment ? ` Reason: ${rejectComment}` : ''}`
    })
    setShowRejectModal(null)
    setRejectComment('')
    await fetchAll()
    setSaving(false)
  }

  const saveBalance = async () => {
    if (!showBalanceModal) return
    setSaving(true)
    const existing = balances.find(b => b.staff_id === showBalanceModal.id && b.academic_year === academicYear)
    if (existing) {
      await supabase.from('leave_balances').update(balanceForm).eq('id', existing.id)
    } else {
      await supabase.from('leave_balances').insert({ ...balanceForm, staff_id: showBalanceModal.id, academic_year: academicYear, casual_used: 0, sick_used: 0, annual_used: 0, emergency_used: 0 })
    }
    setShowBalanceModal(null)
    await fetchAll()
    setSaving(false)
  }

  const setupAllBalances = async () => {
    if (!confirm(`Setup default leave balances for all staff for ${academicYear}?`)) return
    setSaving(true)
    for (const s of staff) {
      const existing = balances.find(b => b.staff_id === s.id && b.academic_year === academicYear)
      if (!existing) {
        await supabase.from('leave_balances').insert({
          staff_id: s.id, academic_year: academicYear,
          casual_total: 12, casual_used: 0,
          sick_total: 12, sick_used: 0,
          annual_total: 15, annual_used: 0,
          emergency_total: 5, emergency_used: 0
        })
      }
    }
    await fetchAll()
    setSaving(false)
    alert('Leave balances set up for all staff!')
  }

  const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' }
  const statusBg = { pending: 'rgba(245,158,11,0.15)', approved: 'rgba(16,185,129,0.15)', rejected: 'rgba(239,68,68,0.15)' }
  const filteredRequests = leaveRequests.filter(r => filterStatus === 'all' ? true : r.status === filterStatus)
  const calendarAbsences = absences.filter(a => a.absence_date?.startsWith(filterMonth))
  const calendarLeaves = leaveRequests.filter(r => r.status === 'approved' && (r.from_date?.startsWith(filterMonth) || r.to_date?.startsWith(filterMonth)))

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .filter-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/leave' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🏖️ Leave Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Staff leaves, student absences & balances</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
              style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
              {[CURRENT_AY, `${new Date().getFullYear()-1}-${new Date().getFullYear()}`].map(ay => <option key={ay} value={ay}>{ay}</option>)}
            </select>
            <button onClick={setupAllBalances} disabled={saving} className="btn-secondary">⚡ Setup Balances</button>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Pending', value: leaveRequests.filter(r => r.status === 'pending').length, color: '#f59e0b' },
            { label: 'Approved', value: leaveRequests.filter(r => r.status === 'approved').length, color: '#10b981' },
            { label: 'Rejected', value: leaveRequests.filter(r => r.status === 'rejected').length, color: '#ef4444' },
            { label: "Today's Absences", value: absences.filter(a => a.absence_date === new Date().toISOString().split('T')[0]).length, color: '#a78bfa' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
          {[['requests', '📋 Leave Requests'], ['balances', '⚖️ Leave Balances'], ['absences', '👶 Student Absences'], ['calendar', '📅 Calendar']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* LEAVE REQUESTS */}
            {view === 'requests' && (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {['pending', 'approved', 'rejected', 'all'].map(s => (
                    <button key={s} className={`filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'all' ? leaveRequests.length : leaveRequests.filter(r => r.status === s).length})
                    </button>
                  ))}
                </div>
                {filteredRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No {filterStatus} leave requests.</div>
                ) : filteredRequests.map(req => (
                  <div key={req.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{req.profiles?.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{req.leave_type} · {req.no_of_days} day{req.no_of_days > 1 ? 's' : ''}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📅 {req.from_date} → {req.to_date}</div>
                        {req.reason && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>Reason: {req.reason}</div>}
                        {req.admin_comment && <div style={{ color: '#f87171', fontSize: '13px', marginTop: '4px' }}>Comment: {req.admin_comment}</div>}
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>{new Date(req.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span className="badge" style={{ background: statusBg[req.status], color: statusColor[req.status] }}>{req.status}</span>
                        {req.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => approveLeave(req)} disabled={saving}
                              style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>✅ Approve</button>
                            <button onClick={() => setShowRejectModal(req)}
                              style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>❌ Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* LEAVE BALANCES */}
            {view === 'balances' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '16px' }}>
                  Click on a staff member to set/edit their leave balance for {academicYear}
                </div>
                {staff.map(s => {
                  const bal = balances.find(b => b.staff_id === s.id)
                  return (
                    <div key={s.id} className="card" style={{ cursor: 'pointer' }} onClick={() => {
                      setShowBalanceModal(s)
                      setBalanceForm(bal ? { casual_total: bal.casual_total, sick_total: bal.sick_total, annual_total: bal.annual_total, emergency_total: bal.emergency_total } : { casual_total: 12, sick_total: 12, annual_total: 15, emergency_total: 5 })
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700' }}>{s.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.role}</div>
                        </div>
                        {bal ? (
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {[
                              { label: 'CL', used: bal.casual_used, total: bal.casual_total, color: '#38bdf8' },
                              { label: 'SL', used: bal.sick_used, total: bal.sick_total, color: '#a78bfa' },
                              { label: 'AL', used: bal.annual_used, total: bal.annual_total, color: '#10b981' },
                              { label: 'EL', used: bal.emergency_used, total: bal.emergency_total, color: '#f59e0b' },
                            ].map(item => (
                              <div key={item.label} style={{ textAlign: 'center' }}>
                                <div style={{ color: item.color, fontWeight: '700', fontSize: '16px' }}>{item.total - item.used}/{item.total}</div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{item.label} left</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '13px' }}>⚠️ Not configured · Click to set up</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* STUDENT ABSENCES */}
            {view === 'absences' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>👶 Student Absence Notifications</h3>
                  <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                {absences.filter(a => a.absence_date?.startsWith(filterMonth)).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No absence notifications for this month.</div>
                ) : absences.filter(a => a.absence_date?.startsWith(filterMonth)).map(ab => (
                  <div key={ab.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '700' }}>{ab.students?.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px' }}>{ab.students?.program} · 📅 {ab.absence_date}</div>
                        {ab.reason && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>Reason: {ab.reason}</div>}
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>Notified by: {ab.profiles?.full_name}</div>
                      </div>
                      <span className="badge" style={{ background: ab.acknowledged ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: ab.acknowledged ? '#34d399' : '#fbbf24' }}>
                        {ab.acknowledged ? '✅ Acknowledged' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* CALENDAR */}
            {view === 'calendar' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>📅 Leave Calendar</h3>
                  <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✅ Approved Staff Leave</span>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>👶 Student Absence</span>
                </div>
                {calendarLeaves.length === 0 && calendarAbsences.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No leaves or absences for {filterMonth}.</div>
                ) : (
                  <>
                    {calendarLeaves.length > 0 && (
                      <>
                        <h4 style={{ color: '#34d399', marginBottom: '12px', fontSize: '14px' }}>✅ Staff on Leave</h4>
                        {calendarLeaves.map(req => (
                          <div key={req.id} className="card" style={{ borderColor: 'rgba(16,185,129,0.2)', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <div style={{ fontWeight: '600' }}>{req.profiles?.full_name}</div>
                                <div style={{ color: '#34d399', fontSize: '13px' }}>{req.leave_type} · {req.from_date} → {req.to_date} ({req.no_of_days} days)</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {calendarAbsences.length > 0 && (
                      <>
                        <h4 style={{ color: '#a78bfa', marginBottom: '12px', fontSize: '14px', marginTop: '16px' }}>👶 Student Absences</h4>
                        {calendarAbsences.map(ab => (
                          <div key={ab.id} className="card" style={{ borderColor: 'rgba(167,139,250,0.2)', marginBottom: '10px' }}>
                            <div style={{ fontWeight: '600' }}>{ab.students?.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px' }}>{ab.students?.program} · {ab.absence_date}</div>
                            {ab.reason && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Reason: {ab.reason}</div>}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>❌ Reject Leave</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>{showRejectModal.profiles?.full_name} · {showRejectModal.leave_type} · {showRejectModal.from_date} → {showRejectModal.to_date}</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Reason for rejection (optional)</label>
            <input value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder='e.g. Insufficient staff coverage...' style={inputStyle} autoFocus />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRejectModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={rejectLeave} disabled={saving}
                style={{ background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {saving ? 'Rejecting...' : 'Reject Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Modal */}
      {showBalanceModal && (
        <div className="modal-overlay" onClick={() => setShowBalanceModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>⚖️ Set Leave Balance</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showBalanceModal.full_name} · {academicYear}</p>
            {[['casual_total', 'Casual Leave (CL)'], ['sick_total', 'Sick Leave (SL)'], ['annual_total', 'Annual Leave (AL)'], ['emergency_total', 'Emergency Leave (EL)']].map(([field, label]) => (
              <div key={field}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>{label} (days)</label>
                <input type='number' value={balanceForm[field]} onChange={e => setBalanceForm({ ...balanceForm, [field]: parseInt(e.target.value) })} style={inputStyle} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBalanceModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveBalance} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Balance'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
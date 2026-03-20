'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'



const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/staff-groups', label: 'Staff Groups', icon: '⏰' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
  { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
]

export default function AdminCheckinPage() {
  const [view, setView] = useState('today') // today | staff | students | monthly
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [staffAttendance, setStaffAttendance] = useState([])
  const [studentCheckins, setStudentCheckins] = useState([])
  const [staff, setStaff] = useState([])
  const [students, setStudents] = useState([])
  const [showQR, setShowQR] = useState(false)
  const [manualForm, setManualForm] = useState({ staff_id: '', status: 'present', date: new Date().toISOString().split('T')[0] })
  const [showManualForm, setShowManualForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [schoolToken, setSchoolToken] = useState('')

  const { schoolId, schoolName } = useSchool()
  useEffect(() => {
    if (!schoolId) return
    supabase.from('school_qr_tokens').select('token').eq('school_id', schoolId).single()
      .then(({ data }) => setSchoolToken(data?.token || ''))
  }, [schoolId])

  useEffect(() => { if (schoolId) fetchAll() }, [date, schoolId])

const fetchAll = async () => {
    setLoading(true)
    const [saRes, scRes, staffRes, studRes] = await Promise.all([
      supabase.from('staff_attendance').select('*, profiles(full_name, role, staff_type_groups(name))').eq('date', date).order('checkin_time'),
      supabase.from('student_checkins').select('*, students(full_name, program)').eq('date', date).order('checkin_time'),
      supabase.from('profiles').select('*').in('role', ['teacher', 'staff']).eq('school_id', schoolId).order('full_name'),
      supabase.from('students').select('*').eq('status', 'active').eq('school_id', schoolId).order('full_name')
    ])
    setStaffAttendance(saRes.data || [])
    setStudentCheckins(scRes.data || [])
    setStaff(staffRes.data || [])
    setStudents(studRes.data || [])
    setLoading(false)
  }

  const manualStaffCheckin = async (staffId, status) => {
    setSaving(true)
    const existing = staffAttendance.find(a => a.staff_id === staffId)
    if (existing) {
      await supabase.from('staff_attendance').update({ status, admin_override: true }).eq('id', existing.id)
    } else {
      await supabase.from('staff_attendance').insert({
        staff_id: staffId, date, status,
        marked_by: 'admin', admin_override: true, school_id: schoolId
      })
    }
    await fetchAll()
    setSaving(false)
  }

  const manualStudentCheckin = async (studentId) => {
    setSaving(true)
    const now = new Date()
    const existing = studentCheckins.find(c => c.student_id === studentId)
    if (!existing) {
      await supabase.from('student_checkins').insert({
        student_id: studentId, date,
        checkin_time: now.toISOString(),
        checkin_method: 'manual', school_id: schoolId
      })
      const { data: attExisting } = await supabase.from('attendance').select('id').eq('student_id', studentId).eq('date', date).single()
      if (!attExisting) {
        await supabase.from('attendance').insert({ student_id: studentId, date, status: 'present', checked_in_at: now.toISOString() })
      }
    } else if (!existing.checkout_time) {
      await supabase.from('student_checkins').update({ checkout_time: now.toISOString(), checkout_method: 'manual' }).eq('id', existing.id)
    }
    await fetchAll()
    setSaving(false)
  }

  const exportMonthlyReport = () => {
    // CSV export
    const headers = ['Date', 'Staff Name', 'Role', 'Check-in', 'Check-out', 'Status', 'Working Hours', 'Method']
    const rows = staffAttendance.map(a => [
      a.date, a.profiles?.full_name, a.profiles?.role,
      a.checkin_time ? new Date(a.checkin_time).toLocaleTimeString() : '—',
      a.checkout_time ? new Date(a.checkout_time).toLocaleTimeString() : '—',
      a.status, a.working_hours || 0, a.marked_by
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `staff-attendance-${date}.csv`; a.click()
  }

  const statusColor = { present: '#10b981', late: '#f59e0b', half_day: '#38bdf8', absent: '#ef4444', early: '#a78bfa' }
  const statusBg = { present: 'rgba(16,185,129,0.15)', late: 'rgba(245,158,11,0.15)', half_day: 'rgba(56,189,248,0.15)', absent: 'rgba(239,68,68,0.15)', early: 'rgba(167,139,250,0.15)' }

  const gateQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://intelligen-web.vercel.app/checkin?token=${schoolToken}`)}`
  const checkinUrl = `https://intelligen-web.vercel.app/checkin?token=${schoolToken}`

  const presentStaff = staffAttendance.filter(a => a.status === 'present').length
  const lateStaff = staffAttendance.filter(a => a.status === 'late').length
  const absentStaff = staff.length - staffAttendance.length
  const insideStudents = studentCheckins.filter(c => c.checkin_time && !c.checkout_time).length

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
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 400px; text-align: center; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/checkin' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🚪 Check-in / Check-out</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Staff & student attendance tracking</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type='date' value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
            <button onClick={() => setShowQR(true)} className="btn-secondary">📱 Show Gate QR</button>
            <button onClick={exportMonthlyReport} className="btn-secondary">📥 Export</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: '✅ Staff Present', value: presentStaff, color: '#10b981' },
            { label: '⏰ Staff Late', value: lateStaff, color: '#f59e0b' },
            { label: '❌ Staff Absent', value: absentStaff, color: '#ef4444' },
            { label: '👶 Students In', value: insideStudents, color: '#38bdf8' },
            { label: '🏫 Checked Out', value: studentCheckins.filter(c => c.checkout_time).length, color: '#a78bfa' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['staff', '👩‍🏫 Staff'], ['students', '👶 Students']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* STAFF VIEW */}
            {view === 'staff' && (
              <>
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  Staff check in by scanning the gate QR. Admin can also override status manually.
                </div>
                {staff.map(s => {
                  const record = staffAttendance.find(a => a.staff_id === s.id)
                  return (
                    <div key={s.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>{s.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.role}</div>
                          {record && (
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>
                              {record.checkin_time && `In: ${new Date(record.checkin_time).toLocaleTimeString()}`}
                              {record.checkout_time && ` · Out: ${new Date(record.checkout_time).toLocaleTimeString()}`}
                              {record.working_hours > 0 && ` · ${record.working_hours}h`}
                              {record.admin_override && ' · (Admin)'}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {record ? (
                            <span className="badge" style={{ background: statusBg[record.status] || statusBg.absent, color: statusColor[record.status] || statusColor.absent }}>{record.status}</span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>absent</span>
                          )}
                          {/* Admin override buttons */}
                          {['present', 'late', 'half_day', 'absent'].map(st => (
                            <button key={st} onClick={() => manualStaffCheckin(s.id, st)} disabled={saving}
                              style={{ padding: '4px 10px', background: record?.status === st ? statusBg[st] : 'transparent', border: `1px solid ${record?.status === st ? statusColor[st] : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', color: record?.status === st ? statusColor[st] : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* STUDENTS VIEW */}
            {view === 'students' && (
              <>
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  Students check in when parent scans their QR. Admin can manually check in/out below.
                </div>
                {students.map(s => {
                  const record = studentCheckins.find(c => c.student_id === s.id)
                  const isInside = record?.checkin_time && !record?.checkout_time
                  return (
                    <div key={s.id} className="card" style={{ borderColor: isInside ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>{s.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.program}</div>
                          {record && (
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>
                              {record.checkin_time && `In: ${new Date(record.checkin_time).toLocaleTimeString()} (${record.checkin_method})`}
                              {record.checkout_time && ` · Out: ${new Date(record.checkout_time).toLocaleTimeString()}`}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="badge" style={{ background: isInside ? 'rgba(16,185,129,0.15)' : record ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)', color: isInside ? '#34d399' : record ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
                            {isInside ? '🏫 Inside' : record ? '🏠 Gone Home' : 'Not Arrived'}
                          </span>
                          <button onClick={() => manualStudentCheckin(s.id)} disabled={saving || (record?.checkin_time && record?.checkout_time)}
                            style={{ padding: '6px 12px', background: isInside ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.15)', border: `1px solid ${isInside ? 'rgba(167,139,250,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '8px', color: isInside ? '#a78bfa' : '#34d399', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                            {isInside ? '👋 Check Out' : '✅ Check In'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Gate QR Modal */}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>📱 Gate QR Code</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>Print this and place at school entrance. Staff scan to check in/out.</p>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', display: 'inline-block', marginBottom: '16px' }}>
              <img src={gateQRUrl} alt='Gate QR' style={{ width: '250px', height: '250px', display: 'block' }} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '16px', wordBreak: 'break-all' }}>{checkinUrl}</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => window.open(gateQRUrl, '_blank')} className="btn-secondary">⬇️ Download QR</button>
              <button onClick={() => window.print()} className="btn-secondary">🖨️ Print</button>
              <button onClick={() => setShowQR(false)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
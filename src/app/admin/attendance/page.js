'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'

export default function AttendancePage() {
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  const { schoolId } = useSchool()

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
    { href: '/admin/settings', label: 'School Settings', icon: '⚙️' },
  ]

  useEffect(() => { if (schoolId) fetchData() }, [date, schoolId])

  const fetchData = async () => {
    setLoading(true)
    const [s, a] = await Promise.all([
      supabase.from('students').select('*').eq('status', 'active').eq('school_id', schoolId).order('full_name'),
      supabase.from('attendance').select('*').eq('date', date)
    ])
    setStudents(s.data || [])
    setAttendance(a.data || [])
    setLoading(false)
  }

  const getStatus = (studentId) => {
    const rec = attendance.find(a => a.student_id === studentId)
    return rec?.status || null
  }

  const markAttendance = async (studentId, status) => {
    const existing = attendance.find(a => a.student_id === studentId)
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert([{ student_id: studentId, date, status, checked_in_at: new Date().toISOString() }])
    }
    fetchData()
  }

  const markAll = async (status) => {
    setSaving(true)
    for (const student of students) {
      await markAttendance(student.id, status)
    }
    setSaving(false)
  }

  const present = attendance.filter(a => a.status === 'present').length
  const absent = attendance.filter(a => a.status === 'absent').length
  const late = attendance.filter(a => a.status === 'late').length
  const notMarked = students.length - attendance.length

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
        .date-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 14px; color: #fff; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; }
        .summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .sum-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; text-align: center; }
        .sum-value { font-size: 28px; font-weight: 700; }
        .sum-label { color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 4px; }
        .bulk-btns { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .bulk-btn { padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 14px 20px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        td { padding: 14px 20px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
        tr:last-child td { border-bottom: none; }
        .att-btns { display: flex; gap: 6px; }
        .att-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid transparent; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; transition: all 0.15s; }
        .att-btn.present { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #34d399; }
        .att-btn.present.active { background: #10b981; color: #fff; }
        .att-btn.absent { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #f87171; }
        .att-btn.absent.active { background: #ef4444; color: #fff; }
        .att-btn.late { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
        .att-btn.late.active { background: #f59e0b; color: #fff; }
        .avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; }
        .empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/attendance' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">✅ Attendance</div>
            <div className="page-sub">{students.length} students enrolled</div>
          </div>
          <input className="date-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="summary">
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#10b981' }}>{present}</div>
            <div className="sum-label">✅ Present</div>
          </div>
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#ef4444' }}>{absent}</div>
            <div className="sum-label">❌ Absent</div>
          </div>
          <div className="sum-card">
            <div className="sum-value" style={{ color: '#f59e0b' }}>{late}</div>
            <div className="sum-label">⏰ Late</div>
          </div>
          <div className="sum-card">
            <div className="sum-value" style={{ color: 'rgba(255,255,255,0.4)' }}>{notMarked}</div>
            <div className="sum-label">⬜ Not Marked</div>
          </div>
        </div>

        {students.length > 0 && (
          <div className="bulk-btns">
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', alignSelf: 'center' }}>Mark all as:</span>
            <button className="bulk-btn" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }} onClick={() => markAll('present')} disabled={saving}>✅ All Present</button>
            <button className="bulk-btn" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }} onClick={() => markAll('absent')} disabled={saving}>❌ All Absent</button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Mark Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="empty">Loading...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={3} className="empty">No active students. Add students first!</td></tr>
              ) : students.map(s => {
                const status = getStatus(s.id)
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar">{s.full_name?.[0]?.toUpperCase()}</div>
                        <span style={{ fontWeight: 500 }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="att-btns">
                        <button className={`att-btn present ${status === 'present' ? 'active' : ''}`} onClick={() => markAttendance(s.id, 'present')}>✅ Present</button>
                        <button className={`att-btn absent ${status === 'absent' ? 'active' : ''}`} onClick={() => markAttendance(s.id, 'absent')}>❌ Absent</button>
                        <button className={`att-btn late ${status === 'late' ? 'active' : ''}`} onClick={() => markAttendance(s.id, 'late')}>⏰ Late</button>
                      </div>
                    </td>
                    <td>
                      {status ? (
                        <span style={{
                          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                          background: status === 'present' ? 'rgba(16,185,129,0.15)' : status === 'absent' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: status === 'present' ? '#34d399' : status === 'absent' ? '#f87171' : '#fbbf24'
                        }}>{status}</span>
                      ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>not marked</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
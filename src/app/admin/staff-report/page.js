'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
  { href: '/admin/staff-report', label: 'Staff Report', icon: '📋' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
]

export default function StaffAttendanceReport() {
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState([])
  const [staffAttendance, setStaffAttendance] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [groups, setGroups] = useState([])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterGroup, setFilterGroup] = useState('all')
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [view, setView] = useState('summary') // summary | detail | daily

  useEffect(() => { fetchAll() }, [filterMonth])

  const fetchAll = async () => {
    setLoading(true)
    const monthStart = `${filterMonth}-01`
    const monthEnd = `${filterMonth}-31`
    const [staffRes, attRes, leaveRes, grpRes] = await Promise.all([
      supabase.from('profiles').select('*, staff_type_groups(name)').in('role', ['teacher', 'staff', 'school_admin']).order('full_name'),
      supabase.from('staff_attendance').select('*').gte('date', monthStart).lte('date', monthEnd).order('date'),
      supabase.from('leave_requests').select('*').eq('status', 'approved').gte('from_date', monthStart).lte('to_date', monthEnd),
      supabase.from('staff_type_groups').select('*').order('name')
    ])
    setStaff(staffRes.data || [])
    setStaffAttendance(attRes.data || [])
    setLeaveRequests(leaveRes.data || [])
    setGroups(grpRes.data || [])
    setLoading(false)
  }

  // Get working days in month (Mon-Sat, excluding Sun)
  const getWorkingDays = () => {
    const [year, month] = filterMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    let workingDays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay()
      if (day !== 0) workingDays++ // exclude Sunday
    }
    return workingDays
  }

  const getStaffStats = (staffId) => {
    const records = staffAttendance.filter(a => a.staff_id === staffId)
    const leaves = leaveRequests.filter(l => l.staff_id === staffId)
    const present = records.filter(a => a.status === 'present').length
    const late = records.filter(a => a.status === 'late').length
    const halfDay = records.filter(a => a.status === 'half_day').length
    const leaveDays = leaves.reduce((s, l) => s + l.no_of_days, 0)
    const workingDays = getWorkingDays()
    const absent = workingDays - present - late - halfDay - leaveDays
    const totalHours = records.reduce((s, a) => s + Number(a.working_hours || 0), 0)
    const avgHours = records.length > 0 ? (totalHours / records.length).toFixed(1) : 0
    return { present, late, halfDay, leaveDays, absent: Math.max(0, absent), totalHours: totalHours.toFixed(1), avgHours, workingDays, records }
  }

  const getAllDates = () => {
    const [year, month] = filterMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const dates = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${filterMonth}-${String(d).padStart(2, '0')}`
      const dayOfWeek = new Date(year, month - 1, d).getDay()
      if (dayOfWeek !== 0) dates.push({ date, dayName: new Date(year, month - 1, d).toLocaleDateString('en-IN', { weekday: 'short' }) })
    }
    return dates
  }

  const exportExcel = () => {
    const workingDays = getWorkingDays()
    const headers = ['Staff Name', 'Role', 'Group', 'Working Days', 'Present', 'Late', 'Half Day', 'Leave', 'Absent', 'Total Hours', 'Avg Hours/Day']
    const filteredStaff = filterGroup === 'all' ? staff : staff.filter(s => s.staff_group_id === filterGroup)
    const rows = filteredStaff.map(s => {
      const stats = getStaffStats(s.id)
      return [s.full_name, s.role, s.staff_type_groups?.name || '—', workingDays, stats.present, stats.late, stats.halfDay, stats.leaveDays, stats.absent, stats.totalHours, stats.avgHours]
    })
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `staff-attendance-${filterMonth}.csv`; a.click()
  }

  const exportDetailedExcel = (s) => {
    const stats = getStaffStats(s.id)
    const headers = ['Date', 'Day', 'Status', 'Check-in', 'Check-out', 'Working Hours', 'Method']
    const dates = getAllDates()
    const rows = dates.map(({ date, dayName }) => {
      const record = stats.records.find(r => r.date === date)
      const leave = leaveRequests.find(l => l.staff_id === s.id && date >= l.from_date && date <= l.to_date)
      return [
        date, dayName,
        leave ? 'On Leave' : record?.status || 'absent',
        record?.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '—',
        record?.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '—',
        record?.working_hours || 0,
        record?.marked_by || '—'
      ]
    })
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${s.full_name}-attendance-${filterMonth}.csv`; a.click()
  }

  const filteredStaff = filterGroup === 'all' ? staff : staff.filter(s => s.staff_group_id === filterGroup)
  const workingDays = getWorkingDays()
  const dates = getAllDates()

  const statusColor = { present: '#10b981', late: '#f59e0b', half_day: '#38bdf8', absent: '#ef4444', 'On Leave': '#a78bfa' }
  const statusBg = { present: 'rgba(16,185,129,0.15)', late: 'rgba(245,158,11,0.15)', half_day: 'rgba(56,189,248,0.15)', absent: 'rgba(239,68,68,0.15)', 'On Leave': 'rgba(167,139,250,0.15)' }
  const statusEmoji = { present: '✅', late: '⏰', half_day: '🌓', absent: '❌', 'On Leave': '🏖️' }

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
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 12px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); white-space: nowrap; }
        td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); white-space: nowrap; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .progress-bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; min-width: 60px; }
        .progress-fill { height: 100%; border-radius: 4px; }
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .main { margin-left: 0 !important; padding: 20px !important; }
          body { background: white !important; color: black !important; }
          th { color: #333 !important; background: #f5f5f5 !important; }
          td { color: #333 !important; border-color: #eee !important; }
        }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/staff-report' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📋 Staff Attendance Report</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Monthly attendance summary with check-in/out details</p>
          </div>
          <div className="print-hide" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => window.print()} className="btn-secondary">🖨️ Print</button>
            <button onClick={exportExcel} className="btn-secondary">📥 Export Excel</button>
          </div>
        </div>

        {/* Filters */}
        <div className="print-hide" style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Month</label>
            <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
          </div>
          <div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Group</label>
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
              style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
              <option value='all'>All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '18px' }}>
            📅 {workingDays} working days this month
          </div>
        </div>

        {/* View Tabs */}
        <div className="print-hide" style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['summary', '📊 Summary'], ['detail', '📅 Daily Detail'], ['daily', '🗓️ Day View']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => { setView(v); setSelectedStaff(null) }}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* SUMMARY VIEW */}
            {view === 'summary' && (
              <>
                {/* Overall stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total Staff', value: filteredStaff.length, color: '#38bdf8' },
                    { label: 'Working Days', value: workingDays, color: '#a78bfa' },
                    { label: 'Avg Present %', value: `${filteredStaff.length > 0 ? Math.round(filteredStaff.reduce((s, st) => { const stats = getStaffStats(st.id); return s + (stats.present / workingDays * 100) }, 0) / filteredStaff.length) : 0}%`, color: '#10b981' },
                    { label: 'Total Leave Days', value: leaveRequests.reduce((s, l) => s + l.no_of_days, 0), color: '#f59e0b' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Group-wise summary */}
                {filterGroup === 'all' && groups.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>📊 Group-wise Summary</h3>
                    <div className="table-wrap" style={{ marginBottom: '24px' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Group</th>
                            <th>Staff</th>
                            <th>Avg Present</th>
                            <th>Avg Late</th>
                            <th>Avg Absent</th>
                            <th>Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groups.map(grp => {
                            const grpStaff = staff.filter(s => s.staff_group_id === grp.id)
                            if (grpStaff.length === 0) return null
                            const avgPresent = grpStaff.reduce((s, st) => s + getStaffStats(st.id).present, 0) / grpStaff.length
                            const avgLate = grpStaff.reduce((s, st) => s + getStaffStats(st.id).late, 0) / grpStaff.length
                            const avgAbsent = grpStaff.reduce((s, st) => s + getStaffStats(st.id).absent, 0) / grpStaff.length
                            const pct = Math.round((avgPresent + avgLate) / workingDays * 100)
                            return (
                              <tr key={grp.id}>
                                <td style={{ fontWeight: '600', color: '#a78bfa' }}>{grp.name}</td>
                                <td>{grpStaff.length}</td>
                                <td style={{ color: '#10b981' }}>{avgPresent.toFixed(1)}</td>
                                <td style={{ color: '#f59e0b' }}>{avgLate.toFixed(1)}</td>
                                <td style={{ color: '#ef4444' }}>{avgAbsent.toFixed(1)}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="progress-bar">
                                      <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444' }} />
                                    </div>
                                    <span style={{ color: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Staff Summary Table */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>👩‍🏫 Staff-wise Summary — {filterMonth}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff Name</th>
                        <th>Group</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Half Day</th>
                        <th>Leave</th>
                        <th>Absent</th>
                        <th>Total Hours</th>
                        <th>Avg Hrs/Day</th>
                        <th>Attendance %</th>
                        <th className="print-hide">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map(s => {
                        const stats = getStaffStats(s.id)
                        const pct = Math.round(((stats.present + stats.late) / workingDays) * 100)
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '600' }}>{s.full_name}</td>
                            <td style={{ color: '#a78bfa', fontSize: '12px' }}>{s.staff_type_groups?.name || '—'}</td>
                            <td><span className="badge" style={{ background: statusBg.present, color: statusColor.present }}>{stats.present}</span></td>
                            <td><span className="badge" style={{ background: statusBg.late, color: statusColor.late }}>{stats.late}</span></td>
                            <td><span className="badge" style={{ background: statusBg.half_day, color: statusColor.half_day }}>{stats.halfDay}</span></td>
                            <td><span className="badge" style={{ background: statusBg['On Leave'], color: statusColor['On Leave'] }}>{stats.leaveDays}</span></td>
                            <td><span className="badge" style={{ background: statusBg.absent, color: statusColor.absent }}>{stats.absent}</span></td>
                            <td style={{ color: '#38bdf8' }}>{stats.totalHours}h</td>
                            <td style={{ color: 'rgba(255,255,255,0.5)' }}>{stats.avgHours}h</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="progress-bar">
                                  <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ color: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444', fontSize: '12px', fontWeight: '600' }}>{pct}%</span>
                              </div>
                            </td>
                            <td className="print-hide">
                              <button onClick={() => { setSelectedStaff(s); setView('detail') }}
                                style={{ padding: '4px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>
                                View →
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* DAILY DETAIL VIEW - per staff */}
            {view === 'detail' && (
              <>
                <div className="print-hide" style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={selectedStaff?.id || ''} onChange={e => setSelectedStaff(staff.find(s => s.id === e.target.value) || null)}
                    style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', minWidth: '220px' }}>
                    <option value=''>-- Select Staff --</option>
                    {filteredStaff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  {selectedStaff && (
                    <button onClick={() => exportDetailedExcel(selectedStaff)} className="btn-secondary">📥 Export {selectedStaff.full_name}</button>
                  )}
                </div>

                {selectedStaff ? (() => {
                  const stats = getStaffStats(selectedStaff.id)
                  const pct = Math.round(((stats.present + stats.late) / workingDays) * 100)
                  return (
                    <>
                      {/* Staff header */}
                      <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>{selectedStaff.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '14px' }}>{selectedStaff.staff_type_groups?.name || selectedStaff.role} · {filterMonth}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            {[
                              { label: 'Present', value: stats.present, color: '#10b981' },
                              { label: 'Late', value: stats.late, color: '#f59e0b' },
                              { label: 'Half Day', value: stats.halfDay, color: '#38bdf8' },
                              { label: 'Leave', value: stats.leaveDays, color: '#a78bfa' },
                              { label: 'Absent', value: stats.absent, color: '#ef4444' },
                              { label: 'Total Hrs', value: `${stats.totalHours}h`, color: '#fff' },
                              { label: 'Attendance', value: `${pct}%`, color: pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444' },
                            ].map(item => (
                              <div key={item.label} style={{ textAlign: 'center' }}>
                                <div style={{ color: item.color, fontWeight: '700', fontSize: '18px' }}>{item.value}</div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{item.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Daily records */}
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Day</th>
                              <th>Status</th>
                              <th>Check-in</th>
                              <th>Check-out</th>
                              <th>Hours</th>
                              <th>Method</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dates.map(({ date, dayName }) => {
                              const record = stats.records.find(r => r.date === date)
                              const leave = leaveRequests.find(l => l.staff_id === selectedStaff.id && date >= l.from_date && date <= l.to_date)
                              const status = leave ? 'On Leave' : record?.status || 'absent'
                              return (
                                <tr key={date} style={{ background: status === 'absent' ? 'rgba(239,68,68,0.03)' : status === 'On Leave' ? 'rgba(167,139,250,0.03)' : 'transparent' }}>
                                  <td style={{ fontWeight: '500' }}>{date}</td>
                                  <td style={{ color: 'rgba(255,255,255,0.4)' }}>{dayName}</td>
                                  <td><span className="badge" style={{ background: statusBg[status] || statusBg.absent, color: statusColor[status] || statusColor.absent }}>{statusEmoji[status]} {status}</span></td>
                                  <td style={{ color: '#10b981' }}>{record?.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '—'}</td>
                                  <td style={{ color: '#f59e0b' }}>{record?.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '—'}</td>
                                  <td style={{ color: '#38bdf8' }}>{record?.working_hours ? `${record.working_hours}h` : '—'}</td>
                                  <td style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{record?.marked_by || leave ? 'leave' : '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })() : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Select a staff member to view their daily attendance</div>
                )}
              </>
            )}

            {/* DAY VIEW - all staff for a specific day */}
            {view === 'daily' && (
              <>
                <div className="print-hide" style={{ marginBottom: '20px' }}>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Date</label>
                  <input type='date' defaultValue={new Date().toISOString().split('T')[0]}
                    id='day-view-date'
                    style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff Name</th>
                        <th>Group</th>
                        <th>Status</th>
                        <th>Check-in Time</th>
                        <th>Check-out Time</th>
                        <th>Working Hours</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map(s => {
                        const dayInput = typeof document !== 'undefined' ? document.getElementById('day-view-date')?.value : new Date().toISOString().split('T')[0]
                        const record = staffAttendance.find(a => a.staff_id === s.id && a.date === dayInput)
                        const leave = leaveRequests.find(l => l.staff_id === s.id && dayInput >= l.from_date && dayInput <= l.to_date)
                        const status = leave ? 'On Leave' : record?.status || 'absent'
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '600' }}>{s.full_name}</td>
                            <td style={{ color: '#a78bfa', fontSize: '12px' }}>{s.staff_type_groups?.name || '—'}</td>
                            <td><span className="badge" style={{ background: statusBg[status] || statusBg.absent, color: statusColor[status] || statusColor.absent }}>{statusEmoji[status]} {status}</span></td>
                            <td style={{ color: '#10b981' }}>{record?.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '—'}</td>
                            <td style={{ color: '#f59e0b' }}>{record?.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '—'}</td>
                            <td style={{ color: '#38bdf8' }}>{record?.working_hours ? `${record.working_hours}h` : '—'}</td>
                            <td style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{record?.marked_by || (leave ? 'leave' : '—')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
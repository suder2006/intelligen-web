'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSchool } from '@/hooks/useSchool'

export default function CurriculumReportsPage() {
  const router = useRouter()
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [curriculum, setCurriculum] = useState([])
  const [completions, setCompletions] = useState([])
  const [teachers, setTeachers] = useState([])
  const [programs, setPrograms] = useState([])
  const [staffPrograms, setStaffPrograms] = useState([])

  // Filters
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [filterFrom, setFilterFrom] = useState(todayStr)
  const [filterTo, setFilterTo] = useState(todayStr)
  const [filterProgram, setFilterProgram] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [currRes, compRes, teachRes, progRes, spRes] = await Promise.all([
      supabase.from('curriculum').select('*').eq('school_id', schoolId).order('assigned_date'),
      supabase.from('curriculum_completion').select('*, profiles(full_name)'),
      supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).in('role', ['teacher', 'staff']),
      supabase.from('curriculum_masters').select('value').eq('type', 'program').eq('school_id', schoolId).order('value'),
      supabase.from('staff_programs').select('staff_id, program').eq('school_id', schoolId)
    ])
    setCurriculum(currRes.data || [])
    setCompletions(compRes.data || [])
    setTeachers(teachRes.data || [])
    setPrograms(progRes.data?.map(p => p.value) || [])
    setStaffPrograms(spRes.data || [])
    setLoading(false)
  }

  // Get teachers for a program
  const getTeachersForProgram = (program) => {
    const staffIds = staffPrograms.filter(sp => sp.program === program).map(sp => sp.staff_id)
    return teachers.filter(t => staffIds.includes(t.id))
  }

  // Check if curriculum item is completed
  const isCompleted = (currId) => completions.some(c => c.curriculum_id === currId)
  const getCompletion = (currId) => completions.find(c => c.curriculum_id === currId)

  // Get week dates (Mon-Fri)
  const getWeekDates = () => {
    const dates = []
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    for (let i = 0; i < 5; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + daysToMonday + i)
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    return dates
  }

  // Today's stats by program
  const getTodayStats = () => {
    return programs.map(prog => {
      const items = curriculum.filter(c => c.program === prog && c.assigned_date === todayStr)
      const done = items.filter(c => isCompleted(c.id))
      const pct = items.length > 0 ? Math.round((done.length / items.length) * 100) : null
      const progTeachers = getTeachersForProgram(prog)
      return { program: prog, total: items.length, done: done.length, pct, teachers: progTeachers }
    })
  }

  // Weekly stats
  const getWeekStats = () => {
    const weekDates = getWeekDates()
    return weekDates.map(date => {
      const items = curriculum.filter(c => c.assigned_date === date)
      const done = items.filter(c => isCompleted(c.id))
      const pct = items.length > 0 ? Math.round((done.length / items.length) * 100) : null
      const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
      const dayNum = new Date(date + 'T12:00:00').getDate()
      return { date, dayName, dayNum, total: items.length, done: done.length, pct, isToday: date === todayStr }
    })
  }

  // Filtered report data
  const getFilteredData = () => {
    return curriculum.filter(c => {
      const matchDate = c.assigned_date >= filterFrom && c.assigned_date <= filterTo
      const matchProgram = filterProgram ? c.program === filterProgram : true
      const completed = isCompleted(c.id)
      const matchStatus = filterStatus === 'done' ? completed : filterStatus === 'pending' ? !completed : true

      // Match teacher via staff_programs
      let matchTeacher = true
      if (filterTeacher) {
        const teacherPrograms = staffPrograms.filter(sp => sp.staff_id === filterTeacher).map(sp => sp.program)
        matchTeacher = teacherPrograms.includes(c.program)
      }

      return matchDate && matchProgram && matchStatus && matchTeacher
    }).sort((a, b) => a.assigned_date.localeCompare(b.assigned_date))
  }

  const exportCSV = () => {
    const filtered = getFilteredData()
    const headers = ['Date', 'Day', 'Program', 'Activity', 'Time Slot', 'Status', 'Marked At', 'Marked By', 'Teacher(s)']
    const rows = filtered.map(c => {
      const comp = getCompletion(c.id)
      const progTeachers = getTeachersForProgram(c.program).map(t => t.full_name).join(', ')
      const dayName = new Date(c.assigned_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' })
      return [
        c.assigned_date,
        dayName,
        c.program,
        c.planned_activity || c.concept_focus || '—',
        c.time_slot || '—',
        comp ? 'Done' : 'Pending',
        comp ? new Date(comp.completed_at).toLocaleString('en-IN') : '—',
        comp?.profiles?.full_name || '—',
        progTeachers || '—'
      ]
    })
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `curriculum-report-${filterFrom}-to-${filterTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const todayStats = getTodayStats()
  const weekStats = getWeekStats()
  const filteredData = getFilteredData()
  const filteredDone = filteredData.filter(c => isCompleted(c.id)).length
  const filteredPct = filteredData.length > 0 ? Math.round((filteredDone / filteredData.length) * 100) : 0

  const inputStyle = { padding: '8px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px', outline: 'none' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📊 Curriculum Completion Reports</h1>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Track daily and weekly curriculum completion by program and teacher</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <>
            {/* TODAY'S SUMMARY */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'rgba(255,255,255,0.8)' }}>
                📅 Today's Completion —
                <span style={{ color: '#38bdf8', marginLeft: '8px' }}>
                  {new Date(todayStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {todayStats.map(stat => (
                  <div key={stat.program} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${stat.pct === null ? 'rgba(255,255,255,0.07)' : stat.pct === 100 ? 'rgba(16,185,129,0.3)' : stat.pct >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>{stat.program}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                          {stat.teachers.map(t => t.full_name).join(', ') || 'No teacher assigned'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {stat.pct === null ? (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No curriculum</span>
                        ) : (
                          <>
                            <div style={{ fontSize: '22px', fontWeight: '700', color: stat.pct === 100 ? '#10b981' : stat.pct >= 50 ? '#f59e0b' : '#ef4444' }}>
                              {stat.pct}%
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{stat.done}/{stat.total} done</div>
                          </>
                        )}
                      </div>
                    </div>
                    {stat.pct !== null && (
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '4px', width: `${stat.pct}%`, background: stat.pct === 100 ? '#10b981' : stat.pct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* WEEKLY TREND */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'rgba(255,255,255,0.8)' }}>📆 This Week's Trend</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {weekStats.map(day => (
                  <div key={day.date} style={{ background: day.isToday ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${day.isToday ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                    <div style={{ color: day.isToday ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>{day.dayName}</div>
                    <div style={{ color: day.isToday ? '#38bdf8' : 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '10px' }}>{day.dayNum}</div>
                    {day.total === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>—</div>
                    ) : (
                      <>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: day.pct === 100 ? '#10b981' : day.pct >= 50 ? '#f59e0b' : '#ef4444', marginBottom: '4px' }}>
                          {day.pct}%
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '8px' }}>{day.done}/{day.total}</div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '4px', width: `${day.pct}%`, background: day.pct === 100 ? '#10b981' : day.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* DETAILED REPORT */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>📋 Detailed Report</div>
                <button onClick={exportCSV}
                  style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                  📥 Export CSV
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>From Date</div>
                  <input type='date' value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>To Date</div>
                  <input type='date' value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Program</div>
                  <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={inputStyle}>
                    <option value=''>All Programs</option>
                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Teacher</div>
                  <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={inputStyle}>
                    <option value=''>All Teachers</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Status</div>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
                    <option value=''>All</option>
                    <option value='done'>✅ Done</option>
                    <option value='pending'>⏳ Pending</option>
                  </select>
                </div>
                {(filterProgram || filterTeacher || filterStatus) && (
                  <button onClick={() => { setFilterProgram(''); setFilterTeacher(''); setFilterStatus('') }}
                    style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Summary bar */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Total', value: filteredData.length, color: '#38bdf8' },
                  { label: 'Done', value: filteredDone, color: '#10b981' },
                  { label: 'Pending', value: filteredData.length - filteredDone, color: '#ef4444' },
                  { label: 'Completion', value: `${filteredPct}%`, color: filteredPct === 100 ? '#10b981' : filteredPct >= 50 ? '#f59e0b' : '#ef4444' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 16px', textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: item.color }}>{item.value}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Date', 'Day', 'Program', 'Activity', 'Teacher(s)', 'Status', 'Marked At', 'Marked By'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No curriculum found for selected filters.</td></tr>
                    ) : filteredData.map(c => {
                      const comp = getCompletion(c.id)
                      const done = !!comp
                      const progTeachers = getTeachersForProgram(c.program)
                      const dayName = new Date(c.assigned_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: done ? 'rgba(16,185,129,0.02)' : 'transparent' }}>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{c.assigned_date}</td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{dayName}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{c.program}</span>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', maxWidth: '200px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.planned_activity || c.concept_focus || c.circle_time || '—'}
                            </div>
                            {c.time_slot && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{c.time_slot}</div>}
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                            {progTeachers.length > 0
                              ? progTeachers.map(t => t.full_name).join(', ')
                              : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: done ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: done ? '#34d399' : '#f87171' }}>
                              {done ? '✅ Done' : '⏳ Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                            {comp ? new Date(comp.completed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                            {comp?.profiles?.full_name || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
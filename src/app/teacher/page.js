'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TeacherPortal() {
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [curriculum, setCurriculum] = useState([])
  const [completions, setCompletions] = useState([])
  const [currView, setCurrView] = useState('today')
  const [currWeek, setCurrWeek] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(today.setDate(diff)).toISOString().split('T')[0]
  })
  const router = useRouter()

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (!loading) fetchAttendance() }, [date])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    const [s, a] = await Promise.all([
      supabase.from('students').select('*').eq('status', 'active').order('full_name'),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10)
    ])
    setStudents(s.data || [])
    setAnnouncements(a.data || [])
    await fetchCurriculum()
    await fetchAttendance()
    setLoading(false)
  }
  const fetchCurriculum = async () => {
    const weekEnd = new Date(currWeek)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const { data: curr } = await supabase.from('curriculum').select('*')
      .gte('assigned_date', currWeek)
      .lte('assigned_date', weekEnd.toISOString().split('T')[0])
      .order('assigned_date').order('time_slot')
    const { data: comp } = await supabase.from('curriculum_completion').select('*')
    setCurriculum(curr || [])
    setCompletions(comp || [])
  }

  const markComplete = async (curriculumId) => {
    const { data: { user } } = await supabase.auth.getUser()
    const already = completions.find(c => c.curriculum_id === curriculumId)
    if (already) {
      await supabase.from('curriculum_completion').delete().eq('id', already.id)
    } else {
      await supabase.from('curriculum_completion').insert({ curriculum_id: curriculumId, teacher_id: user.id })
    }
    await fetchCurriculum()
  }

  const changeWeek = (direction) => {
    const d = new Date(currWeek)
    d.setDate(d.getDate() + direction * 7)
    setCurrWeek(d.toISOString().split('T')[0])
  }
  const fetchAttendance = async () => {
    const { data } = await supabase.from('attendance').select('*').eq('date', date)
    setAttendance(data || [])
  }

  const getStatus = (studentId) => attendance.find(a => a.student_id === studentId)?.status || null

  const markAttendance = async (studentId, status) => {
    const existing = attendance.find(a => a.student_id === studentId)
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert([{ student_id: studentId, date, status, checked_in_at: new Date().toISOString() }])
    }
    fetchAttendance()
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const present = attendance.filter(a => a.status === 'present').length
  const absent = attendance.filter(a => a.status === 'absent').length

const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'attendance', label: 'Attendance', icon: '✅' },
    { id: 'curriculum', label: 'Curriculum', icon: '📚' },
    { id: 'students', label: 'Students', icon: '👶' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; }
        .logo span { color: #38bdf8; }
        .role-badge { background: rgba(16,185,129,0.15); color: #34d399; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
        .logout-btn { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; }
        .tabs { display: flex; gap: 4px; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .tab { padding: 9px 18px; border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
        .tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .welcome { background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(56,189,248,0.05)); border: 1px solid rgba(16,185,129,0.15); border-radius: 20px; padding: 28px; margin-bottom: 24px; }
        .welcome-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .welcome-sub { color: rgba(255,255,255,0.5); font-size: 14px; }
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; }
        .stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .section-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; color: rgba(255,255,255,0.8); }
        .date-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 9px 14px; color: #fff; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 12px 18px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.06); }
        td { padding: 13px 18px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        tr:last-child td { border-bottom: none; }
        .att-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .att-btn { padding: 5px 12px; border-radius: 8px; border: 1px solid transparent; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-weight: 500; transition: all 0.15s; }
        .att-btn.present { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #34d399; }
        .att-btn.present.active { background: #10b981; color: #fff; border-color: #10b981; }
        .att-btn.absent { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #f87171; }
        .att-btn.absent.active { background: #ef4444; color: #fff; border-color: #ef4444; }
        .att-btn.late { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
        .att-btn.late.active { background: #f59e0b; color: #fff; border-color: #f59e0b; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; }
        .announce-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; margin-bottom: 10px; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        @media (max-width: 600px) { .tabs { padding: 12px 16px; } .content { padding: 16px; } }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <div className="role-badge">👩‍🏫 Teacher Portal</div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="content">
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {activeTab === 'home' && (
              <>
                <div className="welcome">
                  <div className="welcome-title">👋 Good day, {profile?.full_name || 'Teacher'}!</div>
                  <div className="welcome-sub">Here's your classroom overview for today</div>
                </div>
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{students.length}</div>
                    <div className="stat-label">👶 My Students</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#10b981' }}>{present}</div>
                    <div className="stat-label">✅ Present Today</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#ef4444' }}>{absent}</div>
                    <div className="stat-label">❌ Absent Today</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{announcements.length}</div>
                    <div className="stat-label">📢 Announcements</div>
                  </div>
                </div>
                <div className="section-title">📢 Recent Announcements</div>
                {announcements.slice(0, 3).map(a => (
                  <div key={a.id} className="announce-card">
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>📢 {a.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>{a.content}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </>
            )}

            {activeTab === 'attendance' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="section-title" style={{ margin: 0 }}>✅ Mark Attendance</div>
                  <input className="date-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="stats-row" style={{ marginBottom: '20px' }}>
                  <div className="stat-card"><div className="stat-value" style={{ color: '#10b981' }}>{present}</div><div className="stat-label">Present</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: '#ef4444' }}>{absent}</div><div className="stat-label">Absent</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: 'rgba(255,255,255,0.4)' }}>{students.length - attendance.length}</div><div className="stat-label">Not Marked</div></div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Student</th><th>Mark</th><th>Status</th></tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No students found.</td></tr>
                      ) : students.map(s => {
                        const status = getStatus(s.id)
                        return (
                          <tr key={s.id}>
                            <td><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div className="avatar">{s.full_name?.[0]?.toUpperCase()}</div><span style={{ fontWeight: 500 }}>{s.full_name}</span></div></td>
                            <td><div className="att-btns">
                              <button className={`att-btn present ${status==='present'?'active':''}`} onClick={() => markAttendance(s.id, 'present')}>✅</button>
                              <button className={`att-btn absent ${status==='absent'?'active':''}`} onClick={() => markAttendance(s.id, 'absent')}>❌</button>
                              <button className={`att-btn late ${status==='late'?'active':''}`} onClick={() => markAttendance(s.id, 'late')}>⏰</button>
                            </div></td>
                            <td>{status ? <span className="badge" style={{ background: status==='present'?'rgba(16,185,129,0.15)':status==='absent'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)', color: status==='present'?'#34d399':status==='absent'?'#f87171':'#fbbf24' }}>{status}</span> : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>—</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'students' && (
              <>
                <div className="section-title">👶 My Students ({students.length})</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Date of Birth</th><th>Gender</th><th>Status</th></tr></thead>
                    <tbody>
                      {students.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No students found.</td></tr>
                      ) : students.map(s => (
                        <tr key={s.id}>
                          <td><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div className="avatar">{s.full_name?.[0]?.toUpperCase()}</div><span style={{ fontWeight: 500, color: '#fff' }}>{s.full_name}</span></div></td>
                          <td style={{ color: 'rgba(255,255,255,0.5)' }}>{s.date_of_birth || '—'}</td>
                          <td style={{ color: 'rgba(255,255,255,0.5)' }}>{s.gender || '—'}</td>
                          <td><span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {activeTab === 'curriculum' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="section-title" style={{ margin: 0 }}>📚 Curriculum</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => changeWeek(-1)} style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer' }}>◀</button>
                    <span style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 'bold' }}>{currWeek}</span>
                    <button onClick={() => changeWeek(1)} style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer' }}>▶</button>
                    <button onClick={fetchCurriculum} style={{ padding: '8px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🔄</button>
                  </div>
                </div>

                {/* Today / Week Toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {['today', 'week'].map(v => (
                    <button key={v} onClick={() => setCurrView(v)}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: currView === v ? '#38bdf8' : '#1e293b', color: currView === v ? '#0f172a' : '#94a3b8' }}>
                      {v === 'today' ? `📅 Today (${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})` : '📆 Full Week'}
                    </button>
                  ))}
                </div>
                  {(() => {
                  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                  const todayDate = new Date().toISOString().split('T')[0]
                  const filtered = currView === 'today'
                    ? curriculum.filter(c => c.day === todayName || c.assigned_date === todayDate)
                    : curriculum
                  return filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                      {currView === 'today' ? '🎉 No activities scheduled for today!' : 'No curriculum planned for this week.'}
                    </div>
                  ) : filtered.map(item => {  
                  const done = completions.some(c => c.curriculum_id === item.id)
                  return (
                    <div key={item.id} style={{ backgroundColor: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.program}</span>
                            <span style={{ backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.time_slot}</span>
                            <span style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.day}</span>
                            {item.special_event && <span style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>⭐ Special</span>}
                          </div>
                          <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{item.planned_activity || 'Activity'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.activity_category} · {item.activity_type}</div>
                          {item.materials_needed && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>🧰 {item.materials_needed}</div>}
                          {item.teacher_notes && <div style={{ color: '#f59e0b', fontSize: '12px', marginTop: '4px' }}>📝 {item.teacher_notes}</div>}
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>📅 {item.assigned_date}</div>
                        </div>
                        <button onClick={() => markComplete(item.id)}
                          style={{ padding: '8px 14px', backgroundColor: done ? '#10b981' : '#1e293b', color: done ? '#fff' : '#94a3b8', border: `1px solid ${done ? '#10b981' : '#334155'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {done ? '✅ Done' : '○ Mark Done'}
                        </button>
                      </div>
                    </div>
                  )
                })
                })()}
              </>
            )}
            {activeTab === 'announcements' && (
              <>
                <div className="section-title">📢 Announcements ({announcements.length})</div>
                {announcements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No announcements yet.</div>
                ) : announcements.map(a => (
                  <div key={a.id} className="announce-card">
                    <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '15px' }}>📢 {a.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>{a.content}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
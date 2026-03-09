'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ParentPortal() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [fees, setFees] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [curriculum, setCurriculum] = useState([])
  const [newsletters, setNewsletters] = useState([])
  const [currView, setCurrView] = useState('highlights')
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUser(user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    const [s, f, a, at] = await Promise.all([
      supabase.from('students').select('*').eq('status', 'active').limit(10),
      supabase.from('fees').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('attendance').select('*, students(full_name)').order('date', { ascending: false }).limit(30)
    ])
    setStudents(s.data || [])
    setFees(f.data || [])
    setAnnouncements(a.data || [])
    setAttendance(at.data || [])
    // Load this week's curriculum
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(today.setDate(diff)).toISOString().split('T')[0]
    const weekEnd = new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6)).toISOString().split('T')[0]
    const [curr, news] = await Promise.all([
      supabase.from('curriculum').select('*').gte('assigned_date', weekStart).lte('assigned_date', weekEnd).order('assigned_date').order('time_slot'),
      supabase.from('curriculum_newsletter').select('*').order('created_at', { ascending: false }).limit(5)
    ])
    const comp = await supabase.from('curriculum_completion').select('curriculum_id')
    const completedIds = comp.data?.map(c => c.curriculum_id) || []
    setCurriculum((curr.data || []).map(c => ({ ...c, completed: completedIds.includes(c.id) })))
    setNewsletters(news.data || [])
    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const unpaidFees = fees.filter(f => f.status === 'unpaid')
  const totalOwed = unpaidFees.reduce((sum, f) => sum + Number(f.amount), 0)

  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'children', label: 'My Children', icon: '👶' },
    { id: 'curriculum', label: 'Curriculum', icon: '📚' },
    { id: 'fees', label: 'Fees', icon: '💳' },
    { id: 'attendance', label: 'Attendance', icon: '✅' },
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
        .role-badge { background: rgba(167,139,250,0.15); color: #a78bfa; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
        .logout-btn { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; }
        .tabs { display: flex; gap: 4px; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .tab { padding: 9px 18px; border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
        .tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .welcome { background: linear-gradient(135deg, rgba(14,165,233,0.15), rgba(56,189,248,0.05)); border: 1px solid rgba(56,189,248,0.15); border-radius: 20px; padding: 28px; margin-bottom: 24px; }
        .welcome-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .welcome-sub { color: rgba(255,255,255,0.5); font-size: 14px; }
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; }
        .stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .section-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; color: rgba(255,255,255,0.8); }
        .announce-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; margin-bottom: 10px; }
        .announce-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .announce-content { color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6; margin-bottom: 10px; }
        .announce-time { color: rgba(255,255,255,0.3); font-size: 12px; }
        .student-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; margin-bottom: 12px; display: flex; align-items: center; gap: 16px; }
        .big-avatar { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .student-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .student-info { color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 2px; }
        .fee-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .fee-row:last-child { border-bottom: none; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .att-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .att-row:last-child { border-bottom: none; }
        .table-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 4px 20px; }
        .alert-card { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        @media (max-width: 600px) { .tabs { padding: 12px 16px; } .content { padding: 16px; } }
      `}</style>

      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <div className="role-badge">👪 Parent Portal</div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="content">
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading your portal...</div> : (
          <>
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <>
                <div className="welcome">
                  <div className="welcome-title">👋 Welcome back, {profile?.full_name || 'Parent'}!</div>
                  <div className="welcome-sub">Here's a summary of your child's school activities</div>
                </div>

                {unpaidFees.length > 0 && (
                  <div className="alert-card">
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>💳 Outstanding Fees</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>You have {unpaidFees.length} unpaid invoice(s) totalling ${totalOwed}</div>
                    </div>
                    <button className="tab active" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('fees')}>View Fees →</button>
                  </div>
                )}

                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{students.length}</div>
                    <div className="stat-label">👶 Children</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#ef4444' }}>${totalOwed}</div>
                    <div className="stat-label">💳 Fees Due</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#10b981' }}>{announcements.length}</div>
                    <div className="stat-label">📢 Announcements</div>
                  </div>
                </div>

                <div className="section-title">📢 Latest Announcements</div>
                {announcements.slice(0, 3).map(a => (
                  <div key={a.id} className="announce-card">
                    <div className="announce-title">📢 {a.title}</div>
                    <div className="announce-content">{a.content}</div>
                    <div className="announce-time">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {announcements.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No announcements yet.</div>}
              </>
            )}

            {/* CHILDREN TAB */}
            {activeTab === 'children' && (
              <>
                <div className="section-title">👶 My Children ({students.length})</div>
                {students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No children linked to your account yet.</div>
                ) : students.map(s => (
                  <div key={s.id} className="student-card">
                    <div className="big-avatar">{s.full_name?.[0]?.toUpperCase()}</div>
                    <div>
                      <div className="student-name">{s.full_name}</div>
                      {s.date_of_birth && <div className="student-info">🎂 DOB: {s.date_of_birth}</div>}
                      {s.gender && <div className="student-info">👤 {s.gender}</div>}
                      <div className="student-info">📅 Enrolled: {new Date(s.created_at).toLocaleDateString()}</div>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginTop: '8px', display: 'inline-block' }}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* FEES TAB */}
            {activeTab === 'fees' && (
              <>
                <div className="section-title">💳 Fee Invoices</div>
                <div className="stats-row" style={{ marginBottom: '20px' }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#ef4444' }}>${totalOwed}</div>
                    <div className="stat-label">Total Unpaid</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#10b981' }}>${fees.filter(f=>f.status==='paid').reduce((s,f)=>s+Number(f.amount),0)}</div>
                    <div className="stat-label">Total Paid</div>
                  </div>
                </div>
                <div className="table-card">
                  {fees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No fee records found.</div>
                  ) : fees.map(f => (
                    <div key={f.id} className="fee-row">
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: '3px' }}>{f.title}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{f.due_date ? `Due: ${f.due_date}` : new Date(f.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#38bdf8' }}>${Number(f.amount).toLocaleString()}</div>
                        <span className="badge" style={{
                          background: f.status==='paid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: f.status==='paid' ? '#34d399' : '#f87171'
                        }}>{f.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === 'attendance' && (
              <>
                <div className="section-title">✅ Attendance History</div>
                <div className="table-card">
                  {attendance.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No attendance records yet.</div>
                  ) : attendance.map(a => (
                    <div key={a.id} className="att-row">
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{a.students?.full_name || 'Student'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{a.date}</div>
                      </div>
                      <span className="badge" style={{
                        background: a.status==='present' ? 'rgba(16,185,129,0.15)' : a.status==='absent' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: a.status==='present' ? '#34d399' : a.status==='absent' ? '#f87171' : '#fbbf24'
                      }}>{a.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* CURRICULUM TAB */}
            {activeTab === 'curriculum' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div className="section-title" style={{ margin: 0 }}>📚 Curriculum</div>
                </div>

                {/* Toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {['highlights', 'newsletter'].map(v => (
                    <button key={v} onClick={() => setCurrView(v)}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: currView === v ? '#38bdf8' : '#1e293b', color: currView === v ? '#0f172a' : '#94a3b8' }}>
                      {v === 'highlights' ? '⭐ This Week' : '📰 Newsletter'}
                    </button>
                  ))}
                </div>

                {currView === 'highlights' && (
                  <>
                    <div style={{ backgroundColor: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
                      <div style={{ color: '#38bdf8', fontWeight: '600', marginBottom: '4px' }}>📅 Week Highlights</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                        {curriculum.filter(c => c.completed).length} of {curriculum.length} activities completed this week
                      </div>
                    </div>

                    {/* Special Events first */}
                    {curriculum.filter(c => c.special_event).length > 0 && (
                      <>
                        <div className="section-title">⭐ Special Events</div>
                        {curriculum.filter(c => c.special_event).map(item => (
                          <div key={item.id} style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              <span style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>⭐ Special Event</span>
                              <span style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.day}</span>
                              <span style={{ backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.program}</span>
                            </div>
                            <div style={{ fontWeight: '600' }}>{item.planned_activity}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{item.activity_category}</div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Daily breakdown */}
                    <div className="section-title">📆 Daily Activities</div>
                    {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => {
                      const dayItems = curriculum.filter(c => c.day === day)
                      if (dayItems.length === 0) return null
                      return (
                        <div key={day} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                          <div style={{ color: '#38bdf8', fontWeight: '600', marginBottom: '12px' }}>📅 {day}</div>
                          {dayItems.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500' }}>{item.planned_activity || 'Activity'}</div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.time_slot} · {item.program}</div>
                              </div>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', backgroundColor: item.completed ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: item.completed ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                                {item.completed ? '✅ Done' : '⏳ Planned'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                    {curriculum.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No curriculum planned for this week.</div>}
                  </>
                )}

                {currView === 'newsletter' && (
                  <>
                    {newsletters.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No newsletters sent yet.</div>
                    ) : newsletters.map(n => (
                      <div key={n.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>📰 Week of {n.week_start}</span>
                          <span style={{ color: '#64748b', fontSize: '13px' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <pre style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}>{n.content}</pre>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
            {/* ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <>
                <div className="section-title">📢 All Announcements ({announcements.length})</div>
                {announcements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No announcements yet.</div>
                ) : announcements.map(a => (
                  <div key={a.id} className="announce-card">
                    <div className="announce-title">📢 {a.title}</div>
                    <div className="announce-content">{a.content}</div>
                    <div className="announce-time">{new Date(a.created_at).toLocaleString()}</div>
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
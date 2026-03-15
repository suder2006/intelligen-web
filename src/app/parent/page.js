'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ParentPortal() {
  const [moments, setMoments] = useState([])
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [fees, setFees] = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [curriculum, setCurriculum] = useState([])
  const [newsletters, setNewsletters] = useState([])
  const [currView, setCurrView] = useState('highlights')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [paymentModal, setPaymentModal] = useState(null)
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)
  const [progressReports, setProgressReports] = useState([])
  const [progressRatings, setProgressRatings] = useState([])
  const [progressSkills, setProgressSkills] = useState([])
  const [selectedProgressTerm, setSelectedProgressTerm] = useState('Term 1')
  const [absenceForm, setAbsenceForm] = useState({ student_id: '', absence_date: new Date().toISOString().split('T')[0], reason: '' })
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [myAbsences, setMyAbsences] = useState([])
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUser(user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: linkedStudents } = await supabase
      .from('parent_students').select('student_id').eq('parent_id', user.id)
    const studentIds = linkedStudents?.map(ls => ls.student_id) || []

    const [s, f, a, at] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('students').select('*').in('id', studentIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
      supabase.from('fee_invoices').select('*, fee_installments(*)').in('student_id', studentIds.length > 0 ? studentIds : ['__none__']).order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('attendance').select('*, students(full_name)').in('student_id', studentIds.length > 0 ? studentIds : ['__none__']).order('date', { ascending: false }).limit(60)
    ])
    setStudents(s.data || [])
    setFees(f.data || [])
    setAnnouncements(a.data || [])
    setAttendance(at.data || [])

    // Load curriculum
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

    // Load moments filtered by child programs
    const { data: studentsData } = await supabase.from('students').select('program').in('id', studentIds.length > 0 ? studentIds : ['__none__'])
    const parentPrograms = [...new Set(studentsData?.map(s => s.program).filter(Boolean) || [])]
    const { data: momentsData } = await supabase.from('classroom_moments')
      .select('*')
      .in('class_name', parentPrograms.length > 0 ? parentPrograms : ['__none__'])
      .order('created_at', { ascending: false }).limit(50)
    setMoments(momentsData || [])

   // Load messages
    const { data: msgsData } = await supabase.from('chat_messages').select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(30)
    setMessages(msgsData || [])

    // Load teachers
    const { data: teachersData } = await supabase.from('profiles').select('*').eq('role', 'teacher')
    setTeachers(teachersData || [])

      const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { data: fsData } = await supabase.from('fee_structures')
      .select('*')
      .eq('academic_year', currentAY)
      .order('fee_type')
    setFeeStructures(fsData || [])
    // Load progress reports (only sent ones)
    if (studentIds.length > 0) {
      const { data: prData } = await supabase.from('progress_reports').select('*')
        .in('student_id', studentIds).eq('sent_to_parent', true).order('created_at', { ascending: false })
      setProgressReports(prData || [])
      if (prData && prData.length > 0) {
        const { data: prRatings } = await supabase.from('progress_ratings').select('*, skill_activities(*, skill_masters(*))')
          .in('student_id', studentIds)
        setProgressRatings(prRatings || [])
      }
    }
    // Load absence notifications
    if (studentIds.length > 0) {
      const { data: absData } = await supabase.from('student_absences').select('*, students(full_name)')
        .in('student_id', studentIds).order('absence_date', { ascending: false }).limit(20)
      setMyAbsences(absData || [])
    }
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTeacher) { alert('Please select a teacher and type a message'); return }
    setSendingMessage(true)
    await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: selectedTeacher,
      content: newMessage,
      sender_name: profile?.full_name || 'Parent'
    })
    setNewMessage('')
    const { data: msgsData } = await supabase.from('chat_messages').select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(30)
    setMessages(msgsData || [])
    setSendingMessage(false)
  }

  const notifyAbsence = async () => {
    if (!absenceForm.student_id || !absenceForm.absence_date) { alert('Please select student and date'); return }
    setSubmittingAbsence(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('student_absences').insert({
      student_id: absenceForm.student_id,
      parent_id: user.id,
      absence_date: absenceForm.absence_date,
      reason: absenceForm.reason,
      acknowledged: false
    })
    // Also mark attendance as absent
    const existing = await supabase.from('attendance').select('id').eq('student_id', absenceForm.student_id).eq('date', absenceForm.absence_date).single()
    if (!existing.data) {
      await supabase.from('attendance').insert({ student_id: absenceForm.student_id, date: absenceForm.absence_date, status: 'absent', checked_in_at: new Date().toISOString() })
    }
    setAbsenceForm({ student_id: '', absence_date: new Date().toISOString().split('T')[0], reason: '' })
    await loadData()
    setSubmittingAbsence(false)
    alert('Absence notified to school! ✅')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

const totalOwed = fees.reduce((sum, f) => sum + Math.max(0, Number(f.total_amount) - Number(f.paid_amount || 0)), 0)
  const totalPaid = fees.reduce((sum, f) => sum + Number(f.paid_amount || 0), 0)
  const unpaidFees = fees.filter(f => f.status !== 'paid')

  // Attendance stats per child
  const getAttendanceStats = (studentId) => {
    const recs = attendance.filter(a => a.student_id === studentId)
    return {
      present: recs.filter(a => a.status === 'present').length,
      absent: recs.filter(a => a.status === 'absent').length,
      late: recs.filter(a => a.status === 'late').length,
      total: recs.length
    }
  }

  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'children', label: 'My Children', icon: '👶' },
    { id: 'attendance', label: 'Attendance', icon: '✅' },
    { id: 'fees', label: 'Fees', icon: '💳' },
    { id: 'curriculum', label: 'Curriculum', icon: '📚' },
    { id: 'moments', label: 'Moments', icon: '📸' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'progress', label: 'Progress', icon: '📊' },
    { id: 'absence', label: 'Notify Absence', icon: '📋' }
  ]

  const inputStyle = { width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }

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
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 12px; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .table-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 4px 20px; }
        .row { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .row:last-child { border-bottom: none; }
        .alert-card { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .msg-bubble { padding: 12px 16px; border-radius: 14px; max-width: 75%; margin-bottom: 8px; font-size: 14px; line-height: 1.5; }
        .msg-sent { background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.2); color: #e2e8f0; margin-left: auto; border-bottom-right-radius: 4px; }
        .msg-recv { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; margin-right: auto; border-bottom-left-radius: 4px; }
        @media (max-width: 600px) { .tabs { padding: 12px 16px; } .content { padding: 16px; } }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <div className="role-badge">👪 Parent Portal</div>
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
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{unpaidFees.length} unpaid invoice(s) — ₹{totalOwed.toLocaleString()}</div>
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
                    <div className="stat-value" style={{ color: '#ef4444' }}>₹{totalOwed.toLocaleString()}</div>
                    <div className="stat-label">💳 Fees Due</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#10b981' }}>{attendance.filter(a=>a.status==='present').length}</div>
                    <div className="stat-label">✅ Days Present</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{moments.length}</div>
                    <div className="stat-label">📸 Moments</div>
                  </div>
                </div>

                {/* Quick children overview */}
                <div className="section-title">👶 My Children</div>
                {students.map(s => {
                  const stats = getAttendanceStats(s.id)
                  const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
                  return (
                    <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', flexShrink: 0 }}>{s.full_name?.[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '16px' }}>{s.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px', marginTop: '2px' }}>{s.program || 'No program'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>{pct}%</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Attendance</div>
                      </div>
                    </div>
                  )
                })}

                <div className="section-title" style={{ marginTop: '20px' }}>📢 Latest Announcements</div>
                {announcements.slice(0, 3).map(a => (
                  <div key={a.id} className="card">
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>📢 {a.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6 }}>{a.content}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '8px' }}>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </>
            )}

            {/* CHILDREN TAB */}
            {activeTab === 'children' && (
              <>
                <div className="section-title">👶 My Children ({students.length})</div>
                {students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No children linked to your account yet.</div>
                ) : students.map(s => {
                  const stats = getAttendanceStats(s.id)
                  const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
                  const childFees = fees.filter(f => f.student_id === s.id)
                  const childUnpaid = childFees.reduce((sum, f) => sum + Math.max(0, Number(f.total_amount) - Number(f.paid_amount || 0)), 0)
                  return (
                    <div key={s.id} className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', flexShrink: 0 }}>{s.full_name?.[0]?.toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '18px' }}>{s.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px' }}>📚 {s.program || '—'}</div>
                          {s.date_of_birth && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>🎂 {s.date_of_birth}</div>}
                          {s.gender && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>👤 {s.gender}</div>}
                        </div>
                        <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{s.status}</span>
                      </div>

                      {/* Attendance summary */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                        {[
                          { label: 'Present', value: stats.present, color: '#10b981' },
                          { label: 'Absent', value: stats.absent, color: '#ef4444' },
                          { label: 'Late', value: stats.late, color: '#f59e0b' },
                          { label: 'Attendance', value: `${pct}%`, color: '#38bdf8' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                            <div style={{ color: item.color, fontWeight: '700', fontSize: '18px' }}>{item.value}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Fee summary */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 14px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>💳 Outstanding Fees</span>
                        <span style={{ color: childUnpaid > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>{childUnpaid > 0 ? `₹${childUnpaid.toLocaleString()}` : 'All Paid ✅'}</span>
                      </div>

                      {/* Child QR Code */}
                      <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px' }}>
                        <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>📱 Student QR Code (for check-in)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://intelligen-web.vercel.app/checkin?student=${s.id}`)}`} alt='Student QR' style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#fff', padding: '4px' }} />
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>Show this QR at school gate or save to phone</div>
                            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://intelligen-web.vercel.app/checkin?student=${s.id}`)}`} download target='_blank'
                              style={{ padding: '5px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}>⬇️ Save QR</a>
                          </div>
                        </div>
                      </div>    
                    </div>                  
                  )
                })}
              </>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === 'attendance' && (
              <>
                <div className="section-title">✅ Attendance Summary</div>

                {/* Stats per child */}
                {students.map(s => {
                  const stats = getAttendanceStats(s.id)
                  const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
                  return (
                    <div key={s.id} className="card" style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: '700' }}>{s.full_name}</div>
                        <span style={{ color: '#a78bfa', fontSize: '13px' }}>{s.program}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                        {[
                          { label: 'Present', value: stats.present, color: '#10b981' },
                          { label: 'Absent', value: stats.absent, color: '#ef4444' },
                          { label: 'Late', value: stats.late, color: '#f59e0b' },
                          { label: 'Rate', value: `${pct}%`, color: '#38bdf8' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                            <div style={{ color: item.color, fontWeight: '700', fontSize: '20px' }}>{item.value}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Progress bar */}
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '6px' }}>
                        <div style={{ background: pct >= 75 ? '#10b981' : '#ef4444', borderRadius: '4px', height: '6px', width: `${pct}%`, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>{pct >= 75 ? '✅ Good attendance' : '⚠️ Below 75% — please improve'}</div>
                    </div>
                  )
                })}

                {/* Attendance history */}
                <div className="section-title">📅 Recent History</div>
                <div className="table-card">
                  {attendance.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No attendance records yet.</div>
                  ) : attendance.slice(0, 20).map(a => (
                    <div key={a.id} className="row">
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{a.students?.full_name || 'Student'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📅 {a.date}</div>
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

            {activeTab === 'fees' && (
              <>
                <div className="section-title">💳 My Fee Invoices</div>
                <div className="stats-row" style={{ marginBottom: '20px' }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#ef4444' }}>₹{totalOwed.toLocaleString()}</div>
                    <div className="stat-label">Total Pending</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#10b981' }}>₹{totalPaid.toLocaleString()}</div>
                    <div className="stat-label">Total Paid</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{unpaidFees.length}</div>
                    <div className="stat-label">Pending Invoices</div>
                  </div>
                </div>

                {students.map(child => {
                  const childInvoices = fees.filter(f => f.student_id === child.id)
                  if (childInvoices.length === 0) return null
                  return (
                    <div key={child.id} style={{ marginBottom: '28px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{child.full_name?.[0]}</div>
                        <div style={{ fontWeight: '700', fontSize: '16px' }}>{child.full_name}</div>
                        <span style={{ color: '#a78bfa', fontSize: '13px' }}>{child.program}</span>
                      </div>
                      {childInvoices.map(inv => {
                        const installments = inv.fee_installments || []
                        const pendingInstallments = installments.filter(i => i.status !== 'paid')
                        return (
                          <div key={inv.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${inv.status==='paid' ? 'rgba(16,185,129,0.2)' : inv.status==='partial' ? 'rgba(56,189,248,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: installments.length > 0 ? '12px' : '0' }}>
                              <div>
                                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{inv.fee_type}</div>
                                {inv.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{inv.description}</div>}
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>
                                  {inv.academic_year}{inv.due_date && ` · Due: ${inv.due_date}`}
                                  {inv.payment_mode && ` · Paid via ${inv.payment_mode}`}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '16px' }}>₹{Number(inv.total_amount).toLocaleString()}</div>
                                {inv.paid_amount > 0 && <div style={{ color: '#10b981', fontSize: '12px' }}>Paid: ₹{Number(inv.paid_amount).toLocaleString()}</div>}
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                  background: inv.status==='paid'?'rgba(16,185,129,0.15)':inv.status==='partial'?'rgba(56,189,248,0.15)':'rgba(245,158,11,0.15)',
                                  color: inv.status==='paid'?'#34d399':inv.status==='partial'?'#38bdf8':'#fbbf24' }}>
                                  {inv.status}
                                </span>
                              </div>
                            </div>

                            {/* Installments */}
                            {installments.length > 0 && (
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginBottom: '10px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '6px' }}>Installments:</div>
                                                              {installments.map(inst => (
                                  <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div>
                                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>#{inst.installment_number} · Due: {inst.due_date}</div>
                                      {inst.notes && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{inst.notes}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <span style={{ color: '#38bdf8', fontWeight: '600', fontSize: '13px' }}>₹{Number(inst.amount).toLocaleString()}</span>
                                      <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                                        background: inst.status==='paid'?'rgba(16,185,129,0.15)':'rgba(245,158,11,0.15)',
                                        color: inst.status==='paid'?'#34d399':'#fbbf24' }}>{inst.status}</span>
                                      {inst.status !== 'paid' && (
                                        <button onClick={() => setPaymentModal({ ...inst, fee_type: `${inv.fee_type} - Installment #${inst.installment_number}`, total_amount: inst.amount, paid_amount: 0, academic_year: inv.academic_year, student_id: inv.student_id })}
                                          style={{ padding: '3px 10px', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                                          💳 Pay
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}  
                              </div>
                            )}

                            {/* Pay button */}
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => setPaymentModal(inv)}
                                style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                                💳 Pay Now — ₹{Number(inv.total_amount - (inv.paid_amount||0)).toLocaleString()} pending
                              </button>
                            )}    
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {fees.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No fee invoices found for your children.</div>
                )}
              </>
            )}  


            {/* CURRICULUM TAB */}
            {activeTab === 'curriculum' && (
              <>
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
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{curriculum.filter(c => c.completed).length} of {curriculum.length} activities completed this week</div>
                    </div>
                    {curriculum.filter(c => c.special_event).length > 0 && (
                      <>
                        <div className="section-title">⭐ Special Events</div>
                        {curriculum.filter(c => c.special_event).map(item => (
                          <div key={item.id} style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              <span style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>⭐ Special</span>
                              <span style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.day}</span>
                              <span style={{ backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{item.program}</span>
                            </div>
                            <div style={{ fontWeight: '600' }}>{item.planned_activity}</div>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="section-title">📆 Daily Activities</div>
                    {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => {
                      const dayItems = curriculum.filter(c => c.day === day)
                      if (dayItems.length === 0) return null
                      return (
                        <div key={day} className="card" style={{ marginBottom: '12px' }}>
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
                  newsletters.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No newsletters sent yet.</div>
                  ) : newsletters.map(n => (
                    <div key={n.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>📰 Week of {n.week_start}</span>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <pre style={{ color: '#e2e8f0', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}>{n.content}</pre>
                    </div>
                  ))
                )}
              </>
            )}

            {/* MOMENTS TAB */}
            {activeTab === 'moments' && (
              <>
                <div className="section-title">📸 Classroom Moments</div>
                {moments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No moments shared yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    {moments.map(m => (
                      <div key={m.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ position: 'relative' }}>
                          <img src={m.photo_url} alt={m.caption} style={{ width: '100%', height: '170px', objectFit: 'cover', display: 'block' }} />
                          <a href={m.photo_url} target='_blank' download
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', textDecoration: 'none', backdropFilter: 'blur(4px)' }}>
                            ⬇️ Save
                          </a>
                        </div>
                        <div style={{ padding: '12px' }}>
                          {m.caption && <p style={{ color: '#e2e8f0', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>{m.caption}</p>}
                          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>📚 {m.class_name}</div>
                          <div style={{ color: '#64748b', fontSize: '12px' }}>📅 {m.moment_date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* MESSAGES TAB */}
            {activeTab === 'messages' && (
              <>
                <div className="section-title">💬 Message Teacher</div>

                {/* Send message */}
                <div className="card" style={{ marginBottom: '24px' }}>
                  <h3 style={{ color: '#38bdf8', marginBottom: '16px', fontSize: '15px' }}>✉️ Send a Message</h3>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px' }}>Select Teacher *</label>
                    <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={{ ...inputStyle, marginTop: '6px' }}>
                      <option value=''>-- Select Teacher --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px' }}>Message *</label>
                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      placeholder='Type your message here...'
                      rows={3}
                      style={{ ...inputStyle, marginTop: '6px', resize: 'vertical' }} />
                  </div>
                  <button onClick={sendMessage} disabled={sendingMessage}
                    style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {sendingMessage ? '⏳ Sending...' : '📤 Send Message'}
                  </button>
                </div>

                {/* Message history */}
                <div className="section-title">📨 Message History</div>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No messages yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[...messages].reverse().map(m => {
                      const isSent = m.sender_id === user.id
                      return (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
                          <div className={`msg-bubble ${isSent ? 'msg-sent' : 'msg-recv'}`}>{m.content}</div>
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '8px', padding: '0 4px' }}>
                            {isSent ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
            {activeTab === 'absence' && (
              <>
                <div className="section-title">📋 Notify Child Absence</div>
 
                {/* Absence Form */}
                <div className="card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '16px', fontSize: '15px' }}>📝 Notify School of Absence</div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Child *</label>
                    <select value={absenceForm.student_id} onChange={e => setAbsenceForm({ ...absenceForm, student_id: e.target.value })}
                      style={{ ...inputStyle, marginTop: 0 }}>
                      <option value=''>-- Select Child --</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Absence Date *</label>
                    <input type='date' value={absenceForm.absence_date} onChange={e => setAbsenceForm({ ...absenceForm, absence_date: e.target.value })}
                      style={{ ...inputStyle, marginTop: 0 }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Reason (optional)</label>
                    <input value={absenceForm.reason} onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                      placeholder='e.g. Fever, Family function, Travel...'
                      style={{ ...inputStyle, marginTop: 0 }} />
                  </div>
                  <button onClick={notifyAbsence} disabled={submittingAbsence}
                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    {submittingAbsence ? '⏳ Notifying...' : '📤 Notify School'}
                  </button>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
                    Attendance will be automatically marked as absent
                  </div>
                </div>
 
                {/* Absence History */}
                <div className="section-title">📅 Absence History</div>
                {myAbsences.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No absence notifications yet.</div>
                ) : myAbsences.map(ab => (
                  <div key={ab.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{ab.students?.full_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📅 {ab.absence_date}</div>
                        {ab.reason && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '2px' }}>Reason: {ab.reason}</div>}
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                        background: ab.acknowledged ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: ab.acknowledged ? '#34d399' : '#fbbf24' }}>
                        {ab.acknowledged ? '✅ Acknowledged by School' : '⏳ Pending Acknowledgement'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ANNOUNCEMENTS TAB */}
            {activeTab === 'announcements' && (
              <>
                <div className="section-title">📢 All Announcements ({announcements.length})</div>
                {announcements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No announcements yet.</div>
                ) : announcements.map(a => (
                  <div key={a.id} className="card">
                    <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '15px' }}>📢 {a.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '8px' }}>{a.content}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </>
            )}
            {activeTab === 'progress' && (
              <>
                <div className="section-title">📊 Progress Reports</div>
                {/* Term selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {['Term 1', 'Term 2', 'Term 3'].map(term => (
                    <button key={term} onClick={() => setSelectedProgressTerm(term)}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: `1px solid ${selectedProgressTerm === term ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: selectedProgressTerm === term ? 'rgba(56,189,248,0.15)' : 'transparent', color: selectedProgressTerm === term ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      {term}
                    </button>
                  ))}
                </div>

                {students.map(child => {
                  const report = progressReports.find(r => r.student_id === child.id && r.term === selectedProgressTerm)
                  if (!report) return (
                    <div key={child.id} className="card" style={{ textAlign: 'center', padding: '24px' }}>
                      <div style={{ fontWeight: '700', marginBottom: '8px' }}>{child.full_name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No progress report for {selectedProgressTerm} yet.</div>
                    </div>
                  )
                  const studentRatings = progressRatings.filter(r => r.student_id === child.id && r.term === selectedProgressTerm && r.academic_year === report.academic_year)

                  // Group ratings by skill
                  const skillsMap = {}
                  studentRatings.forEach(r => {
                    const skillName = r.skill_activities?.skill_masters?.name || 'General'
                    if (!skillsMap[skillName]) skillsMap[skillName] = []
                    skillsMap[skillName].push(r)
                  })

                  const ratingStyle = (rating) => ({
                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                    background: rating === 'achieved' ? 'rgba(16,185,129,0.15)' : rating === 'developing' ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)',
                    color: rating === 'achieved' ? '#34d399' : rating === 'developing' ? '#38bdf8' : '#fbbf24'
                  })

                  const ratingLabel = (rating) => rating === 'achieved' ? '🌟 Achieved' : rating === 'developing' ? '🌿 Developing' : '🌱 Emerging'

                  return (
                    <div key={child.id} style={{ marginBottom: '28px' }}>
                      {/* Child header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px' }}>{child.full_name?.[0]}</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '16px' }}>{child.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px' }}>{child.program} · {selectedProgressTerm} · {report.academic_year}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', padding: '4px 12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>✅ Report Ready</span>
                      </div>

                      {/* Skills & Ratings */}
                      {Object.entries(skillsMap).map(([skillName, skillRatings]) => (
                        <div key={skillName} className="card" style={{ marginBottom: '12px' }}>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px', color: '#38bdf8' }}>{skillName}</div>
                          {skillRatings.map(r => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <div>
                                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{r.skill_activities?.name}</div>
                                {r.skill_activities?.description && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '2px' }}>{r.skill_activities.description}</div>}
                              </div>
                              <span style={ratingStyle(r.rating)}>{ratingLabel(r.rating)}</span>
                            </div>
                          ))}
                        </div>
                      ))}

                      {/* Teacher Observations */}
                      {(report.observations || report.strengths || report.areas_to_improve) && (
                        <div className="card">
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '14px' }}>📝 Teacher's Observations</div>
                          {report.observations && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>General</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>{report.observations}</div>
                            </div>
                          )}
                          {report.strengths && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ color: '#10b981', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>🌟 Strengths</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>{report.strengths}</div>
                            </div>
                          )}
                          {report.areas_to_improve && (
                            <div>
                              <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>🎯 Areas to Improve</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>{report.areas_to_improve}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

          </>
        )}
      </div>
      {/* UPI Payment Modal */}
      {paymentModal && (() => {
        const pendingAmount = Number(paymentModal.total_amount) - Number(paymentModal.paid_amount || 0)
        const upiId = 'getepay.ucbqrapp703536@icici'
        const upiName = 'Time Kids Preschool Anna Nagar'
        const upiNote = `${paymentModal.fee_type} - ${paymentModal.academic_year}`
        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${pendingAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`
        const gPayUrl = `gpay://upi/pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${pendingAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`
        const phonePeUrl = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${pendingAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`
        const paytmUrl = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${pendingAmount}&cu=INR&tn=${encodeURIComponent(upiNote)}`

        const notifySchool = async () => {
          setNotifying(true)
          const { data: ps } = await supabase.from('parent_students').select('*').eq('parent_id', user.id)
          await supabase.from('chat_messages').insert({
            sender_id: user.id,
            receiver_id: '554c668d-1668-474b-a8aa-f529941dbcf6',
            sender_name: profile?.full_name || 'Parent',
            content: `💳 Payment Notification: I have paid ₹${pendingAmount.toLocaleString()} for ${paymentModal.fee_type} (${paymentModal.academic_year}) via UPI. Please verify and mark as paid. Student: ${students.find(s => s.id === paymentModal.student_id)?.full_name}`
          })
          setNotifying(false)
          setNotified(true)
        }

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
            onClick={() => { setPaymentModal(null); setNotified(false) }}>
            <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '420px', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>💳 Pay via UPI</div>
                <div style={{ color: '#a78bfa', fontSize: '14px' }}>{paymentModal.fee_type}</div>
                <div style={{ color: '#38bdf8', fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>₹{pendingAmount.toLocaleString()}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>To: {upiName}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{upiId}</div>
              </div>

              {/* QR Code */}
              <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', display: 'inline-block', marginBottom: '20px' }}>
                <img src={qrUrl} alt='UPI QR Code' style={{ width: '180px', height: '180px', display: 'block' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>Scan with any UPI app to pay</div>

              {/* UPI App Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: '🟢 GPay', url: gPayUrl, color: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)', text: '#34d399' },
                  { label: '🟣 PhonePe', url: phonePeUrl, color: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)', text: '#a78bfa' },
                  { label: '🔵 Paytm', url: paytmUrl, color: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', text: '#38bdf8' },
                ].map(app => (
                  <a key={app.label} href={app.url}
                    style={{ padding: '10px 6px', backgroundColor: app.color, border: `1px solid ${app.border}`, borderRadius: '10px', color: app.text, fontSize: '13px', fontWeight: '600', textDecoration: 'none', display: 'block' }}>
                    {app.label}
                  </a>
                ))}
              </div>

              {/* Notify School */}
              {!notified ? (
                <button onClick={notifySchool} disabled={notifying}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '10px', fontFamily: "'DM Sans', sans-serif" }}>
                  {notifying ? '⏳ Sending...' : '✅ I have paid — Notify School'}
                </button>
              ) : (
                <div style={{ padding: '12px', backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', color: '#34d399', fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>
                  ✅ School notified! They will verify and mark as paid.
                </div>
              )}

              <button onClick={() => { setPaymentModal(null); setNotified(false) }}
                style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false })

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
  const [moments, setMoments] = useState([])
  const [momentCaption, setMomentCaption] = useState('')
  const [momentClass, setMomentClass] = useState('')
  const [momentFile, setMomentFile] = useState(null)
  const [momentPreview, setMomentPreview] = useState(null)
  const [uploadingMoment, setUploadingMoment] = useState(false)
  const [programs, setPrograms] = useState([])
  const momentFileRef = useRef()
  const [currWeek, setCurrWeek] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(today.setDate(diff)).toISOString().split('T')[0]
  })
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [replyText, setReplyText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [sendingReply, setSendingReply] = useState(false)
  const [parents, setParents] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveBalance, setLeaveBalance] = useState(null)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [studentAbsences, setStudentAbsences] = useState([])
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Casual Leave', from_date: '', to_date: '', reason: '' })
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [holidays, setHolidays] = useState([])
  const [payslips, setPayslips] = useState([])
  const [selectedPayslip, setSelectedPayslip] = useState(null)
  const [activityCompletions, setActivityCompletions] = useState([])
  const [homeActivities, setHomeActivities] = useState([])
  const [birthdayStudents, setBirthdayStudents] = useState([])
  const [schoolForBirthday, setSchoolForBirthday] = useState(null)


  useEffect(() => { loadData() }, [])
  useEffect(() => { if (!loading) fetchAttendance() }, [date])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const { data: schoolData } = await supabase.from('schools').select('name').eq('id', prof.school_id).single()
    prof.school_name = schoolData?.name || ''
    setProfile(prof)

    const { data: spData } = await supabase.from('staff_programs').select('program').eq('staff_id', user.id)
    const teacherPrograms = spData?.map(p => p.program) || []

const { data: sData } = await supabase.from('students')
      .select('*')
      .eq('status', 'active')
      .eq('school_id', prof.school_id)
      .in('program', teacherPrograms.length > 0 ? teacherPrograms : ['__none__'])
      .order('full_name')

      const { data: aData } = await supabase.from('announcements')
      .select('*').eq('school_id', prof.school_id).order('created_at', { ascending: false }).limit(10)

    setStudents(sData || [])
    setAnnouncements(aData || [])

    await fetchCurriculum()
    await fetchMoments(prof.school_id)
    const { data: progs } = await supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', prof.school_id).order('value')
    setPrograms(progs?.map(p => p.value) || [])
    await fetchMessages()
    const { data: parentsData } = await supabase.from('profiles').select('*').eq('role', 'parent').eq('school_id', prof.school_id)
    setParents(parentsData || [])

    // Load leave data
    const { data: lrData } = await supabase.from('leave_requests').select('*')
      .eq('staff_id', user.id).order('created_at', { ascending: false })
    setLeaveRequests(lrData || [])
    const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { data: balData } = await supabase.from('leave_balances').select('*')
      .eq('staff_id', user.id).eq('academic_year', currentAY).single()
    setLeaveBalance(balData || null)
    // Load student absences for teacher's students
    const studentIds = (sData || []).map(s => s.id)
    const { data: absData } = await supabase.from('student_absences')
      .select('*, students(full_name, program)')
      .in('student_id', studentIds.length > 0 ? studentIds : ['__none__'])
      .order('absence_date', { ascending: false }).limit(30)
    setStudentAbsences(absData || [])

    await fetchAttendance()
    // Load holidays for teacher's programs
    //const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { data: holData } = await supabase.from('holidays')
      .select('*')
      .eq('academic_year', currentAY)
      .eq('school_id', prof.school_id)
      .or(`applies_to.eq.all,applies_to.eq.staff_only`)
      .order('from_date')
    // Also get program-specific holidays
    const { data: progHolData } = await supabase.from('holidays')
      .select('*')
      .eq('academic_year', currentAY)
      .eq('applies_to', 'programs')
      .order('from_date')
    const progHols = (progHolData || []).filter(h => h.programs?.some(p => teacherPrograms.includes(p)))
    setHolidays([...(holData || []), ...progHols].sort((a, b) => a.from_date.localeCompare(b.from_date)))
    // Load payslips
    const { data: payslipData } = await supabase.from('payroll')
      .select('*').eq('staff_id', user.id).order('month', { ascending: false })
    setPayslips(payslipData || [])

    // Load home activity completions for teacher's students
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
    const { data: teacherActData } = await supabase.from('home_activities')
      .select('*').eq('academic_year', currentAY)
      .eq('school_id', prof.school_id)
      .in('program', teacherPrograms).order('month').order('order_index')
    setHomeActivities(teacherActData || [])
    if (studentIds.length > 0) {
      const { data: actCompData } = await supabase.from('home_activity_completions')
        .select('*, students(full_name)').in('student_id', studentIds)
      setActivityCompletions(actCompData || [])
    }

    // Load birthdays for teacher's programs
    const [schRes, notifRes] = await Promise.all([
      supabase.from('schools').select('*').eq('id', prof.school_id).single(),
      supabase.from('birthday_notifications').select('student_id, notification_date').eq('school_id', prof.school_id)
    ])
    setSchoolForBirthday(schRes.data)
    setBirthdayStudents(sData || [])

    setLoading(false)
  }

const fetchMoments = async (schoolId) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: spData } = await supabase.from('staff_programs').select('program').eq('staff_id', user.id)
    const teacherPrograms = spData?.map(p => p.program) || []
    const { data } = await supabase.from('classroom_moments')
      .select('*')
      .eq('school_id', schoolId)
      .in('class_name', teacherPrograms.length > 0 ? teacherPrograms : ['__none__'])
      .order('created_at', { ascending: false })
      .limit(50)
    setMoments(data || [])
  }

  const fetchMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('chat_messages').select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const sendReply = async () => {
    if (!replyText.trim() || !replyingTo) return
    setSendingReply(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: replyingTo,
      content: replyText,
      sender_name: profile?.full_name || 'Teacher'
    })
    setReplyText('')
    await fetchMessages()
    setSendingReply(false)
  }

  const applyLeave = async () => {
    if (!leaveForm.from_date || !leaveForm.to_date) { alert('Please select dates'); return }
    setSubmittingLeave(true)
    const { data: { user } } = await supabase.auth.getUser()
    const from = new Date(leaveForm.from_date)
    const to = new Date(leaveForm.to_date)
    const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1
    const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    await supabase.from('leave_requests').insert({
      staff_id: user.id, leave_type: leaveForm.leave_type,
      from_date: leaveForm.from_date, to_date: leaveForm.to_date,
      no_of_days: days, reason: leaveForm.reason,
      status: 'pending', academic_year: currentAY
    })
    setLeaveForm({ leave_type: 'Casual Leave', from_date: '', to_date: '', reason: '' })
    setShowLeaveForm(false)
    await loadData()
    setSubmittingLeave(false)
    alert('Leave request submitted!')
  }

  const acknowledgeAbsence = async (id) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('student_absences').update({
      acknowledged: true, acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString()
    }).eq('id', id)
    await loadData()
  }

  const handleStaffScan = async (decodedText) => {
    setShowScanner(false)
      const { data: tokenData } = await supabase.from('school_qr_tokens').select('token').eq('school_id', profile.school_id).single()
      if (!tokenData || !decodedText.includes(tokenData.token)) {
      setScanResult({ type: 'error', message: 'Invalid QR code. Please scan the school gate QR.' })
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const timeStr = now.toTimeString().slice(0, 5)
    const { data: existing } = await supabase.from('staff_attendance').select('*').eq('staff_id', user.id).eq('date', today).single()
    if (!existing) {
      const { data: grpData } = await supabase.from('staff_type_groups').select('*').eq('id', profile?.staff_group_id).single()
      let status = 'present'
      if (grpData) {
        if (timeStr > grpData.halfday_before) status = 'half_day'
        else if (timeStr > grpData.late_before) status = 'late'
      }
      await supabase.from('staff_attendance').insert({
        staff_id: user.id, date: today,
        checkin_time: now.toISOString(),
        status, marked_by: 'qr',
        school_id: profile.school_id
      })
      setScanResult({ type: 'success', action: 'checkin', message: `✅ Checked in at ${now.toLocaleTimeString()}`, status })
    } else if (!existing.checkout_time) {
      const workingHours = ((now - new Date(existing.checkin_time)) / (1000 * 60 * 60)).toFixed(1)
      await supabase.from('staff_attendance').update({ checkout_time: now.toISOString(), working_hours: parseFloat(workingHours) }).eq('id', existing.id)
      setScanResult({ type: 'success', action: 'checkout', message: `👋 Checked out at ${now.toLocaleTimeString()}. Hours: ${workingHours}h` })
    } else {
      setScanResult({ type: 'info', message: 'Already checked in and out today.' })
    }
  }

  const uploadMoment = async () => {
    if (!momentFile || !momentClass) { alert('Please select a photo and class'); return }
    setUploadingMoment(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const ext = momentFile.name.split('.').pop()
      const path = `${momentClass}/${today}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('classroom-moments').upload(path, momentFile)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('classroom-moments').getPublicUrl(path)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('classroom_moments').insert({
        class_name: momentClass, caption: momentCaption,
        photo_url: publicUrl, storage_path: path,
        uploaded_by: user.id, uploaded_by_name: profile?.full_name || 'Teacher',
        moment_date: today
      })
      setMomentCaption('')
      setMomentPreview(null)
      setMomentFile(null)
      if (momentFileRef.current) momentFileRef.current.value = ''
      await fetchMoments()
      alert('Photo uploaded!')
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploadingMoment(false)
  }

  const deleteMoment = async (id, storagePath) => {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('classroom-moments').remove([storagePath])
    await supabase.from('classroom_moments').delete().eq('id', id)
    fetchMoments()
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

  const getTodayBirthdays = () => {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return birthdayStudents.filter(s => s.date_of_birth && s.date_of_birth.slice(5) === `${mm}-${dd}`)
  }

  const getMonthBirthdays = () => {
    const mm = String(new Date().getMonth() + 1).padStart(2, '0')
    return birthdayStudents.filter(s => s.date_of_birth && s.date_of_birth.slice(5, 7) === mm)
      .sort((a, b) => a.date_of_birth.slice(8) - b.date_of_birth.slice(8))
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const present = attendance.filter(a => a.status === 'present').length
  const absent = attendance.filter(a => a.status === 'absent').length

  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'attendance', label: 'Attendance', icon: '✅' },
    { id: 'curriculum', label: 'Curriculum', icon: '📚' },
    { id: 'moments', label: 'Moments', icon: '📸' },
    { id: 'students', label: 'Students', icon: '👶' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'progress', label: 'Progress', icon: '📊' },
    { id: 'leave', label: 'Leave', icon: '🏖️' },
    { id: 'checkin', label: 'Check-in', icon: '🚪' },
    { id: 'holidays', label: 'Holidays', icon: '📅' },
    { id: 'payslip', label: 'Payslip', icon: '💰' },
    { id: 'homeactivities', label: 'Home Activities', icon: '🏠' },
    { id: 'ptm', label: 'PTM', icon: '🤝' },
    { id: 'birthdays', label: 'Birthdays', icon: '🎂' },
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
                  <div className="stat-card"><div className="stat-value" style={{ color: '#38bdf8' }}>{students.length}</div><div className="stat-label">👶 My Students</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: '#10b981' }}>{present}</div><div className="stat-label">✅ Present Today</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: '#ef4444' }}>{absent}</div><div className="stat-label">❌ Absent Today</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: '#f59e0b' }}>{announcements.length}</div><div className="stat-label">📢 Announcements</div></div>
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
                            </div>
                            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{item.planned_activity || 'Activity'}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.activity_category} · {item.activity_type}</div>
                            {item.materials_needed && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>🧰 {item.materials_needed}</div>}
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

            {activeTab === 'moments' && (
              <>
                <div className="section-title">📸 Classroom Moments</div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ color: '#38bdf8', marginBottom: '16px', fontSize: '15px' }}>📤 Upload Today's Photo</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '13px' }}>Class *</label>
                      <select value={momentClass} onChange={e => setMomentClass(e.target.value)}
                        style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                        <option value=''>-- Select Class --</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '13px' }}>Caption (optional)</label>
                      <input placeholder='e.g. Art activity today!' value={momentCaption} onChange={e => setMomentCaption(e.target.value)}
                        style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                    </div>
                  </div>
                  <input ref={momentFileRef} type='file' accept='image/jpeg,image/png,image/webp'
                    onChange={e => { const f = e.target.files[0]; if (f) { setMomentFile(f); setMomentPreview(URL.createObjectURL(f)) } }}
                    style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }} />
                  {momentPreview && <img src={momentPreview} alt='preview' style={{ maxHeight: '150px', borderRadius: '8px', marginBottom: '12px', display: 'block' }} />}
                  <button onClick={uploadMoment} disabled={uploadingMoment}
                    style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {uploadingMoment ? '⏳ Uploading...' : '📤 Upload'}
                  </button>
                </div>
                {moments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No photos yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {moments.map(m => (
                      <div key={m.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <img src={m.photo_url} alt={m.caption} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                        <div style={{ padding: '10px' }}>
                          {m.caption && <p style={{ color: '#e2e8f0', fontSize: '12px', marginBottom: '6px' }}>{m.caption}</p>}
                          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px' }}>📚 {m.class_name} · {m.moment_date}</div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a href={m.photo_url} target='_blank' download style={{ flex: 1, padding: '5px', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', borderRadius: '6px', fontSize: '11px', textDecoration: 'none', textAlign: 'center' }}>⬇️ Save</a>
                            <button onClick={() => deleteMoment(m.id, m.storage_path)} style={{ flex: 1, padding: '5px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>🗑️ Del</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'messages' && (
              <>
                <div className="section-title">💬 Parent Messages</div>
                {parents.filter(p => messages.some(m => m.sender_id === p.id || m.receiver_id === p.id)).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No messages yet from parents.</div>
                ) : parents.filter(p => messages.some(m => m.sender_id === p.id || m.receiver_id === p.id)).map(parent => {
                  const convo = messages.filter(m => m.sender_id === parent.id || m.receiver_id === parent.id)
                  return (
                    <div key={parent.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#38bdf8' }}>👪 {parent.full_name}</div>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{convo.length} messages</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                        {convo.map(m => {
                          const isSent = m.sender_id !== parent.id
                          return (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
                              <div style={{ padding: '10px 14px', borderRadius: '12px', maxWidth: '75%', fontSize: '14px', lineHeight: 1.5,
                                backgroundColor: isSent ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)',
                                border: isSent ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(255,255,255,0.1)',
                                borderBottomRightRadius: isSent ? '4px' : '12px',
                                borderBottomLeftRadius: isSent ? '12px' : '4px' }}>
                                {m.content}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '2px 4px 8px' }}>
                                {isSent ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleString()}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input placeholder='Type a reply...'
                          value={replyingTo === parent.id ? replyText : ''}
                          onChange={e => { setReplyingTo(parent.id); setReplyText(e.target.value) }}
                          onFocus={() => setReplyingTo(parent.id)}
                          style={{ flex: 1, padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                        <button onClick={sendReply} disabled={sendingReply}
                          style={{ padding: '10px 16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                          {sendingReply ? '...' : '📤'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {activeTab === 'progress' && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>Student Progress Tracking</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '24px' }}>Rate skills per term and send reports to parents</div>
                <a href='/teacher/progress'
                  style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', textDecoration: 'none', display: 'inline-block' }}>
                  📊 Open Progress Tracker
                </a>
              </div>
            )}

            {activeTab === 'checkin' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div className="section-title" style={{ margin: 0 }}>🚪 My Attendance</div>
                  <button onClick={() => { setScanResult(null); setShowScanner(true) }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    📷 Scan Gate QR
                  </button>
                </div>

                {scanResult && (
                  <div style={{ background: scanResult.type === 'success' ? 'rgba(16,185,129,0.15)' : scanResult.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.1)', border: `1px solid ${scanResult.type === 'success' ? 'rgba(16,185,129,0.3)' : scanResult.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.2)'}`, borderRadius: '14px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>{scanResult.action === 'checkin' ? '✅' : scanResult.action === 'checkout' ? '👋' : scanResult.type === 'error' ? '❌' : 'ℹ️'}</div>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>{profile?.full_name}</div>
                    <div style={{ color: scanResult.type === 'success' ? '#34d399' : scanResult.type === 'error' ? '#f87171' : '#38bdf8', fontSize: '15px' }}>{scanResult.message}</div>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                  <div style={{ fontWeight: '600', marginBottom: '8px' }}>How to check in</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: '1.8' }}>
                    1. Click <strong style={{ color: '#38bdf8' }}>📷 Scan Gate QR</strong> button above<br/>
                    2. Point camera at the QR code at school entrance<br/>
                    3. Check-in/out recorded automatically!<br/>
                    4. Scan again when leaving to check out
                  </div>
                </div>
              </>
            )} 

            {activeTab === 'holidays' && (
              <>
                <div className="section-title">📅 Holiday Calendar</div>
                {holidays.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No holidays announced yet.</div>
                ) : holidays.map(h => {
                  const isUpcoming = new Date(h.from_date) >= new Date()
                  const isPast = new Date(h.to_date) < new Date()
                  const typeColor = {
                    'National Holiday': '#f87171', 'School Holiday': '#38bdf8',
                    'Program-specific Holiday': '#a78bfa', 'Staff Holiday': '#34d399', 'Optional Holiday': '#fbbf24'
                  }
                  return (
                    <div key={h.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${isUpcoming ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '16px', marginBottom: '10px', opacity: isPast ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{h.name}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${typeColor[h.holiday_type]}22`, color: typeColor[h.holiday_type] }}>{h.holiday_type}</span>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📅 {h.from_date}{h.to_date !== h.from_date ? ` → ${h.to_date}` : ''}</span>
                            {h.is_optional && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Optional</span>}
                          </div>
                          {h.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{h.description}</div>}
                        </div>
                        {isUpcoming && <span style={{ padding: '4px 12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Upcoming</span>}
                        {isPast && <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', borderRadius: '20px', fontSize: '12px' }}>Past</span>}
                      </div>
                    </div>
                  )
                })}
              </>
            )} 

            {activeTab === 'payslip' && (
              <>
                <div className="section-title">💰 My Payslips</div>
                {payslips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No payslips generated yet.</div>
                ) : payslips.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '12px', cursor: 'pointer' }}
                    onClick={() => setSelectedPayslip(p)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>📅 {p.month}</div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#10b981', fontSize: '13px' }}>✅ {p.present_days} Present</span>
                          <span style={{ color: '#ef4444', fontSize: '13px' }}>❌ {p.absent_days} Absent</span>
                          <span style={{ color: '#f59e0b', fontSize: '13px' }}>⏰ {p.late_days} Late</span>
                          {p.leave_days > 0 && <span style={{ color: '#a78bfa', fontSize: '13px' }}>🏖️ {p.leave_days} Leave</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '20px' }}>₹{Number(p.net_pay).toLocaleString()}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Net Pay</div>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: p.status === 'finalized' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'finalized' ? '#34d399' : '#fbbf24' }}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeTab === 'ptm' && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>Parent Teacher Meeting</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '24px' }}>Manage your PTM slots, bookings and meeting notes</div>
                <a href='/teacher/ptm'
                  style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', textDecoration: 'none', display: 'inline-block' }}>
                  🤝 Open PTM Portal
                </a>
              </div>
            )}

            {activeTab === 'homeactivities' && (
              <>
                <div className="section-title">🏠 Home Activity Completions</div>
                {homeActivities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No home activities yet.</div>
                ) : homeActivities.map(activity => {
                  const completedStudents = activityCompletions.filter(c => c.activity_id === activity.id)
                  const totalStudents = students.filter(s => s.program === activity.program).length
                  const pct = totalStudents > 0 ? Math.round((completedStudents.length / totalStudents) * 100) : 0
                  return (
                    <div key={activity.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '2px' }}>{activity.title}</div>
                          <div style={{ color: '#a78bfa', fontSize: '12px' }}>{activity.program} · {activity.month}</div>
                          {activity.goal && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>🎯 {activity.goal}</div>}
                        </div>
                        <span style={{ color: '#10b981', fontWeight: '700', fontSize: '15px' }}>{completedStudents.length}/{totalStudents} done</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{ height: '100%', background: pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '4px', width: `${pct}%` }} />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {completedStudents.map(c => (
                          <span key={c.id} style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✅ {c.students?.full_name}</span>
                        ))}
                        {students.filter(s => s.program === activity.program && !completedStudents.find(c => c.student_id === s.id)).map(s => (
                          <span key={s.id} style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>○ {s.full_name}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {activeTab === 'leave' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="section-title" style={{ margin: 0 }}>🏖️ Leave Management</div>
                  <button onClick={() => setShowLeaveForm(!showLeaveForm)}
                    style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                    + Apply Leave
                  </button>
                </div>

                {leaveBalance && (
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '14px' }}>⚖️ Leave Balance</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      {[
                        { label: 'Casual', used: leaveBalance.casual_used, total: leaveBalance.casual_total, color: '#38bdf8' },
                        { label: 'Sick', used: leaveBalance.sick_used, total: leaveBalance.sick_total, color: '#a78bfa' },
                        { label: 'Annual', used: leaveBalance.annual_used, total: leaveBalance.annual_total, color: '#10b981' },
                        { label: 'Emergency', used: leaveBalance.emergency_used, total: leaveBalance.emergency_total, color: '#f59e0b' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                          <div style={{ color: item.color, fontWeight: '700', fontSize: '20px' }}>{item.total - item.used}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>{item.label}</div>
                          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>{item.used}/{item.total} used</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showLeaveForm && (
                  <div style={{ backgroundColor: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '16px', color: '#38bdf8' }}>📝 Apply for Leave</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Leave Type</label>
                        <select value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                          {['Casual Leave', 'Sick Leave', 'Annual Leave', 'Emergency Leave'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Reason</label>
                        <input value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                          placeholder='Brief reason...'
                          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                      </div>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>From Date</label>
                        <input type='date' value={leaveForm.from_date} onChange={e => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                      </div>
                      <div>
                        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>To Date</label>
                        <input type='date' value={leaveForm.to_date} onChange={e => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                      </div>
                    </div>
                    <button onClick={applyLeave} disabled={submittingLeave}
                      style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                      {submittingLeave ? '⏳ Submitting...' : '📤 Submit Leave Request'}
                    </button>
                  </div>
                )}

                <div className="section-title">📋 My Leave History</div>
                {leaveRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No leave requests yet.</div>
                ) : leaveRequests.map(req => (
                  <div key={req.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{req.leave_type} · {req.no_of_days} day{req.no_of_days > 1 ? 's' : ''}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📅 {req.from_date} → {req.to_date}</div>
                        {req.reason && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '2px' }}>{req.reason}</div>}
                        {req.admin_comment && <div style={{ color: '#f87171', fontSize: '13px', marginTop: '4px' }}>Admin: {req.admin_comment}</div>}
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                        background: req.status === 'approved' ? 'rgba(16,185,129,0.15)' : req.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: req.status === 'approved' ? '#34d399' : req.status === 'rejected' ? '#f87171' : '#fbbf24' }}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="section-title" style={{ marginTop: '24px' }}>👶 Student Absence Notifications</div>
                {studentAbsences.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No absence notifications.</div>
                ) : studentAbsences.map(ab => (
                  <div key={ab.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid ${ab.acknowledged ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '14px', padding: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{ab.students?.full_name}</div>
                      <div style={{ color: '#a78bfa', fontSize: '13px' }}>{ab.students?.program} · 📅 {ab.absence_date}</div>
                      {ab.reason && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '2px' }}>Reason: {ab.reason}</div>}
                    </div>
                    {ab.acknowledged ? (
                      <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>✅ Acknowledged</span>
                    ) : (
                      <button onClick={() => acknowledgeAbsence(ab.id)}
                        style={{ padding: '6px 14px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                        👍 Acknowledge
                      </button>
                    )}
                  </div>
                ))}
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

            {activeTab === 'birthdays' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>🎂 Student Birthdays</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Birthdays for students in your programs</div>
                </div>

                {/* Today's Birthdays */}
                {getTodayBirthdays().length > 0 && (
                  <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.05))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', color: '#fbbf24', marginBottom: '14px' }}>🎂 Today's Birthdays!</div>
                    {getTodayBirthdays().map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#000', fontSize: '16px' }}>
                          {s.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '15px' }}>{s.full_name} 🎂</div>
                          <div style={{ color: '#fbbf24', fontSize: '13px' }}>{s.program} · Birthday Today!</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* This Month */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '14px', fontSize: '15px' }}>
                    📋 This Month's Birthdays ({getMonthBirthdays().length})
                  </div>
                  {getMonthBirthdays().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)' }}>No birthdays this month</div>
                  ) : getMonthBirthdays().map(s => {
                    const day = s.date_of_birth.slice(8)
                    const isToday = getTodayBirthdays().find(t => t.id === s.id)
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isToday ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: isToday ? '#000' : '#fff', flexShrink: 0 }}>
                          {day}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: isToday ? '#fbbf24' : '#fff' }}>{s.full_name} {isToday ? '🎂' : ''}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{s.program}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

          </>
        )}
      </div>
      {selectedPayslip && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
                onClick={() => setSelectedPayslip(null)}>
                <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', marginBottom: '4px' }}>Intelli<span style={{ color: '#38bdf8' }}>Gen</span></div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{profile?.school_name || 'School'}</div>
                    <div style={{ fontWeight: '700', fontSize: '18px', marginTop: '12px' }}>PAYSLIP</div>
                    <div style={{ color: '#38bdf8', fontSize: '14px' }}>{selectedPayslip.month}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>{profile?.full_name}</div>
                    <div style={{ color: '#a78bfa', fontSize: '13px' }}>{profile?.role}</div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Attendance</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[
                        { label: 'Present', value: selectedPayslip.present_days, color: '#10b981' },
                        { label: 'Absent', value: selectedPayslip.absent_days, color: '#ef4444' },
                        { label: 'Late', value: selectedPayslip.late_days, color: '#f59e0b' },
                        { label: 'Leave', value: selectedPayslip.leave_days, color: '#a78bfa' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                          <div style={{ color: item.color, fontWeight: '700', fontSize: '18px' }}>{item.value}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '600', color: '#34d399', marginBottom: '8px' }}>💚 Earnings</div>
                    {[
                      ['Basic Salary', selectedPayslip.basic_salary],
                      ['Overtime Pay', selectedPayslip.overtime_pay],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                        <span style={{ color: '#34d399' }}>₹{Number(value || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: '700' }}>
                      <span>Gross</span>
                      <span style={{ color: '#34d399' }}>₹{Number(selectedPayslip.gross_earnings).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '600', color: '#f87171', marginBottom: '8px' }}>❤️ Deductions</div>
                    {[
                      ['Absent', selectedPayslip.absent_deduction],
                      ['Late', selectedPayslip.late_deduction],
                      ['Half Day', selectedPayslip.half_day_deduction],
                      ['PF', selectedPayslip.pf_deduction],
                      ['ESI', selectedPayslip.esi_deduction],
                      ['Tax', selectedPayslip.tax_deduction],
                    ].filter(([, v]) => Number(v) > 0).map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                        <span style={{ color: '#f87171' }}>₹{Number(value || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: '700' }}>
                      <span>Total Deductions</span>
                      <span style={{ color: '#f87171' }}>₹{Number(selectedPayslip.total_deductions).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontWeight: '700', fontSize: '16px' }}>💰 Net Pay</span>
                    <span style={{ fontWeight: '700', fontSize: '24px', color: '#38bdf8' }}>₹{Number(selectedPayslip.net_pay).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px' }}>🖨️ Print</button>
                    <button onClick={() => setSelectedPayslip(null)} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Close</button>
                  </div>
                </div>
              </div>
            )}
      {showScanner && <QRScanner title='Scan School Gate QR' onScan={handleStaffScan} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
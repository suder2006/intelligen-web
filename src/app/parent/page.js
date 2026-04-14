'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { APP_URL } from '@/lib/config'
import { registerPushNotifications } from '@/lib/pushNotifications'
import dynamic from 'next/dynamic'
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false })

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
  const [showParentScanner, setShowParentScanner] = useState(false)
  const [parentScanResult, setParentScanResult] = useState(null)
  const [holidays, setHolidays] = useState([])
  const [homeActivities, setHomeActivities] = useState([])
  const [activityCompletions, setActivityCompletions] = useState([])
  const [selectedActivityChild, setSelectedActivityChild] = useState(null)
  const [ptmEvents, setPtmEvents] = useState([])
  const [ptmSlots, setPtmSlots] = useState([])
  const [ptmBookings, setPtmBookings] = useState([])
  const [ptmNotes, setPtmNotes] = useState([])
  const [bookingForm, setBookingForm] = useState({ slot_id: '', student_id: '', parent_notes: '' })
  const [bookingSlot, setBookingSlot] = useState(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [schoolId, setSchoolId] = useState(null)
  const [schoolName, setSchoolName] = useState('')
  const [schoolUpi, setSchoolUpi] = useState({ upi_id: '', upi_name: '', upi_description: '' })
  const [studentTransportData, setStudentTransportData] = useState([])
  const [transportLogs, setTransportLogs] = useState([])
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [diaryEntries, setDiaryEntries] = useState([])
  const [diaryAcks, setDiaryAcks] = useState([])
  const [diaryFilter, setDiaryFilter] = useState('all')

  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUser(user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const sid = prof?.school_id
    setSchoolId(sid)
    
    const { data: linkedStudents } = await supabase
      .from('parent_students').select('student_id').eq('parent_id', user.id)
    const studentIds = linkedStudents?.map(ls => ls.student_id) || []

    const [s, f, a, at] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('students').select('*').in('id', studentIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
      supabase.from('fee_invoices').select('*, fee_installments(*)').in('student_id', studentIds.length > 0 ? studentIds : ['__none__']).order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').eq('school_id', sid).order('created_at', { ascending: false }).limit(10),
      supabase.from('attendance').select('*, students(full_name)').in('student_id', studentIds.length > 0 ? studentIds : ['__none__']).order('date', { ascending: false }).limit(60)
    ])
    setStudents(s.data || [])
    setFees(f.data || [])
    setAnnouncements(a.data || [])
    setAttendance(at.data || [])

        // Get school_id from first student if parent has no school_id
    const effectiveSid = sid || s.data?.[0]?.school_id
    setSchoolId(effectiveSid)
    if (effectiveSid) {
      const { data: schoolData } = await supabase.from('schools').select('name, upi_id, upi_name, upi_description').eq('id', effectiveSid).single()
      setSchoolName(schoolData?.name || '')
      setSchoolUpi({ upi_id: schoolData?.upi_id || '', upi_name: schoolData?.upi_name || '', upi_description: schoolData?.upi_description || '' })
    }

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
// Get only teachers assigned to parent's children programs
    const childPrograms = s.data?.map(st => st.program).filter(Boolean) || []
    let teachersData = []
    if (childPrograms.length > 0) {
      const { data: spData } = await supabase.from('staff_programs')
        .select('staff_id').in('program', childPrograms)
      const teacherIds = [...new Set((spData || []).map(p => p.staff_id))]
      if (teacherIds.length > 0) {
        const { data: tData } = await supabase.from('profiles')
          .select('*').in('id', teacherIds).eq('role', 'teacher')
        teachersData = tData || []
      }
    }
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
  // Load holidays for parent's children programs
    const { data: holData } = await supabase.from('holidays')
      .select('*').eq('academic_year', currentAY)
      .or(`applies_to.eq.all,applies_to.eq.students_only`)
      .order('from_date')
    const { data: progHolData } = await supabase.from('holidays')
      .select('*').eq('academic_year', currentAY).eq('applies_to', 'programs').order('from_date')
    const progHols = (progHolData || []).filter(h => h.programs?.some(p => parentPrograms.includes(p)))
    setHolidays([...(holData || []), ...progHols].sort((a, b) => a.from_date.localeCompare(b.from_date)))
    
    // Load home activities
    if (parentPrograms.length > 0) {
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
      const { data: actData } = await supabase.from('home_activities')
        .select('*').eq('academic_year', currentAY)
        .in('program', parentPrograms).order('month').order('order_index')
      setHomeActivities(actData || [])
      // Load completions
      if (studentIds.length > 0) {
        const { data: compData } = await supabase.from('home_activity_completions')
          .select('*').in('student_id', studentIds)
        setActivityCompletions(compData || [])
      }
    }
    // Load PTM data
    if (effectiveSid) {
      const [evRes, slRes, bkRes, ntRes] = await Promise.all([
        supabase.from('ptm_events').select('*').eq('school_id', effectiveSid).in('status', ['upcoming', 'ongoing']).order('from_date'),
        supabase.from('ptm_slots').select('*, profiles!ptm_slots_teacher_id_fkey(full_name)').eq('school_id', effectiveSid).eq('is_available', true).order('slot_date').order('start_time'),
        supabase.from('ptm_bookings').select('*, ptm_slots(*), profiles!ptm_bookings_teacher_id_fkey(full_name)').eq('parent_id', user.id).order('created_at', { ascending: false }),
        supabase.from('ptm_notes').select('*, students(full_name)').eq('parent_id', user.id).eq('shared_with_parent', true).order('created_at', { ascending: false })
      ])
      setPtmEvents(evRes.data || [])
      setPtmSlots(slRes.data || [])
      setPtmBookings(bkRes.data || [])
      setPtmNotes(ntRes.data || [])
    }

    // Load transport data
    if (studentIds.length > 0) {
      const [stRes, tlRes] = await Promise.all([
        supabase.from('student_transport').select('*, transport_routes(*)').in('student_id', studentIds),
        supabase.from('transport_logs').select('*').in('student_id', studentIds)
          .gte('event_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
          .lte('event_time', `${new Date().toISOString().split('T')[0]}T23:59:59`)
          .order('event_time', { ascending: false })
      ])
      setStudentTransportData(stRes.data || [])
      setTransportLogs(tlRes.data || [])
    }

    // Load diary entries
    if (studentIds.length > 0) {
      const childPrograms = s.data?.map(st => st.program).filter(Boolean) || []
      const { data: diaryData } = await supabase.from('diary_entries')
        .select('*, profiles(full_name), students(full_name)')
        .eq('school_id', effectiveSid)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      setDiaryEntries(diaryData || [])
      const { data: ackData } = await supabase.from('diary_acknowledgements')
        .select('*').eq('parent_id', user.id)
      setDiaryAcks(ackData || [])
    }

    // Check if push notifications already enabled
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }

    setLoading(false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTeacher) { alert('Please select a teacher and type a message'); return }
    if (sendingMessage) return
    setSendingMessage(true)
    await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: selectedTeacher,
      content: newMessage,
      sender_name: profile?.full_name || 'Parent'
    })
    // Send push notification to teacher
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [selectedTeacher],
          title: '💬 New Message from Parent',
          body: `${profile?.full_name}: ${newMessage.slice(0, 80)}`,
          url: '/teacher'
        })
      })
    } catch (e) { console.log('Push error:', e) }
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

  const toggleActivityComplete = async (activityId, studentId) => {
    const existing = activityCompletions.find(c => c.activity_id === activityId && c.student_id === studentId)
    if (existing) {
      await supabase.from('home_activity_completions').delete().eq('id', existing.id)
      setActivityCompletions(prev => prev.filter(c => c.id !== existing.id))
    } else {
      const { data } = await supabase.from('home_activity_completions').insert({
        activity_id: activityId, student_id: studentId, parent_id: user.id
      }).select().single()
      if (data) setActivityCompletions(prev => [...prev, data])
    }
  }

  const handleParentScan = async (decodedText) => {
    setShowParentScanner(false)
    // Extract student ID from QR
    const url = new URL(decodedText)
    const studentId = url.searchParams.get('student')
    if (!studentId) {
      setParentScanResult({ type: 'error', message: 'Invalid QR code. Please scan your child\'s ID card QR.' })
      return
    }
    const student = students.find(s => s.id === studentId)
    if (!student) {
      setParentScanResult({ type: 'error', message: 'This student is not linked to your account.' })
      return
    }
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const { data: existing } = await supabase.from('student_checkins').select('*').eq('student_id', studentId).eq('date', today).single()
    if (!existing) {
      await supabase.from('student_checkins').insert({
        student_id: studentId, date: today,
        checkin_time: now.toISOString(),
        checkin_by: user.id, checkin_by_name: profile?.full_name || 'Parent',
        checkin_method: 'qr', school_id: student.school_id
      })
      const { data: attExisting } = await supabase.from('attendance').select('id').eq('student_id', studentId).eq('date', today).single()
      if (!attExisting) {
        await supabase.from('attendance').insert({ student_id: studentId, date: today, status: 'present', checked_in_at: now.toISOString() })
      }
      setParentScanResult({ type: 'success', action: 'checkin', message: `✅ ${student.full_name} checked in at ${now.toLocaleTimeString()}`, name: student.full_name })
    } else if (!existing.checkout_time) {
      await supabase.from('student_checkins').update({
        checkout_time: now.toISOString(),
        checkout_by: user.id, checkout_by_name: profile?.full_name || 'Parent',
        checkout_method: 'qr'
      }).eq('id', existing.id)
      setParentScanResult({ type: 'success', action: 'checkout', message: `👋 ${student.full_name} checked out at ${now.toLocaleTimeString()}`, name: student.full_name })
    } else {
      setParentScanResult({ type: 'info', message: `${student.full_name} already checked in and out today.` })
    }
  }
  const bookSlot = async () => {
    if (!bookingForm.slot_id || !bookingForm.student_id) { alert('Please select slot and child'); return }
    setBookingLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const slot = ptmSlots.find(s => s.id === bookingForm.slot_id)
    // Check if already booked
    const alreadyBooked = ptmBookings.find(b => b.slot_id === bookingForm.slot_id)
    if (alreadyBooked) { alert('This slot is already booked!'); setBookingLoading(false); return }
    await supabase.from('ptm_bookings').insert({
      school_id: schoolId,
      event_id: slot.event_id,
      slot_id: bookingForm.slot_id,
      teacher_id: slot.teacher_id,
      parent_id: user.id,
      student_id: bookingForm.student_id,
      parent_notes: bookingForm.parent_notes,
      status: 'booked'
    })
    // Mark slot as unavailable
    await supabase.from('ptm_slots').update({ is_available: false }).eq('id', bookingForm.slot_id)
    setBookingSlot(null)
    setBookingForm({ slot_id: '', student_id: '', parent_notes: '' })
    await loadData()
    setBookingLoading(false)
    alert('✅ Slot booked successfully!')
  }

  const loadTransportData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: linkedStudents } = await supabase
      .from('parent_students').select('student_id').eq('parent_id', user.id)
    const studentIds = linkedStudents?.map(ls => ls.student_id) || []
    if (studentIds.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    const [stRes, tlRes] = await Promise.all([
      supabase.from('student_transport')
        .select('*, transport_routes(*)').in('student_id', studentIds),
      supabase.from('transport_logs')
        .select('*').in('student_id', studentIds)
        .gte('event_time', `${today}T00:00:00`)
        .lte('event_time', `${today}T23:59:59`)
        .order('event_time', { ascending: false })
    ])

    setStudentTransportData(stRes.data || [])
    setTransportLogs(tlRes.data || [])
  }

  const enablePushNotifications = async () => {
    setPushLoading(true)
    const success = await registerPushNotifications(supabase, user.id, schoolId)
    setPushEnabled(success)
    setPushLoading(false)
    if (success) alert('✅ Push notifications enabled!')
    else alert('❌ Could not enable notifications. Please allow notifications in browser settings.')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

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
    { id: 'absence', label: 'Notify Absence', icon: '📋' },
    { id: 'checkin', label: 'Check-in', icon: '🚪' },
    { id: 'holidays', label: 'Holidays', icon: '📅' },
    { id: 'homeactivities', label: 'Home Activities', icon: '🏠' },
    { id: 'ptm', label: 'PTM', icon: '🤝' },
    { id: 'transport', label: 'Transport', icon: '🚌' },
    { id: 'diary', label: 'Diary', icon: '📔' },
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!pushEnabled && (
            <button onClick={enablePushNotifications} disabled={pushLoading}
              style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              {pushLoading ? '⏳...' : '🔔 Enable Notifications'}
            </button>
          )}
          {pushEnabled && (
            <span style={{ color: '#34d399', fontSize: '13px' }}>🔔 Notifications On</span>
          )}
          <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
        </div>
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
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${APP_URL}/checkin?student=${s.id}`)}`} alt='Student QR' style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#fff', padding: '4px' }} />
                          <div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>Show this QR at school gate or save to phone</div>
                            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${APP_URL}/checkin?student=${s.id}`)}`} download target='_blank'
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

            {activeTab === 'checkin' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div className="section-title" style={{ margin: 0 }}>🚪 Student Check-in</div>
                  <button onClick={() => { setParentScanResult(null); setShowParentScanner(true) }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    📷 Scan Child QR
                  </button>
                </div>

                {parentScanResult && (
                  <div style={{ background: parentScanResult.type === 'success' ? 'rgba(16,185,129,0.15)' : parentScanResult.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.1)', border: `1px solid ${parentScanResult.type === 'success' ? 'rgba(16,185,129,0.3)' : parentScanResult.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.2)'}`, borderRadius: '14px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>{parentScanResult.action === 'checkin' ? '✅' : parentScanResult.action === 'checkout' ? '👋' : parentScanResult.type === 'error' ? '❌' : 'ℹ️'}</div>
                    {parentScanResult.name && <div style={{ fontWeight: '700', marginBottom: '4px' }}>{parentScanResult.name}</div>}
                    <div style={{ color: parentScanResult.type === 'success' ? '#34d399' : parentScanResult.type === 'error' ? '#f87171' : '#38bdf8', fontSize: '15px' }}>{parentScanResult.message}</div>
                  </div>
                )}

                {/* Children with their QRs */}
                {students.map(s => (
                  <div key={s.id} className="card" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{s.full_name?.[0]}</div>
                      <div>
                        <div style={{ fontWeight: '700' }}>{s.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.program}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px' }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${APP_URL}/checkin?student=${s.id}`)}`} alt='QR' style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#fff', padding: '4px' }} />
                      <div>
                        <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>📱 Child's QR Code</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>Show at gate or save to phone</div>
                        <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${APP_URL}/checkin?student=${s.id}`)}`} download target='_blank'
                          style={{ padding: '5px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }}>⬇️ Save QR</a>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', textAlign: 'center', marginTop: '8px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.8' }}>
                    📷 Click <strong style={{ color: '#38bdf8' }}>Scan Child QR</strong> to scan your child's ID card<br/>
                    First scan = Check-in · Second scan = Check-out
                  </div>
                </div>
              </>
            )}  

            {activeTab === 'homeactivities' && (
              <>
                <div className="section-title">🏠 Home Activities</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>Fun activities to do with your child at home this month!</div>

                {/* Child selector if multiple children */}
                {students.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button onClick={() => setSelectedActivityChild(null)}
                      style={{ padding: '7px 16px', borderRadius: '20px', border: `1px solid ${!selectedActivityChild ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: !selectedActivityChild ? 'rgba(56,189,248,0.15)' : 'transparent', color: !selectedActivityChild ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      All Children
                    </button>
                    {students.map(s => (
                      <button key={s.id} onClick={() => setSelectedActivityChild(s.id)}
                        style={{ padding: '7px 16px', borderRadius: '20px', border: `1px solid ${selectedActivityChild === s.id ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`, background: selectedActivityChild === s.id ? 'rgba(167,139,250,0.15)' : 'transparent', color: selectedActivityChild === s.id ? '#a78bfa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                        {s.full_name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Activities grouped by child */}
                {(selectedActivityChild ? students.filter(s => s.id === selectedActivityChild) : students).map(child => {
                  const childActivities = homeActivities.filter(a => a.program === child.program)
                  if (childActivities.length === 0) return null
                  // Group by month
                  const months = [...new Set(childActivities.map(a => a.month))]
                  return (
                    <div key={child.id} style={{ marginBottom: '28px' }}>
                      {students.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{child.full_name?.[0]}</div>
                          <div>
                            <div style={{ fontWeight: '700' }}>{child.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px' }}>{child.program}</div>
                          </div>
                        </div>
                      )}
                      {months.map(month => {
                        const monthActivities = childActivities.filter(a => a.month === month)
                        const completedCount = monthActivities.filter(a => activityCompletions.some(c => c.activity_id === a.id && c.student_id === child.id)).length
                        return (
                          <div key={month} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ fontWeight: '600', color: '#38bdf8', fontSize: '15px' }}>📅 {month}</div>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{completedCount}/{monthActivities.length} done</span>
                            </div>
                            {monthActivities.map(activity => {
                              const isCompleted = activityCompletions.some(c => c.activity_id === activity.id && c.student_id === child.id)
                              return (
                                <div key={activity.id} className="card" style={{ borderColor: isCompleted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)', background: isCompleted ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.04)', marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{activity.title}</div>
                                      {activity.goal && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '4px' }}>🎯 {activity.goal}</div>}
                                      {activity.skills_built && <div style={{ color: '#a78bfa', fontSize: '12px' }}>⚡ Skills: {activity.skills_built}</div>}
                                    </div>
                                    <button onClick={() => toggleActivityComplete(activity.id, child.id)}
                                      style={{ padding: '8px 14px', background: isCompleted ? '#10b981' : 'rgba(255,255,255,0.06)', border: `1px solid ${isCompleted ? '#10b981' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', color: isCompleted ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {isCompleted ? '✅ Done!' : '○ Mark Done'}
                                    </button>
                                  </div>
                                  {activity.you_need && (
                                    <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                      <div style={{ color: '#38bdf8', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>🧰 YOU NEED</div>
                                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{activity.you_need}</div>
                                    </div>
                                  )}
                                  {activity.do_this && (
                                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                      <div style={{ color: '#34d399', fontWeight: '600', fontSize: '12px', marginBottom: '6px' }}>✅ DO THIS</div>
                                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{activity.do_this}</div>
                                    </div>
                                  )}
                                  {activity.video_link && (
                                    <a href={activity.video_link} target='_blank' rel='noreferrer'
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                                      ▶️ Watch Video Guide
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {homeActivities.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏠</div>
                    <div>No home activities yet. Check back soon!</div>
                  </div>
                )}
              </>
            )}
            {activeTab === 'ptm' && (
              <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>🤝 Parent Teacher Meeting</div>
                  <button onClick={loadData} style={{ padding: '6px 14px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>🔄 Refresh Slots</button>
                </div>

                {/* Upcoming Events */}
                {ptmEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
                    <div>No PTM events scheduled yet.</div>
                  </div>
                ) : ptmEvents.map(event => {
                  const eventSlots = ptmSlots.filter(s => s.event_id === event.id)
                  const eventBookings = ptmBookings.filter(b => b.event_id === event.id)
                  return (
                    <div key={event.id} className="card" style={{ marginBottom: '20px' }}>
                      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{event.title}</div>
                      {event.description && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '8px' }}>{event.description}</div>}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📅 {event.from_date}{event.to_date && event.to_date !== event.from_date ? ` → ${event.to_date}` : ''}</span>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>{event.meeting_type}</span>
                      </div>

                      {/* Already booked slots */}
                      {eventBookings.length > 0 && (
                        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                          <div style={{ color: '#34d399', fontWeight: '600', fontSize: '13px', marginBottom: '8px' }}>✅ Your Bookings</div>
                          {eventBookings.map(b => (
                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '600' }}>{b.ptm_slots?.slot_date} at {b.ptm_slots?.start_time}</div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>👩‍🏫 {b.profiles?.full_name}</div>
                                {b.ptm_slots?.meeting_type === 'online' && b.ptm_slots?.meeting_link && (
                                  <a href={b.ptm_slots.meeting_link} target='_blank' rel='noreferrer'
                                    style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>🔗 Join Meeting</a>
                                )}
                                {b.ptm_slots?.meeting_type === 'in-person' && b.ptm_slots?.location && (
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>📍 {b.ptm_slots.location}</div>
                                )}
                              </div>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                                background: b.status === 'confirmed' ? 'rgba(16,185,129,0.15)' : b.status === 'completed' ? 'rgba(167,139,250,0.15)' : 'rgba(56,189,248,0.15)',
                                color: b.status === 'confirmed' ? '#34d399' : b.status === 'completed' ? '#a78bfa' : '#38bdf8' }}>{b.status}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Available slots */}
                      {eventSlots.length > 0 && eventBookings.length === 0 && (
                        <>
                          <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Available Slots:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {[...new Set(eventSlots.map(s => s.slot_date))].sort().map(date => (
                              <div key={date} style={{ marginBottom: '10px', width: '100%' }}>
                                <div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                                  📅 {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {eventSlots.filter(s => s.slot_date === date).map(slot => (
                                    /* <button key={slot.id} onClick={() => { setBookingSlot(slot); setBookingForm({ slot_id: slot.id, student_id: students[0]?.id || '', parent_notes: '' }) }} */
                                    <button key={slot.id} onClick={() => { console.log('Slot selected:', slot); setBookingSlot(slot); setBookingForm({ slot_id: slot.id, student_id: '', parent_notes: '' }) }}  /* debug */
                                    style={{ padding: '8px 14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                                      {slot.start_time} - {slot.end_time}
                                      <span style={{ marginLeft: '6px', fontSize: '11px', color: slot.meeting_type === 'online' ? '#a78bfa' : '#34d399' }}>
                                        {slot.meeting_type === 'online' ? '💻' : '🏫'}
                                      </span>
                                      <span style={{ marginLeft: '4px', color: '#94a3b8', fontSize: '11px' }}>{slot.profiles?.full_name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {eventSlots.length === 0 && eventBookings.length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No slots available yet. Check back soon!</div>
                      )}
                    </div>
                  )
                })}

                {/* Meeting Notes from Teacher */}
                {ptmNotes.length > 0 && (
                  <>
                    <div className="section-title" style={{ marginTop: '24px' }}>📝 Meeting Notes from Teacher</div>
                    {ptmNotes.map(note => (
                      <div key={note.id} className="card">
                        <div style={{ fontWeight: '700', marginBottom: '8px' }}>{note.students?.full_name}</div>
                        {note.discussion_points && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>💬 Discussion Points</div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.discussion_points}</div>
                          </div>
                        )}
                        {note.action_items && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>✅ Action Items</div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.action_items}</div>
                          </div>
                        )}
                        {note.teacher_observations && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>👁️ Teacher Observations</div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.teacher_observations}</div>
                          </div>
                        )}
                        {note.follow_up_required && (
                          <div style={{ color: '#fbbf24', fontSize: '13px', marginTop: '6px' }}>⚠️ Follow-up: {note.follow_up_notes}</div>
                        )}
                      </div>
                    ))}
                  </>
                )}
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

            {activeTab === 'transport' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>🚌 Transport Tracker</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Today's transport status for your child</div>
                </div>

                {(() => {
                  const EVENT_TYPES = [
                    { id: 'morning_pickup', label: 'Morning Pickup', icon: '🌅', color: '#38bdf8', desc: 'Boarded van from home' },
                    { id: 'school_drop', label: 'Arrived at School', icon: '🏫', color: '#34d399', desc: 'Reached school safely' },
                    { id: 'school_pickup', label: 'Left School', icon: '🎒', color: '#fbbf24', desc: 'Boarded van to go home' },
                    { id: 'home_drop', label: 'Dropped at Home', icon: '🏠', color: '#a78bfa', desc: 'Reached home safely' },
                  ]

                  if (studentTransportData.length === 0) return (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
                      <div>Your child is not assigned to any transport route.</div>
                      <div style={{ fontSize: '13px', marginTop: '8px' }}>Contact school if your child uses school transport.</div>
                    </div>
                  )

                  return studentTransportData.map(ct => {
                    const route = ct.transport_routes
                    const studentLogs = transportLogs.filter(l => l.student_id === ct.student_id)
                    const student = students.find(s => s.id === ct.student_id)

                    return (
                      <div key={ct.id} style={{ marginBottom: '24px' }}>
                        {/* Student name if multiple children */}
                        {students.length > 1 && student && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{student.full_name?.[0]}</div>
                            <div style={{ fontWeight: '700' }}>{student.full_name}</div>
                          </div>
                        )}

                        {/* Route Info Card */}
                        <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(56,189,248,0.05))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px', color: '#38bdf8' }}>🚌 {route?.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                            {route?.vehicle_number && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>VEHICLE</div>
                                <div style={{ fontWeight: '700', color: '#fbbf24' }}>🚌 {route.vehicle_number}</div>
                              </div>
                            )}
                            {route?.driver_name && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>DRIVER</div>
                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{route.driver_name}</div>
                                {route.driver_phone && (
                                  <a href={`tel:${route.driver_phone}`} style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞 {route.driver_phone}</a>
                                )}
                              </div>
                            )}
                            {route?.caretaker_name && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>CARETAKER</div>
                                <div style={{ fontWeight: '600', fontSize: '13px' }}>{route.caretaker_name}</div>
                                {route.caretaker_phone && (
                                  <a href={`tel:${route.caretaker_phone}`} style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞 {route.caretaker_phone}</a>
                                )}
                              </div>
                            )}
                            {route?.morning_pickup_time && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>PICKUP TIME</div>
                                <div style={{ fontWeight: '700', color: '#38bdf8' }}>🌅 {route.morning_pickup_time}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Today's Journey Timeline */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '16px' }}>
                            📍 Today's Journey
                            <button onClick={loadTransportData} style={{ marginLeft: '10px', padding: '4px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>🔄 Refresh</button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {EVENT_TYPES.map((evt, idx) => {
                              const log = studentLogs.find(l => l.event_type === evt.id)
                              const isDone = !!log
                              return (
                                <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isDone ? `${evt.color}22` : 'rgba(255,255,255,0.05)', border: `2px solid ${isDone ? evt.color : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                                      {isDone ? '✅' : evt.icon}
                                    </div>
                                    {idx < EVENT_TYPES.length - 1 && (
                                      <div style={{ width: '2px', height: '16px', background: isDone ? evt.color : 'rgba(255,255,255,0.08)', marginTop: '2px' }} />
                                    )}
                                  </div>
                                  <div style={{ flex: 1, padding: '10px 14px', background: isDone ? `${evt.color}0d` : 'rgba(255,255,255,0.02)', border: `1px solid ${isDone ? evt.color + '33' : 'rgba(255,255,255,0.05)'}`, borderRadius: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <div style={{ fontWeight: '600', fontSize: '13px', color: isDone ? evt.color : 'rgba(255,255,255,0.4)' }}>{evt.label}</div>
                                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{evt.desc}</div>
                                      </div>
                                      {isDone && log && (
                                        <div style={{ textAlign: 'right' }}>
                                          <div style={{ color: evt.color, fontWeight: '700', fontSize: '13px' }}>
                                            {new Date(log.event_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
                                            {log.method === 'qr_scan' ? '📷 QR' : '✋ Manual'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Parent Confirm Receipt */}
                        {studentLogs.find(l => l.event_type === 'home_drop') && !studentLogs.find(l => l.event_type === 'parent_confirmed') && (
                          <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏠</div>
                            <div style={{ fontWeight: '700', marginBottom: '4px' }}>Child has been dropped!</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '14px' }}>Please confirm you have received your child safely.</div>
                            <button onClick={async () => {
                              const { data: { user } } = await supabase.auth.getUser()
                              await supabase.from('transport_logs').insert({
                                school_id: ct.school_id || schoolId,
                                student_id: ct.student_id,
                                route_id: ct.route_id,
                                event_type: 'parent_confirmed',
                                event_time: new Date().toISOString(),
                                marked_by: user.id,
                                method: 'manual'
                              })
                              await loadTransportData()
                            }}
                              style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #a78bfa, #c4b5fd)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                              ✅ Yes, Child Received Safely!
                            </button>
                          </div>
                        )}

                        {studentLogs.find(l => l.event_type === 'parent_confirmed') && (
                          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ color: '#34d399', fontWeight: '700' }}>✅ Receipt Confirmed — Child is safely home!</div>
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </>
            )}

            {activeTab === 'diary' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>📔 Diary</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Daily notes from your child's teacher</div>
                </div>

                {(() => {
                  const NOTE_TYPES = [
                    { id: 'general', label: 'General Note', icon: '📝', color: '#38bdf8' },
                    { id: 'activity', label: 'Daily Activity', icon: '🎨', color: '#a78bfa' },
                    { id: 'food', label: 'Food/Meal', icon: '🍱', color: '#10b981' },
                    { id: 'behavior', label: 'Behavior', icon: '⭐', color: '#f59e0b' },
                    { id: 'homework', label: 'Homework', icon: '📚', color: '#f87171' },
                  ]

                  const isAcknowledged = (entryId) => diaryAcks.some(a => a.diary_entry_id === entryId)

                  const acknowledgeEntry = async (entry) => {
                    const { data: { user } } = await supabase.auth.getUser()
                    const student = students.find(s => entry.is_class_note ? s.program === entry.program : s.id === entry.student_id)
                    await supabase.from('diary_acknowledgements').insert({
                      diary_entry_id: entry.id,
                      parent_id: user.id,
                      student_id: student?.id || null
                    })
                    const { data: ackData } = await supabase.from('diary_acknowledgements').select('*').eq('parent_id', user.id)
                    setDiaryAcks(ackData || [])
                  }

                  const filtered = diaryEntries.filter(e => {
                    if (diaryFilter !== 'all' && e.note_type !== diaryFilter) return false
                    // Show individual notes for parent's children or class notes for their program
                    const childIds = students.map(s => s.id)
                    const childPrograms = students.map(s => s.program)
                    if (e.is_class_note) return childPrograms.includes(e.program)
                    return childIds.includes(e.student_id)
                  })

                  const unacknowledged = filtered.filter(e => !isAcknowledged(e.id)).length

                  return (
                    <>
                      {/* Unacknowledged alert */}
                      {unacknowledged > 0 && (
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#fbbf24', fontWeight: '600', fontSize: '14px' }}>📬 {unacknowledged} unread note{unacknowledged > 1 ? 's' : ''} from teacher</div>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Tap to acknowledge</span>
                        </div>
                      )}

                      {/* Filter tabs */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[['all', '📔 All'], ...NOTE_TYPES.map(n => [n.id, `${n.icon} ${n.label}`])].map(([id, label]) => (
                          <button key={id} onClick={() => setDiaryFilter(id)}
                            style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${diaryFilter === id ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: diaryFilter === id ? 'rgba(56,189,248,0.15)' : 'transparent', color: diaryFilter === id ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Diary entries */}
                      {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📔</div>
                          <div>No diary entries yet.</div>
                        </div>
                      ) : filtered.map(entry => {
                        const noteType = NOTE_TYPES.find(n => n.id === entry.note_type)
                        const acknowledged = isAcknowledged(entry.id)
                        return (
                          <div key={entry.id} style={{ background: acknowledged ? 'rgba(255,255,255,0.03)' : 'rgba(245,158,11,0.04)', border: `1px solid ${acknowledged ? 'rgba(255,255,255,0.07)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '14px', padding: '16px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: `${noteType?.color}22`, color: noteType?.color }}>
                                {noteType?.icon} {noteType?.label}
                              </span>
                              {entry.is_class_note ? (
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>👥 Class Note</span>
                              ) : (
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>👶 {entry.students?.full_name}</span>
                              )}
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>📅 {entry.date}</span>
                              {!acknowledged && <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontWeight: '600' }}>🔔 New</span>}
                            </div>

                            {entry.title && <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{entry.title}</div>}
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{entry.content}</div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                                👩‍🏫 {entry.profiles?.full_name} · {new Date(entry.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </span>
                              {acknowledged ? (
                                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✅ Acknowledged</span>
                              ) : (
                                <button onClick={() => acknowledgeEntry(entry)}
                                  style={{ padding: '6px 16px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                                  👍 Acknowledge
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
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
      {showParentScanner && <QRScanner title="Scan Child's ID Card QR" onScan={handleParentScan} onClose={() => setShowParentScanner(false)} />}
      {/* UPI Payment Modal */}
      {paymentModal && (() => {
        const pendingAmount = Number(paymentModal.total_amount) - Number(paymentModal.paid_amount || 0)
        const upiId = schoolUpi.upi_id
        const upiName = schoolUpi.upi_name || schoolName  
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
            receiver_id: schoolId,
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
    {/* PTM Booking Modal */}
      {bookingSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
          onClick={() => setBookingSlot(null)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>🤝 Book PTM Slot</h3>
            <p style={{ color: '#38bdf8', fontSize: '14px', marginBottom: '20px' }}>
              📅 {bookingSlot.slot_date} · {bookingSlot.start_time} - {bookingSlot.end_time}
              · {bookingSlot.meeting_type === 'online' ? '💻 Online' : '🏫 In-Person'}
              · 👩‍🏫 {bookingSlot.profiles?.full_name}
            </p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Child *</label>
            <select value={bookingForm.student_id} onChange={e => setBookingForm({ ...bookingForm, student_id: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }}>
              <option value=''>-- Select Child --</option>
                {students.filter(s => {
                // Filter by slot's program directly
                if (!bookingSlot.program) return true // no program restriction
                return s.program === bookingSlot.program
              }).map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.program})</option>)}
            </select>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Notes for Teacher (optional)</label>
            <textarea value={bookingForm.parent_notes} onChange={e => setBookingForm({ ...bookingForm, parent_notes: e.target.value })}
              placeholder="e.g. I want to discuss my child\'s progress in reading..."
              rows={3} style={{ width: '100%', padding: '10px 14px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setBookingSlot(null)}
                style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button onClick={bookSlot} disabled={bookingLoading}
                style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {bookingLoading ? '⏳ Booking...' : '✅ Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
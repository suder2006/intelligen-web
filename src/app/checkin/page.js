'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

const SCHOOL_TOKEN = 'TIMEKIDS2026'
const SCHOOL_ID = '554c668d-1668-474b-a8aa-f529941dbcf6'

function CheckinContent() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [students, setStudents] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const studentId = searchParams.get('student')

  useEffect(() => { init() }, [])

  const init = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (token === SCHOOL_TOKEN && prof?.role !== 'parent') {
        await processStaffCheckin(user, prof)
        setLoading(false)
        return
      }
    }
    const { data: sData } = await supabase.from('students').select('*').eq('status', 'active').order('full_name')
    setStudents(sData || [])
    // Handle student QR scan
    if (studentId && sData) {
      const student = sData.find(s => s.id === studentId)
      if (student) await processStudentCheckin(student, 'qr', user)
    }
    setLoading(false)
  }

  const processStaffCheckin = async (u, prof) => {
    if (!u || !prof) return
    setProcessing(true)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const timeStr = now.toTimeString().slice(0, 5)
    const { data: existing } = await supabase.from('staff_attendance')
      .select('*').eq('staff_id', u.id).eq('date', today).single()
    if (!existing) {
      const { data: grpData } = await supabase.from('staff_type_groups')
        .select('*').eq('id', prof.staff_group_id).single()
      let status = 'present'
      if (grpData) {
        if (timeStr > grpData.halfday_before) status = 'half_day'
        else if (timeStr > grpData.late_before) status = 'late'
      }
      await supabase.from('staff_attendance').insert({
        staff_id: u.id, date: today,
        checkin_time: now.toISOString(),
        status, marked_by: 'qr', school_id: SCHOOL_ID
      })
      setResult({ type: 'success', action: 'checkin', message: `✅ Check-in recorded at ${now.toLocaleTimeString()}`, status, name: prof.full_name })
    } else if (!existing.checkout_time) {
      const checkinTime = new Date(existing.checkin_time)
      const workingHours = ((now - checkinTime) / (1000 * 60 * 60)).toFixed(1)
      await supabase.from('staff_attendance').update({
        checkout_time: now.toISOString(), working_hours: parseFloat(workingHours)
      }).eq('id', existing.id)
      setResult({ type: 'success', action: 'checkout', message: `👋 Check-out recorded at ${now.toLocaleTimeString()}`, workingHours, name: prof.full_name })
    } else {
      setResult({ type: 'info', message: `Already checked in and out today.`, name: prof.full_name })
    }
    setProcessing(false)
  }

  const processStudentCheckin = async (student, method = 'qr', u) => {
    setProcessing(true)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentUser = u || user
    const { data: existing } = await supabase.from('student_checkins')
      .select('*').eq('student_id', student.id).eq('date', today).single()
    if (!existing) {
      await supabase.from('student_checkins').insert({
        student_id: student.id, date: today,
        checkin_time: now.toISOString(),
        checkin_by: currentUser?.id,
        checkin_by_name: profile?.full_name || 'Gate',
        checkin_method: method, school_id: SCHOOL_ID
      })
      const { data: attExisting } = await supabase.from('attendance')
        .select('id').eq('student_id', student.id).eq('date', today).single()
      if (!attExisting) {
        await supabase.from('attendance').insert({
          student_id: student.id, date: today,
          status: 'present', checked_in_at: now.toISOString()
        })
      }
      setResult({ type: 'success', action: 'checkin', message: `✅ ${student.full_name} checked in at ${now.toLocaleTimeString()}`, name: student.full_name })
    } else if (!existing.checkout_time) {
      await supabase.from('student_checkins').update({
        checkout_time: now.toISOString(),
        checkout_by: currentUser?.id,
        checkout_by_name: profile?.full_name || 'Gate',
        checkout_method: method
      }).eq('id', existing.id)
      setResult({ type: 'success', action: 'checkout', message: `👋 ${student.full_name} checked out at ${now.toLocaleTimeString()}`, name: student.full_name })
    } else {
      setResult({ type: 'info', message: `${student.full_name} already checked in and out today.` })
    }
    setStudentSearch('')
    setSearchResults([])
    setProcessing(false)
  }

  const searchStudents = (query) => {
    setStudentSearch(query)
    if (query.length < 2) { setSearchResults([]); return }
    setSearchResults(students.filter(s => s.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 5))
  }

  const statusColor = { present: '#10b981', late: '#f59e0b', half_day: '#38bdf8', absent: '#ef4444' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', marginBottom: '8px' }}>Intelli<span style={{ color: '#38bdf8' }}>Gen</span></div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Time Kids Preschool Anna Nagar</div>
          <div style={{ color: '#38bdf8', fontSize: '13px', marginTop: '4px' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Processing...</div>
        ) : (
          <>
            {result && (
              <div style={{ background: result.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.1)', border: `1px solid ${result.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.2)'}`, borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>{result.action === 'checkin' ? '✅' : result.action === 'checkout' ? '👋' : 'ℹ️'}</div>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '6px' }}>{result.name}</div>
                <div style={{ color: result.type === 'success' ? '#34d399' : '#38bdf8', fontSize: '15px', marginBottom: '8px' }}>{result.message}</div>
                {result.status && <div style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', display: 'inline-block', background: `${statusColor[result.status]}22`, color: statusColor[result.status] || '#fff' }}>{result.status}</div>}
                {result.workingHours && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '6px' }}>Working hours today: {result.workingHours}h</div>}
                <button onClick={() => setResult(null)} style={{ marginTop: '16px', padding: '8px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
              </div>
            )}

            {!result && (
              <>
                {user && profile && ['teacher', 'staff', 'school_admin'].includes(profile.role) && (
                  <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '16px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>👩‍🏫</div>
                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{profile.full_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px' }}>{profile.role}</div>
                    <button onClick={() => processStaffCheckin(user, profile)} disabled={processing}
                      style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>
                      {processing ? '⏳ Processing...' : '🚪 Check In / Check Out'}
                    </button>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px' }}>
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '16px' }}>👶 Student Check-in / Check-out</div>
                  <div style={{ position: 'relative' }}>
                    <input value={studentSearch} onChange={e => searchStudents(e.target.value)}
                      placeholder='Search student by name...'
                      style={{ width: '100%', padding: '12px 16px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '10px', fontSize: '14px', outline: 'none' }} />
                    {searchResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', marginTop: '4px', zIndex: 10, overflow: 'hidden' }}>
                        {searchResults.map(s => (
                          <button key={s.id} onClick={() => processStudentCheckin(s, 'manual', user)} disabled={processing}
                            style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{s.full_name}</span>
                            <span style={{ color: '#a78bfa', fontSize: '12px' }}>{s.program}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>Type student name to search and check in/out manually</div>
                </div>

                {!user && (
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '12px' }}>Staff: Please login to check in</div>
                    <a href='/' style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: '10px', color: '#fff', fontWeight: '600', fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>Login →</a>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CheckinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>
        Loading...
      </div>
    }>
      <CheckinContent />
    </Suspense>
  )
}
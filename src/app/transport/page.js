'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false })

const EVENT_TYPES = [
  { id: 'morning_pickup', label: 'Morning Pickup', desc: 'Student boarded van from home', icon: '🌅', color: '#38bdf8' },
  { id: 'school_drop', label: 'Dropped at School', desc: 'Student arrived at school', icon: '🏫', color: '#34d399' },
  { id: 'school_pickup', label: 'Left School', desc: 'Student boarded van to go home', icon: '🎒', color: '#fbbf24' },
  { id: 'home_drop', label: 'Dropped at Home', desc: 'Student reached home safely', icon: '🏠', color: '#a78bfa' },
]

export default function TransportMarkingPage() {
  const [profile, setProfile] = useState(null)
  const [routes, setRoutes] = useState([])
  const [students, setStudents] = useState([])
  const [studentTransport, setStudentTransport] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('morning_pickup')
  const [search, setSearch] = useState('')
  const [marking, setMarking] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [lastMarked, setLastMarked] = useState(null)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!['school_admin', 'center_head', 'staff', 'teacher'].includes(prof?.role)) {
      router.push('/'); return
    }
    setProfile(prof)

    const today = new Date().toISOString().split('T')[0]
    const [routesRes, studentsRes, stRes, logsRes] = await Promise.all([
      supabase.from('transport_routes').select('*').eq('school_id', prof.school_id).eq('is_active', true).order('name'),
      supabase.from('students').select('*').eq('school_id', prof.school_id).eq('status', 'active').order('full_name'),
      supabase.from('student_transport').select('*').eq('school_id', prof.school_id).eq('is_active', true),
      supabase.from('transport_logs').select('*, students(full_name)').eq('school_id', prof.school_id)
        .gte('event_time', `${today}T00:00:00`).lte('event_time', `${today}T23:59:59`).order('event_time', { ascending: false })
    ])
    setRoutes(routesRes.data || [])
    setStudents(studentsRes.data || [])
    setStudentTransport(stRes.data || [])
    setTodayLogs(logsRes.data || [])
    if (routesRes.data?.length > 0) setSelectedRoute(routesRes.data[0].id)
    setLoading(false)
  }

  const getRouteStudents = () => {
    if (!selectedRoute) return []
    const assignedIds = studentTransport.filter(st => st.route_id === selectedRoute).map(st => st.student_id)
    return students.filter(s => assignedIds.includes(s.id))
      .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()))
  }

  const isMarked = (studentId, eventType) => {
    return todayLogs.some(l => l.student_id === studentId && l.event_type === eventType)
  }

  const markEvent = async (student, method = 'manual') => {
    if (!selectedRoute || !selectedEvent) { alert('Please select route and event type'); return }
    if (isMarked(student.id, selectedEvent)) {
      alert(`${student.full_name} already marked for ${selectedEvent} today!`); return
    }
    setMarking(student.id)
    const { data: { user } } = await supabase.auth.getUser()

    // Insert transport log
    await supabase.from('transport_logs').insert({
      school_id: profile.school_id,
      student_id: student.id,
      route_id: selectedRoute,
      event_type: selectedEvent,
      event_time: new Date().toISOString(),
      marked_by: user.id,
      method,
      parent_notified: false
    })

    const eventInfo = EVENT_TYPES.find(e => e.id === selectedEvent)
    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', student.id)
    if (ps && ps.length > 0) {
      // Mark parent notified
      await supabase.from('transport_logs').update({ parent_notified: true })
        .eq('student_id', student.id).eq('event_type', selectedEvent)
        .gte('event_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)

      // Send push notification only
      try {
        const parentIds = ps.map(p => p.parent_id)
        const eventMessages = {
          morning_pickup: `${student.full_name} has boarded the school van 🚌`,
          school_drop: `${student.full_name} has arrived at school safely 🏫`,
          school_pickup: `${student.full_name} has boarded the van to come home 🎒`,
          home_drop: `${student.full_name} has been dropped safely at home 🏠`
        }
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: parentIds,
            title: `🚌 Transport Update`,
            body: eventMessages[selectedEvent],
            url: '/parent'
          })
        })
      } catch (e) { console.log('Push error:', e) }
    }

    setLastMarked({ student, event: eventInfo, time: new Date().toLocaleTimeString() })
    setMarking(null)

    // Refresh logs
    const today = new Date().toISOString().split('T')[0]
    const { data: logsRes } = await supabase.from('transport_logs').select('*, students(full_name)')
      .eq('school_id', profile.school_id)
      .gte('event_time', `${today}T00:00:00`).lte('event_time', `${today}T23:59:59`)
      .order('event_time', { ascending: false })
    setTodayLogs(logsRes || [])
  }



  const handleQRScan = async (decodedText) => {
    setShowScanner(false)
    // Extract student ID from QR URL
    // QR format: APP_URL/checkin?student=STUDENT_ID
    const url = new URL(decodedText)
    const studentId = url.searchParams.get('student')
    if (!studentId) { alert('Invalid QR code'); return }
    const student = students.find(s => s.id === studentId)
    if (!student) { alert('Student not found'); return }
    // Check if student is on selected route
    const onRoute = studentTransport.find(st => st.student_id === studentId && st.route_id === selectedRoute)
    if (!onRoute) { alert(`${student.full_name} is not assigned to the selected route!`); return }
    await markEvent(student, 'qr_scan')
  }

  const routeStudents = getRouteStudents()
  const selectedRouteData = routes.find(r => r.id === selectedRoute)
  const selectedEventData = EVENT_TYPES.find(e => e.id === selectedEvent)

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; }
        .logo span { color: #38bdf8; }
        .content { padding: 24px; max-width: 800px; margin: 0 auto; }
        .event-btn { padding: 14px 16px; border-radius: 12px; border: 2px solid; cursor: pointer; font-family: 'DM Sans', sans-serif; text-align: left; transition: all 0.2s; width: 100%; }
        .student-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
        .mark-btn { padding: 8px 16px; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; }
        @media (max-width: 600px) { .content { padding: 16px; } }
      `}</style>

      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>🚌 Transport</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      <div className="content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <>
            {/* Last marked notification */}
            {lastMarked && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#34d399' }}>✅ {lastMarked.student.full_name} marked!</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{lastMarked.event.icon} {lastMarked.event.label} · {lastMarked.time} · Parent notified</div>
                </div>
                <button onClick={() => setLastMarked(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px' }}>×</button>
              </div>
            )}

            {/* Step 1: Select Route */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: '#38bdf8' }}>Step 1: Select Route 🚌</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {routes.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No routes configured. Ask admin to set up routes.</div>
                ) : routes.map(r => (
                  <button key={r.id} onClick={() => setSelectedRoute(r.id)}
                    style={{ padding: '10px 18px', borderRadius: '10px', border: `2px solid ${selectedRoute === r.id ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: selectedRoute === r.id ? 'rgba(56,189,248,0.15)' : 'transparent', color: selectedRoute === r.id ? '#38bdf8' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '14px' }}>
                    🚌 {r.name}
                  </button>
                ))}
              </div>
              {selectedRouteData && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {selectedRouteData.vehicle_number && <span style={{ color: '#fbbf24', fontSize: '13px' }}>🚌 {selectedRouteData.vehicle_number}</span>}
                  {selectedRouteData.driver_name && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>👨‍✈️ {selectedRouteData.driver_name} · 📞 {selectedRouteData.driver_phone}</span>}
                  {selectedRouteData.caretaker_name && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>👩 {selectedRouteData.caretaker_name}</span>}
                </div>
              )}
            </div>

            {/* Step 2: Select Event */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: '#a78bfa' }}>Step 2: Select Event 📍</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {EVENT_TYPES.map(evt => (
                  <button key={evt.id} onClick={() => setSelectedEvent(evt.id)}
                    className="event-btn"
                    style={{ borderColor: selectedEvent === evt.id ? evt.color : 'rgba(255,255,255,0.08)', background: selectedEvent === evt.id ? `${evt.color}18` : 'transparent', color: selectedEvent === evt.id ? evt.color : 'rgba(255,255,255,0.5)' }}>
                    <div style={{ fontSize: '22px', marginBottom: '6px' }}>{evt.icon}</div>
                    <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '2px' }}>{evt.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>{evt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Mark Students */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#10b981' }}>Step 3: Mark Students ✅</div>
                <button onClick={() => setShowScanner(true)}
                  style={{ padding: '9px 16px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  📷 Scan QR
                </button>
              </div>

              {/* Search */}
              <input placeholder='Search student name...' value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', marginBottom: '14px', outline: 'none' }} />

              {routeStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  {selectedRoute ? 'No students on this route.' : 'Select a route to see students.'}
                </div>
              ) : routeStudents.map(student => {
                const marked = isMarked(student.id, selectedEvent)
                const isMarkingThis = marking === student.id
                return (
                  <div key={student.id} className="student-row" style={{ borderColor: marked ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)', background: marked ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: marked ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#fff', fontSize: '15px', flexShrink: 0 }}>
                        {student.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{student.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '12px' }}>{student.program}</div>
                      </div>
                    </div>
                    <button onClick={() => markEvent(student, 'manual')} disabled={marked || isMarkingThis}
                      className="mark-btn"
                      style={{ background: marked ? 'rgba(16,185,129,0.15)' : `${selectedEventData?.color}22`, color: marked ? '#34d399' : selectedEventData?.color, border: `1px solid ${marked ? 'rgba(16,185,129,0.3)' : selectedEventData?.color + '44'}`, opacity: isMarkingThis ? 0.6 : 1 }}>
                      {isMarkingThis ? '⏳...' : marked ? '✅ Done' : `${selectedEventData?.icon} Mark`}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Today's log summary */}
            {todayLogs.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px', color: 'rgba(255,255,255,0.6)' }}>📋 Today's Log ({todayLogs.length} events)</div>
                {todayLogs.slice(0, 10).map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{EVENT_TYPES.find(e => e.id === log.event_type)?.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{log.students?.full_name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(log.event_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', background: log.method === 'qr_scan' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)', color: log.method === 'qr_scan' ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                        {log.method === 'qr_scan' ? '📷 QR' : '✋ Manual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showScanner && <QRScanner title='Scan Student QR Code' onScan={handleQRScan} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
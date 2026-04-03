'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

export default function AdminTransportPage() {
  const [routes, setRoutes] = useState([])
  const [students, setStudents] = useState([])
  const [studentTransport, setStudentTransport] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('routes') // routes | assign | logs
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterRoute, setFilterRoute] = useState('all')
  const [assigningRoute, setAssigningRoute] = useState(null)
  const [selectedMarkRoute, setSelectedMarkRoute] = useState('')
  const [selectedMarkEvent, setSelectedMarkEvent] = useState('morning_pickup')
  const [markSearch, setMarkSearch] = useState('')
  const [markingStudent, setMarkingStudent] = useState(null)
  const [lastMarkedStudent, setLastMarkedStudent] = useState(null)
  const [todayLogs, setTodayLogs] = useState([])

  const [form, setForm] = useState({
    name: '', vehicle_number: '', driver_name: '', driver_phone: '',
    caretaker_name: '', caretaker_phone: '', morning_pickup_time: '08:00',
    afternoon_drop_time: '13:30', is_active: true
  })

  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])
  useEffect(() => { if (schoolId) fetchLogs() }, [filterDate, filterRoute, schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [routesRes, studentsRes, stRes] = await Promise.all([
      supabase.from('transport_routes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name'),
      supabase.from('student_transport').select('*, transport_routes(name)').eq('school_id', schoolId)
    ])
    setRoutes(routesRes.data || [])
    setStudents(studentsRes.data || [])
    setStudentTransport(stRes.data || [])

    // Load today's logs for marking tab
    const today = new Date().toISOString().split('T')[0]
    const { data: tlData } = await supabase.from('transport_logs')
      .select('*, students(full_name)').eq('school_id', schoolId)
      .gte('event_time', `${today}T00:00:00`)
      .lte('event_time', `${today}T23:59:59`)
      .order('event_time', { ascending: false })
    setTodayLogs(tlData || [])
    if (routesRes.data?.length > 0 && !selectedMarkRoute) {
      setSelectedMarkRoute(routesRes.data[0].id)
    }

    setLoading(false)
  }

  const fetchLogs = async () => {
    let query = supabase.from('transport_logs')
      .select('*, students(full_name, program), transport_routes(name), profiles(full_name)')
      .eq('school_id', schoolId)
      .gte('event_time', `${filterDate}T00:00:00`)
      .lte('event_time', `${filterDate}T23:59:59`)
      .order('event_time', { ascending: false })
    if (filterRoute !== 'all') query = query.eq('route_id', filterRoute)
    const { data } = await query
    setLogs(data || [])
  }

  const saveRoute = async () => {
    if (!form.name.trim()) { alert('Please enter route name'); return }
    setSaving(true)
    if (editingRoute) {
      await supabase.from('transport_routes').update(form).eq('id', editingRoute.id)
    } else {
      await supabase.from('transport_routes').insert({ ...form, school_id: schoolId })
    }
    setShowRouteForm(false)
    setEditingRoute(null)
    resetForm()
    await fetchAll()
    setSaving(false)
  }

  const deleteRoute = async (id) => {
    if (!confirm('Delete this route? Students assigned to it will be unassigned.')) return
    await supabase.from('student_transport').delete().eq('route_id', id)
    await supabase.from('transport_routes').delete().eq('id', id)
    await fetchAll()
  }

  const assignStudentToRoute = async (studentId, routeId) => {
    const existing = studentTransport.find(st => st.student_id === studentId)
    if (existing) {
      if (!routeId) {
        await supabase.from('student_transport').delete().eq('id', existing.id)
      } else {
        await supabase.from('student_transport').update({ route_id: routeId }).eq('id', existing.id)
      }
    } else if (routeId) {
      await supabase.from('student_transport').insert({
        school_id: schoolId, student_id: studentId, route_id: routeId, is_active: true
      })
    }
    await fetchAll()
  }

  const resetForm = () => setForm({
    name: '', vehicle_number: '', driver_name: '', driver_phone: '',
    caretaker_name: '', caretaker_phone: '', morning_pickup_time: '08:00',
    afternoon_drop_time: '13:30', is_active: true
  })

  const getMarkRouteStudents = () => {
    if (!selectedMarkRoute) return []
    const assignedIds = studentTransport.filter(st => st.route_id === selectedMarkRoute).map(st => st.student_id)
    return students.filter(s => assignedIds.includes(s.id))
      .filter(s => !markSearch || s.full_name.toLowerCase().includes(markSearch.toLowerCase()))
  }

  const isMarkedToday = (studentId, eventType) => {
    return todayLogs.some(l => l.student_id === studentId && l.event_type === eventType)
  }

  const refreshTodayLogs = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('transport_logs')
      .select('*, students(full_name)').eq('school_id', schoolId)
      .gte('event_time', `${today}T00:00:00`)
      .lte('event_time', `${today}T23:59:59`)
      .order('event_time', { ascending: false })
    setTodayLogs(data || [])
  }

  const markStudentEvent = async (student) => {
    if (!selectedMarkRoute || !selectedMarkEvent) return
    if (isMarkedToday(student.id, selectedMarkEvent)) {
      alert(`${student.full_name} already marked!`); return
    }
    setMarkingStudent(student.id)
    const { data: { user } } = await supabase.auth.getUser()
    const route = routes.find(r => r.id === selectedMarkRoute)
    const eventInfo = TRANSPORT_EVENTS.find(e => e.id === selectedMarkEvent)
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

    await supabase.from('transport_logs').insert({
      school_id: schoolId, student_id: student.id,
      route_id: selectedMarkRoute, event_type: selectedMarkEvent,
      event_time: new Date().toISOString(),
      marked_by: user.id, method: 'manual', parent_notified: false
    })

    // Notify parent
    const msgMap = {
      morning_pickup: `🌅 ${student.full_name} has boarded the school van.\n🚌 Vehicle: ${route?.vehicle_number || '—'}\n👨‍✈️ Driver: ${route?.driver_name || '—'} (${route?.driver_phone || '—'})\n👩 Caretaker: ${route?.caretaker_name || '—'}\n⏰ Time: ${time}`,
      school_drop: `🏫 ${student.full_name} has arrived safely at school.\n⏰ Time: ${time}`,
      school_pickup: `🎒 ${student.full_name} has boarded the van to come home.\n🚌 Vehicle: ${route?.vehicle_number || '—'}\n👨‍✈️ Driver: ${route?.driver_name || '—'} (${route?.driver_phone || '—'})\n⏰ Time: ${time}`,
      home_drop: `🏠 ${student.full_name} has been dropped safely at home.\n⏰ Time: ${time}\n✅ Please confirm receipt in the app.`
    }

    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', student.id)
    if (ps && ps.length > 0) {
      for (const { parent_id } of ps) {
        await supabase.from('chat_messages').insert({
          sender_id: schoolId, receiver_id: parent_id,
          sender_name: route?.name || 'School',
          content: msgMap[selectedMarkEvent]
        })
      }
    }

    setLastMarkedStudent({ student, event: eventInfo, time })
    setMarkingStudent(null)
    await refreshTodayLogs()
  }

  const exportLogs = () => {
    const headers = ['Time', 'Student', 'Program', 'Route', 'Event', 'Method', 'Marked By']
    const rows = logs.map(l => [
      new Date(l.event_time).toLocaleString(),
      l.students?.full_name, l.students?.program,
      l.transport_routes?.name, l.event_type,
      l.method, l.profiles?.full_name
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `transport-${filterDate}.csv`; a.click()
  }

  const TRANSPORT_EVENTS = [
    { id: 'morning_pickup', label: 'Morning Pickup', icon: '🌅', color: '#38bdf8', desc: 'Boarded van from home' },
    { id: 'school_drop', label: 'Dropped at School', icon: '🏫', color: '#34d399', desc: 'Arrived at school' },
    { id: 'school_pickup', label: 'Left School', icon: '🎒', color: '#fbbf24', desc: 'Boarded van to go home' },
    { id: 'home_drop', label: 'Dropped at Home', icon: '🏠', color: '#a78bfa', desc: 'Reached home safely' },
  ]

  const eventLabel = {
    morning_pickup: '🌅 Morning Pickup',
    school_drop: '🏫 Dropped at School',
    school_pickup: '🎒 Left School',
    home_drop: '🏠 Dropped at Home'
  }

  const eventColor = {
    morning_pickup: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
    school_drop: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    school_pickup: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    home_drop: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' }
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 11px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
        tr:last-child td { border-bottom: none; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🚌 Transport Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage routes, assign students and view logs</p>
          </div>
          {view === 'routes' && (
            <button onClick={() => { resetForm(); setEditingRoute(null); setShowRouteForm(true) }} className="btn-primary">+ Add Route</button>
          )}
          {view === 'logs' && (
            <button onClick={exportLogs} className="btn-secondary">📥 Export</button>
          )}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['routes', '🚌 Routes'], ['assign', '👶 Assign Students'], ['mark', '✅ Mark Events'], ['logs', '📋 Daily Logs']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* ROUTES VIEW */}
            {view === 'routes' && (
              <>
                {routes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
                    <div>No routes yet. Click "+ Add Route" to create one.</div>
                  </div>
                ) : routes.map(route => {
                  const assigned = studentTransport.filter(st => st.route_id === route.id)
                  return (
                    <div key={route.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', fontSize: '17px' }}>{route.name}</span>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: route.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: route.is_active ? '#34d399' : '#f87171', fontWeight: '600' }}>
                              {route.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: '600' }}>
                              👶 {assigned.length} students
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            {route.vehicle_number && (
                              <div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '2px' }}>VEHICLE</div>
                                <div style={{ fontWeight: '600', color: '#fbbf24' }}>🚌 {route.vehicle_number}</div>
                              </div>
                            )}
                            {route.driver_name && (
                              <div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '2px' }}>DRIVER</div>
                                <div style={{ fontWeight: '600' }}>👨‍✈️ {route.driver_name}</div>
                                {route.driver_phone && <div style={{ color: '#38bdf8', fontSize: '12px' }}>📞 {route.driver_phone}</div>}
                              </div>
                            )}
                            {route.caretaker_name && (
                              <div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '2px' }}>CARETAKER</div>
                                <div style={{ fontWeight: '600' }}>👩 {route.caretaker_name}</div>
                                {route.caretaker_phone && <div style={{ color: '#38bdf8', fontSize: '12px' }}>📞 {route.caretaker_phone}</div>}
                              </div>
                            )}
                            {route.morning_pickup_time && (
                              <div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '2px' }}>MORNING PICKUP</div>
                                <div style={{ fontWeight: '600', color: '#38bdf8' }}>🌅 {route.morning_pickup_time}</div>
                              </div>
                            )}
                            {route.afternoon_drop_time && (
                              <div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: '2px' }}>AFTERNOON DROP</div>
                                <div style={{ fontWeight: '600', color: '#a78bfa' }}>🏠 {route.afternoon_drop_time}</div>
                              </div>
                            )}
                          </div>
                          {/* Assigned students */}
                          {assigned.length > 0 && (
                            <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {assigned.map(st => {
                                const student = students.find(s => s.id === st.student_id)
                                return student ? (
                                  <span key={st.id} style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                                    {student.full_name}
                                  </span>
                                ) : null
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => { setEditingRoute(route); setForm({ name: route.name, vehicle_number: route.vehicle_number || '', driver_name: route.driver_name || '', driver_phone: route.driver_phone || '', caretaker_name: route.caretaker_name || '', caretaker_phone: route.caretaker_phone || '', morning_pickup_time: route.morning_pickup_time || '08:00', afternoon_drop_time: route.afternoon_drop_time || '13:30', is_active: route.is_active }); setShowRouteForm(true) }}
                            style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>✏️ Edit</button>
                          <button onClick={() => deleteRoute(route.id)}
                            style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* ASSIGN STUDENTS */}
            {view === 'assign' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Assign each student to a transport route. Students without a route won't be tracked.
                </div>
                {routes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No routes yet. Create routes first!</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Program</th>
                          <th>Assigned Route</th>
                          <th>Change Route</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => {
                          const assignment = studentTransport.find(st => st.student_id === s.id)
                          return (
                            <tr key={s.id}>
                              <td style={{ fontWeight: '600' }}>{s.full_name}</td>
                              <td><span style={{ color: '#a78bfa', fontSize: '12px' }}>{s.program || '—'}</span></td>
                              <td>
                                {assignment ? (
                                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: '600' }}>
                                    🚌 {assignment.transport_routes?.name}
                                  </span>
                                ) : (
                                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Not assigned</span>
                                )}
                              </td>
                              <td>
                                <select value={assignment?.route_id || ''} onChange={e => assignStudentToRoute(s.id, e.target.value || null)}
                                  style={{ padding: '6px 10px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                  <option value=''>-- No Transport --</option>
                                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* MARK EVENTS VIEW */}
            {view === 'mark' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>✅ Mark Transport Events</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Mark student boarding and dropping for today</div>
                </div>

                {/* Last marked */}
                {lastMarkedStudent && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: '#34d399' }}>✅ {lastMarkedStudent.student.full_name} marked!</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{lastMarkedStudent.event.icon} {lastMarkedStudent.event.label} · {lastMarkedStudent.time} · Parent notified</div>
                    </div>
                    <button onClick={() => setLastMarkedStudent(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  </div>
                )}

                {/* Step 1: Route */}
                <div className="card" style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#38bdf8' }}>Step 1: Select Route 🚌</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {routes.length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No routes yet. Create routes first.</div>
                    ) : routes.map(r => (
                      <button key={r.id} onClick={() => setSelectedMarkRoute(r.id)}
                        style={{ padding: '9px 16px', borderRadius: '10px', border: `2px solid ${selectedMarkRoute === r.id ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: selectedMarkRoute === r.id ? 'rgba(56,189,248,0.15)' : 'transparent', color: selectedMarkRoute === r.id ? '#38bdf8' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '13px' }}>
                        🚌 {r.name}
                      </button>
                    ))}
                  </div>
                  {selectedMarkRoute && (() => {
                    const route = routes.find(r => r.id === selectedMarkRoute)
                    return route ? (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px' }}>
                        {route.vehicle_number && <span style={{ color: '#fbbf24' }}>🚌 {route.vehicle_number}</span>}
                        {route.driver_name && <span style={{ color: 'rgba(255,255,255,0.5)' }}>👨‍✈️ {route.driver_name} · 📞 {route.driver_phone}</span>}
                        {route.caretaker_name && <span style={{ color: 'rgba(255,255,255,0.5)' }}>👩 {route.caretaker_name}</span>}
                      </div>
                    ) : null
                  })()}
                </div>

                {/* Step 2: Event */}
                <div className="card" style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#a78bfa' }}>Step 2: Select Event 📍</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {TRANSPORT_EVENTS.map(evt => (
                      <button key={evt.id} onClick={() => setSelectedMarkEvent(evt.id)}
                        style={{ padding: '12px', borderRadius: '10px', border: `2px solid ${selectedMarkEvent === evt.id ? evt.color : 'rgba(255,255,255,0.08)'}`, background: selectedMarkEvent === evt.id ? `${evt.color}18` : 'transparent', color: selectedMarkEvent === evt.id ? evt.color : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{evt.icon}</div>
                        <div style={{ fontWeight: '700', fontSize: '12px' }}>{evt.label}</div>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>{evt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3: Students */}
                <div className="card" style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#10b981' }}>Step 3: Mark Students ✅</div>
                  <input placeholder='Search student...' value={markSearch} onChange={e => setMarkSearch(e.target.value)}
                    style={{ width: '100%', padding: '9px 14px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px', marginBottom: '12px', outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                  {getMarkRouteStudents().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                      {selectedMarkRoute ? 'No students on this route.' : 'Select a route first.'}
                    </div>
                  ) : getMarkRouteStudents().map(student => {
                    const marked = isMarkedToday(student.id, selectedMarkEvent)
                    const isMarkingThis = markingStudent === student.id
                    const eventData = TRANSPORT_EVENTS.find(e => e.id === selectedMarkEvent)
                    return (
                      <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: marked ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${marked ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '10px', marginBottom: '8px', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: marked ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                            {student.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{student.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '12px' }}>{student.program}</div>
                          </div>
                        </div>
                        <button onClick={() => markStudentEvent(student)} disabled={marked || isMarkingThis}
                          style={{ padding: '8px 16px', background: marked ? 'rgba(16,185,129,0.15)' : `${eventData?.color}22`, color: marked ? '#34d399' : eventData?.color, border: `1px solid ${marked ? 'rgba(16,185,129,0.3)' : eventData?.color + '44'}`, borderRadius: '8px', cursor: marked ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          {isMarkingThis ? '⏳...' : marked ? '✅ Done' : `${eventData?.icon} Mark`}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Today's log */}
                {todayLogs.length > 0 && (
                  <div className="card">
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px', color: 'rgba(255,255,255,0.6)' }}>📋 Today's Log ({todayLogs.length})</div>
                    {todayLogs.slice(0, 10).map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>{TRANSPORT_EVENTS.find(e => e.id === log.event_type)?.icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>{log.students?.full_name}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(log.event_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* LOGS VIEW */}
            {view === 'logs' && (
              <>
                {/* Filters */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type='date' value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                  <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                    <option value='all'>All Routes</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{logs.length} events</span>
                </div>

                {/* Summary counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {Object.entries(eventLabel).map(([type, label]) => (
                    <div key={type} className="card" style={{ padding: '14px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: eventColor[type]?.color }}>
                        {logs.filter(l => l.event_type === type).length}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No transport events for {filterDate}</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Student</th>
                          <th>Route</th>
                          <th>Event</th>
                          <th>Method</th>
                          <th>Marked By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map(log => (
                          <tr key={log.id}>
                            <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                              {new Date(log.event_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{log.students?.full_name}</div>
                              <div style={{ color: '#a78bfa', fontSize: '11px' }}>{log.students?.program}</div>
                            </td>
                            <td style={{ color: '#fbbf24', fontSize: '12px' }}>{log.transport_routes?.name}</td>
                            <td>
                              <span className="badge" style={{ background: eventColor[log.event_type]?.bg, color: eventColor[log.event_type]?.color }}>
                                {eventLabel[log.event_type]}
                              </span>
                            </td>
                            <td>
                              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: log.method === 'qr_scan' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.06)', color: log.method === 'qr_scan' ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                                {log.method === 'qr_scan' ? '📷 QR Scan' : '✋ Manual'}
                              </span>
                            </td>
                            <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{log.profiles?.full_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Route Form Modal */}
      {showRouteForm && (
        <div className="modal-overlay" onClick={() => setShowRouteForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingRoute ? '✏️ Edit Route' : '🚌 Add Transport Route'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Route Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. Anna Nagar Van, Route A' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Vehicle Number</label>
            <input value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} placeholder='e.g. TN01AB1234' style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Driver Name</label>
                <input value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} placeholder='Driver name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Driver Phone</label>
                <input value={form.driver_phone} onChange={e => setForm({ ...form, driver_phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Caretaker Name</label>
                <input value={form.caretaker_name} onChange={e => setForm({ ...form, caretaker_name: e.target.value })} placeholder='Caretaker name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Caretaker Phone</label>
                <input value={form.caretaker_phone} onChange={e => setForm({ ...form, caretaker_phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🌅 Morning Pickup Time</label>
                <input type='time' value={form.morning_pickup_time} onChange={e => setForm({ ...form, morning_pickup_time: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🏠 Afternoon Drop Time</label>
                <input type='time' value={form.afternoon_drop_time} onChange={e => setForm({ ...form, afternoon_drop_time: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', marginBottom: '20px' }}>
              <input type='checkbox' checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Route is Active
            </label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRouteForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveRoute} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingRoute ? 'Update' : 'Add Route'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
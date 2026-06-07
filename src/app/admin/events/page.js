'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'

const EVENT_TYPES = [
  { id: 'celebration', label: 'Celebration', icon: '🎉' },
  { id: 'sports', label: 'Sports', icon: '🏃' },
  { id: 'cultural', label: 'Cultural', icon: '🎨' },
  { id: 'trip', label: 'Field Trip', icon: '🚌' },
  { id: 'meeting', label: 'Meeting', icon: '🤝' },
  { id: 'photoday', label: 'Photo Day', icon: '📸' },
  { id: 'graduation', label: 'Graduation', icon: '🎓' },
  { id: 'other', label: 'Other', icon: '📋' },
]

const EVENT_TYPE_MAP = Object.fromEntries(EVENT_TYPES.map(e => [e.id, e]))

export default function AdminEventsPage() {
  const { schoolId } = useSchool()
  const [events, setEvents] = useState([])
  const [holidays, setHolidays] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('calendar') // calendar | list
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [holidayWarning, setHolidayWarning] = useState('')

  const emptyForm = {
    title: '', description: '', event_date: '',
    start_time: '', end_time: '', venue: '',
    programs: ['all'], event_type: 'celebration',
    attachment_url: '', attachment_name: ''
  }
  const [form, setForm] = useState(emptyForm)

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    padding: '11px 14px', color: '#fff', fontSize: '14px',
    outline: 'none', marginBottom: '14px', fontFamily: "'DM Sans', sans-serif"
  }

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const [evRes, holRes, progRes] = await Promise.all([
      supabase.from('school_events').select('*').eq('school_id', schoolId).order('event_date'),
      supabase.from('holidays').select('*').eq('school_id', schoolId).eq('academic_year', currentAY),
      supabase.from('curriculum_masters').select('value').eq('type', 'program').eq('school_id', schoolId).order('value')
    ])
    setEvents(evRes.data || [])
    setHolidays(holRes.data || [])
    setPrograms(progRes.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const isHolidayDate = (dateStr) => {
    return holidays.some(h => {
      const from = new Date(h.from_date)
      const to = new Date(h.to_date)
      const check = new Date(dateStr)
      return check >= from && check <= to
    })
  }

  const getHolidayName = (dateStr) => {
    const h = holidays.find(h => {
      const from = new Date(h.from_date)
      const to = new Date(h.to_date)
      const check = new Date(dateStr)
      return check >= from && check <= to
    })
    return h?.name || ''
  }

  const getEventsForDate = (dateStr) => events.filter(e => e.event_date === dateStr)

  const openCreateForm = (dateStr = '') => {
    setEditingEvent(null)
    setForm({ ...emptyForm, event_date: dateStr })
    if (dateStr && isHolidayDate(dateStr)) {
      setHolidayWarning(`⚠️ ${getHolidayName(dateStr)} is a holiday on this date. You can still add an event.`)
    } else {
      setHolidayWarning('')
    }
    setShowForm(true)
  }

  const openEditForm = (event) => {
    setEditingEvent(event)
    setForm({
      title: event.title || '',
      description: event.description || '',
      event_date: event.event_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      venue: event.venue || '',
      programs: event.programs || ['all'],
      event_type: event.event_type || 'other',
      attachment_url: event.attachment_url || '',
      attachment_name: event.attachment_name || ''
    })
    setHolidayWarning(isHolidayDate(event.event_date) ? `⚠️ ${getHolidayName(event.event_date)} is a holiday on this date.` : '')
    setShowForm(true)
  }

  const handleDateChange = (dateStr) => {
    setForm(f => ({ ...f, event_date: dateStr }))
    if (dateStr && isHolidayDate(dateStr)) {
      setHolidayWarning(`⚠️ ${getHolidayName(dateStr)} is a holiday on this date. You can still add an event.`)
    } else {
      setHolidayWarning('')
    }
  }

  const toggleProgram = (prog) => {
    if (prog === 'all') {
      setForm(f => ({ ...f, programs: ['all'] }))
      return
    }
    setForm(f => {
      const current = f.programs.filter(p => p !== 'all')
      if (current.includes(prog)) {
        const updated = current.filter(p => p !== prog)
        return { ...f, programs: updated.length === 0 ? ['all'] : updated }
      } else {
        return { ...f, programs: [...current, prog] }
      }
    })
  }

  const uploadAttachment = async (file) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `events/${schoolId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('school-events').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('school-events').getPublicUrl(path)
      setForm(f => ({ ...f, attachment_url: publicUrl, attachment_name: file.name }))
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(false)
  }

  const saveEvent = async () => {
    if (!form.title || !form.event_date) { alert('Please enter title and date'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      school_id: schoolId,
      title: form.title,
      description: form.description,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      venue: form.venue,
      programs: form.programs,
      event_type: form.event_type,
      attachment_url: form.attachment_url,
      attachment_name: form.attachment_name,
      updated_at: new Date().toISOString()
    }
    if (editingEvent) {
      await supabase.from('school_events').update(payload).eq('id', editingEvent.id)
    } else {
      payload.created_by = user.id
      await supabase.from('school_events').insert(payload)
    }
    // Send push notification to staff
    try {
      const { data: staffData } = await supabase.from('profiles')
        .select('id').eq('school_id', schoolId).in('role', ['teacher', 'staff', 'center_head'])
      if (staffData && staffData.length > 0) {
        const et = EVENT_TYPE_MAP[form.event_type]
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: staffData.map(s => s.id),
            title: `${et?.icon || '📅'} ${editingEvent ? 'Event Updated' : 'New Event Added'}`,
            body: `${form.title} on ${form.event_date}`,
            url: '/teacher'
          })
        })
      }
    } catch (e) { console.log('Push error:', e) }
    setShowForm(false)
    setEditingEvent(null)
    setForm(emptyForm)
    setSaving(false)
    await fetchAll()
  }

  const deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('event_reminder_logs').delete().eq('event_id', id)
    await supabase.from('school_events').delete().eq('id', id)
    setSelectedEvent(null)
    await fetchAll()
  }

  // Calendar helpers
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay()
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  const upcomingEvents = events
    .filter(e => new Date(e.event_date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📅 Event Calendar</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage school events and celebrations</p>
          </div>
          <button className="btn-primary" onClick={() => openCreateForm()}>+ Add Event</button>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['calendar', '📅 Calendar'], ['list', '📋 List']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s', background: view === v ? 'rgba(56,189,248,0.15)' : 'transparent', color: view === v ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
              {l}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* CALENDAR VIEW */}
            {view === 'calendar' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '24px' }}>
                {/* Month Nav */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>← Prev</button>
                  <div style={{ fontSize: '20px', fontWeight: '700' }}>{MONTHS[calMonth]} {calYear}</div>
                  <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Next →</button>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {[
                    { color: '#38bdf8', label: 'Event' },
                    { color: '#ef4444', label: 'Holiday' },
                    { color: '#f59e0b', label: 'Event + Holiday' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                      {item.label}
                    </div>
                  ))}
                </div>

                {/* Day Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                  {DAYS.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: d === 'Sun' ? '#f87171' : 'rgba(255,255,255,0.4)', padding: '8px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dayEvents = getEventsForDate(dateStr)
                    const isHoliday = isHolidayDate(dateStr)
                    const isToday = new Date().toISOString().split('T')[0] === dateStr
                    const isSunday = new Date(calYear, calMonth, day).getDay() === 0
                    const hasEvent = dayEvents.length > 0
                    const borderColor = isToday ? '#38bdf8' : isHoliday && hasEvent ? '#f59e0b' : isHoliday ? 'rgba(239,68,68,0.4)' : hasEvent ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.05)'
                    const bgColor = isHoliday && hasEvent ? 'rgba(245,158,11,0.06)' : isHoliday ? 'rgba(239,68,68,0.06)' : hasEvent ? 'rgba(56,189,248,0.06)' : 'rgba(255,255,255,0.02)'

                    return (
                      <div key={day}
                        style={{ minHeight: '80px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => { setSelectedDate(dateStr); if (hasEvent) setSelectedEvent(dayEvents[0]) }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: isToday ? '#38bdf8' : isHoliday ? '#f87171' : isSunday ? '#f87171' : 'rgba(255,255,255,0.7)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {day}
                          {!isHoliday && (
                            <span onClick={e => { e.stopPropagation(); openCreateForm(dateStr) }}
                              style={{ fontSize: '14px', color: 'rgba(255,255,255,0.2)', lineHeight: 1 }}>+</span>
                          )}
                        </div>
                        {isHoliday && (
                          <div style={{ fontSize: '9px', color: '#f87171', background: 'rgba(239,68,68,0.15)', borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🏖️ {getHolidayName(dateStr)}
                          </div>
                        )}
                        {dayEvents.slice(0, 2).map(ev => (
                          <div key={ev.id}
                            style={{ fontSize: '9px', color: '#38bdf8', background: 'rgba(56,189,248,0.15)', borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}>
                            {EVENT_TYPE_MAP[ev.event_type]?.icon} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div style={{ fontSize: '9px', color: '#a78bfa' }}>+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>📅 Upcoming Events ({upcomingEvents.length})</div>
                  {upcomingEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
                      No upcoming events. Click "+ Add Event" to create one.
                    </div>
                  ) : upcomingEvents.map(ev => {
                    const et = EVENT_TYPE_MAP[ev.event_type]
                    const isHoliday = isHolidayDate(ev.event_date)
                    return (
                      <div key={ev.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isHoliday ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '16px 20px', marginBottom: '10px', cursor: 'pointer' }}
                        onClick={() => setSelectedEvent(ev)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                              {et?.icon || '📋'}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{ev.title}</div>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ color: '#38bdf8', fontSize: '13px' }}>📅 {ev.event_date}</span>
                                {ev.start_time && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>⏰ {ev.start_time}{ev.end_time ? ` - ${ev.end_time}` : ''}</span>}
                                {ev.venue && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📍 {ev.venue}</span>}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>{et?.label || ev.event_type}</span>
                                {(ev.programs || []).map(p => (
                                  <span key={p} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{p}</span>
                                ))}
                                {isHoliday && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>⚠️ Holiday</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={e => { e.stopPropagation(); openEditForm(ev) }}
                              style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>✏️ Edit</button>
                            <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id) }}
                              style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Past Events */}
                {events.filter(e => new Date(e.event_date) < new Date(new Date().setHours(0,0,0,0))).length > 0 && (
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>📁 Past Events</div>
                    {events.filter(e => new Date(e.event_date) < new Date(new Date().setHours(0,0,0,0)))
                      .sort((a, b) => b.event_date.localeCompare(a.event_date))
                      .map(ev => {
                        const et = EVENT_TYPE_MAP[ev.event_type]
                        return (
                          <div key={ev.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px 18px', marginBottom: '8px', opacity: 0.7, cursor: 'pointer' }}
                            onClick={() => setSelectedEvent(ev)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ fontSize: '18px' }}>{et?.icon || '📋'}</span>
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{ev.title}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{ev.event_date}{ev.venue ? ` · ${ev.venue}` : ''}</div>
                                </div>
                              </div>
                              <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id) }}
                                style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Create / Edit Event Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
              {editingEvent ? '✏️ Edit Event' : '📅 Add New Event'}
            </h3>

            {holidayWarning && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#fbbf24' }}>
                {holidayWarning}
              </div>
            )}

            {/* Event Type */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Event Type *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {EVENT_TYPES.map(et => (
                <button key={et.id} onClick={() => setForm(f => ({ ...f, event_type: et.id }))}
                  style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${form.event_type === et.id ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: form.event_type === et.id ? 'rgba(56,189,248,0.15)' : 'transparent', color: form.event_type === et.id ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                  {et.icon} {et.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder='e.g. Annual Sports Day' style={inputStyle} />

            {/* Date */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date *</label>
            <input type='date' value={form.event_date} onChange={e => handleDateChange(e.target.value)} style={inputStyle} />

            {/* Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Start Time</label>
                <input type='time' value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>End Time</label>
                <input type='time' value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {/* Venue */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Venue</label>
            <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
              placeholder='e.g. School Auditorium / Ground' style={inputStyle} />

            {/* Description */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder='Event details, instructions for staff...' rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />

            {/* Programs */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Programs *</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <button onClick={() => toggleProgram('all')}
                style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${form.programs.includes('all') ? '#10b981' : 'rgba(255,255,255,0.1)'}`, background: form.programs.includes('all') ? 'rgba(16,185,129,0.15)' : 'transparent', color: form.programs.includes('all') ? '#34d399' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                🏫 All Programs
              </button>
              {programs.map(p => (
                <button key={p} onClick={() => toggleProgram(p)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${form.programs.includes(p) ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`, background: form.programs.includes(p) ? 'rgba(167,139,250,0.15)' : 'transparent', color: form.programs.includes(p) ? '#a78bfa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Attachment */}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Attachment (optional)</label>
            {form.attachment_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px' }}>
                <span style={{ color: '#34d399', fontSize: '13px', flex: 1 }}>📎 {form.attachment_name}</span>
                <button onClick={() => setForm(f => ({ ...f, attachment_url: '', attachment_name: '' }))}
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
            ) : (
              <div style={{ marginBottom: '14px' }}>
                <input type='file' onChange={e => e.target.files[0] && uploadAttachment(e.target.files[0])}
                  style={{ color: '#94a3b8', fontSize: '13px' }} />
                {uploading && <div style={{ color: '#38bdf8', fontSize: '12px', marginTop: '4px' }}>⏳ Uploading...</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowForm(false); setEditingEvent(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveEvent} disabled={saving} className="btn-primary">
                {saving ? '⏳ Saving...' : editingEvent ? '💾 Update Event' : '📅 Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ fontSize: '36px' }}>{EVENT_TYPE_MAP[selectedEvent.event_type]?.icon || '📋'}</div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '18px' }}>{selectedEvent.title}</div>
                  <div style={{ color: '#38bdf8', fontSize: '13px', marginTop: '2px' }}>{EVENT_TYPE_MAP[selectedEvent.event_type]?.label}</div>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {isHolidayDate(selectedEvent.event_date) && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', color: '#fbbf24', fontSize: '13px' }}>
                ⚠️ This date is also a holiday: {getHolidayName(selectedEvent.event_date)}
              </div>
            )}

            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {[
                ['📅 Date', selectedEvent.event_date],
                selectedEvent.start_time && ['⏰ Time', `${selectedEvent.start_time}${selectedEvent.end_time ? ` - ${selectedEvent.end_time}` : ''}`],
                selectedEvent.venue && ['📍 Venue', selectedEvent.venue],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', minWidth: '80px' }}>{label}</span>
                  <span style={{ color: '#fff', fontSize: '14px' }}>{value}</span>
                </div>
              ))}
            </div>

            {selectedEvent.description && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '6px' }}>Description</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{selectedEvent.description}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {(selectedEvent.programs || []).map(p => (
                <span key={p} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{p}</span>
              ))}
            </div>

            {selectedEvent.attachment_url && (
              <a href={selectedEvent.attachment_url} target='_blank' rel='noreferrer'
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', textDecoration: 'none', fontSize: '13px', marginBottom: '16px' }}>
                📎 {selectedEvent.attachment_name || 'Download Attachment'}
              </a>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedEvent(null); openEditForm(selectedEvent) }}
                style={{ padding: '8px 16px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>✏️ Edit</button>
              <button onClick={() => deleteEvent(selectedEvent.id)}
                style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
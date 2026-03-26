'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'

const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

export default function AdminPTMPage() {
  const [events, setEvents] = useState([])
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [view, setView] = useState('events') // events | bookings | summary
  const { schoolId, schoolName } = useSchool()

  const [form, setForm] = useState({
    title: '', description: '', from_date: '', to_date: '',
    meeting_type: 'both', status: 'upcoming', academic_year: CURRENT_AY
  })

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [evRes, bkRes, slRes] = await Promise.all([
      supabase.from('ptm_events').select('*').eq('school_id', schoolId).order('from_date', { ascending: false }),
      supabase.from('ptm_bookings').select('*, ptm_slots(*), profiles!ptm_bookings_parent_id_fkey(full_name), students(full_name, program)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('ptm_slots').select('*, profiles!ptm_slots_teacher_id_fkey(full_name)').eq('school_id', schoolId)
    ])
    setEvents(evRes.data || [])
    setBookings(bkRes.data || [])
    setSlots(slRes.data || [])
    setLoading(false)
  }

  const saveEvent = async () => {
    if (!form.title || !form.from_date) { alert('Please enter title and date'); return }
    setSaving(true)
    console.log('schoolId:', schoolId, 'form:', form) /*debug */
    const data = { ...form, school_id: schoolId }
    if (editingEvent) {
      await supabase.from('ptm_events').update(data).eq('id', editingEvent.id)
    } else {
      await supabase.from('ptm_events').insert(data)
    }
    setShowForm(false)
    setEditingEvent(null)
    resetForm()
    await fetchAll()
    setSaving(false)
  }

  const deleteEvent = async (id) => {
    if (!confirm('Delete this PTM event?')) return
    await supabase.from('ptm_events').delete().eq('id', id)
    await fetchAll()
  }

  const updateBookingStatus = async (id, status) => {
    await supabase.from('ptm_bookings').update({ status }).eq('id', id)
    await fetchAll()
  }

  const resetForm = () => setForm({
    title: '', description: '', from_date: '', to_date: '',
    meeting_type: 'both', status: 'upcoming', academic_year: CURRENT_AY
  })

  const statusColor = {
    upcoming: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
    ongoing: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    completed: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  }

  const bookingStatusColor = {
    booked: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
    confirmed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    completed: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    no_show: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  const eventBookings = (eventId) => bookings.filter(b => b.event_id === eventId)
  const eventSlots = (eventId) => slots.filter(s => s.event_id === eventId)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 11px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); white-space: nowrap; }
        tr:last-child td { border-bottom: none; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {[
          { href: '/admin', label: 'Dashboard', icon: '⊞' },
          { href: '/admin/students', label: 'Students', icon: '👶' },
          { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
          { href: '/admin/fees', label: 'Fees', icon: '💳' },
          { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
          { href: '/admin/ptm', label: 'PTM', icon: '🤝' },
          { href: '/admin/messages', label: 'Messages', icon: '💬' },
          { href: '/admin/reports', label: 'Reports', icon: '📈' },
        ].map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/ptm' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🤝 Parent Teacher Meeting</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>{schoolName}</p>
          </div>
          <button onClick={() => { resetForm(); setEditingEvent(null); setShowForm(true) }} className="btn-primary">+ Create PTM Event</button>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total Events', value: events.length, color: '#38bdf8' },
            { label: 'Total Slots', value: slots.length, color: '#a78bfa' },
            { label: 'Total Bookings', value: bookings.length, color: '#10b981' },
            { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, color: '#34d399' },
            { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, color: '#f87171' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['events', '📅 Events'], ['bookings', '📋 All Bookings'], ['summary', '📊 Summary']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* EVENTS VIEW */}
            {view === 'events' && (
              <>
                {events.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
                    <div>No PTM events yet. Click "+ Create PTM Event" to get started.</div>
                  </div>
                ) : events.map(event => {
                  const evBookings = eventBookings(event.id)
                  const evSlots = eventSlots(event.id)
                  return (
                    <div key={event.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '700', fontSize: '16px' }}>{event.title}</span>
                            <span className="badge" style={{ background: statusColor[event.status]?.bg, color: statusColor[event.status]?.color }}>{event.status}</span>
                            <span className="badge" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{event.meeting_type}</span>
                          </div>
                          {event.description && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '8px' }}>{event.description}</div>}
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📅 {event.from_date}{event.to_date && event.to_date !== event.from_date ? ` → ${event.to_date}` : ''}</span>
                            <span style={{ color: '#38bdf8', fontSize: '13px' }}>🕐 {evSlots.length} slots</span>
                            <span style={{ color: '#10b981', fontSize: '13px' }}>📋 {evBookings.length} bookings</span>
                            <span style={{ color: '#a78bfa', fontSize: '13px' }}>✅ {evBookings.filter(b => b.status === 'completed').length} completed</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <select value={event.status} onChange={e => supabase.from('ptm_events').update({ status: e.target.value }).eq('id', event.id).then(() => fetchAll())}
                            style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                            {['upcoming', 'ongoing', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => { setEditingEvent(event); setForm({ title: event.title, description: event.description || '', from_date: event.from_date, to_date: event.to_date || '', meeting_type: event.meeting_type, status: event.status, academic_year: event.academic_year }); setShowForm(true) }}
                            style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                          <button onClick={() => deleteEvent(event.id)}
                            style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </div>
                      {/* Slots for this event */}
                      {evSlots.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>Slots ({evSlots.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {evSlots.map(slot => {
                              const isBooked = bookings.find(b => b.slot_id === slot.id && b.status !== 'cancelled')
                              return (
                                <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: isBooked ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${isBooked ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '8px' }}>
                                  <span style={{ fontSize: '12px', color: isBooked ? '#fbbf24' : '#34d399', fontWeight: '600' }}>
                                    {slot.slot_date} {slot.start_time}-{slot.end_time}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                                    {slot.profiles?.full_name}
                                  </span>
                                  {slot.program && <span style={{ fontSize: '11px', color: '#a78bfa' }}>{slot.program}</span>}
                                  <span style={{ fontSize: '11px', color: isBooked ? '#fbbf24' : '#34d399' }}>
                                    {isBooked ? '🔴 Booked' : '🟢 Free'}
                                  </span>
                                    <button onClick={async () => {
                                    if (!confirm('Delete this slot? If booked, the booking will be cancelled.')) return
                                    const booking = bookings.find(b => b.slot_id === slot.id && b.status !== 'cancelled')
                                    await supabase.from('ptm_bookings').update({ status: 'cancelled' }).eq('slot_id', slot.id)
                                    await supabase.from('ptm_slots').delete().eq('id', slot.id)
                                    if (booking?.parent_id) {
                                      await supabase.from('chat_messages').insert({
                                        sender_id: schoolId,
                                        receiver_id: booking.parent_id,
                                        sender_name: schoolName,
                                        content: `⚠️ Your PTM slot on ${slot.slot_date} at ${slot.start_time} has been cancelled by the school. Please go to the PTM tab in your portal and rebook a new slot.`
                                      })
                                    }
                                    await fetchAll()
                                  }}
                                    style={{ padding: '2px 6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                                  {isBooked && (
                                      <button onClick={async () => {
                                      if (!confirm('Free up this slot? The booking will be cancelled and parent can rebook.')) return
                                      // Get booking details for notification
                                      const booking = bookings.find(b => b.slot_id === slot.id && b.status !== 'cancelled')
                                      // Cancel booking
                                      await supabase.from('ptm_bookings').update({ status: 'cancelled' }).eq('slot_id', slot.id)
                                      // Free up slot
                                      await supabase.from('ptm_slots').update({ is_available: true }).eq('id', slot.id)
                                      // Notify parent
                                      if (booking?.parent_id) {
                                        await supabase.from('chat_messages').insert({
                                          sender_id: schoolId,
                                          receiver_id: booking.parent_id,
                                          sender_name: schoolName,
                                          content: `⚠️ Your PTM slot on ${slot.slot_date} at ${slot.start_time} has been cancelled by the school. Please go to the PTM tab in your portal and rebook a new slot.`
                                        })
                                      }
                                      await fetchAll()
                                      alert('✅ Slot freed up and parent notified!')
                                    }}
                                      style={{ padding: '2px 6px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>🔓 Free Up</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {/* Bookings for this event */}
                      {evBookings.length > 0 && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>Bookings</div>
                          <div style={{ overflowX: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Student</th>
                                  <th>Parent</th>
                                  <th>Date & Time</th>
                                  <th>Type</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {evBookings.map(b => (
                                  <tr key={b.id}>
                                    <td>
                                      <div style={{ fontWeight: '600' }}>{b.students?.full_name}</div>
                                      <div style={{ color: '#a78bfa', fontSize: '11px' }}>{b.students?.program}</div>
                                    </td>
                                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{b.profiles?.full_name}</td>
                                    <td>
                                      <div>{b.ptm_slots?.slot_date}</div>
                                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{b.ptm_slots?.start_time} - {b.ptm_slots?.end_time}</div>
                                    </td>
                                    <td>
                                      <span className="badge" style={{ background: b.ptm_slots?.meeting_type === 'online' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)', color: b.ptm_slots?.meeting_type === 'online' ? '#38bdf8' : '#34d399' }}>
                                        {b.ptm_slots?.meeting_type === 'online' ? '💻 Online' : '🏫 In-Person'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge" style={{ background: bookingStatusColor[b.status]?.bg, color: bookingStatusColor[b.status]?.color }}>{b.status}</span>
                                    </td>
                                    <td>
                                      <select value={b.status} onChange={e => updateBookingStatus(b.id, e.target.value)}
                                        style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
                                        {['booked', 'confirmed', 'completed', 'cancelled', 'no_show'].map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* BOOKINGS VIEW */}
            {view === 'bookings' && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Parent</th>
                        <th>Event</th>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No bookings yet.</td></tr>
                      ) : bookings.map(b => (
                        <tr key={b.id}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{b.students?.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '11px' }}>{b.students?.program}</div>
                          </td>
                          <td style={{ color: 'rgba(255,255,255,0.6)' }}>{b.profiles?.full_name}</td>
                          <td style={{ color: '#38bdf8', fontSize: '12px' }}>{events.find(e => e.id === b.event_id)?.title}</td>
                          <td>
                            <div>{b.ptm_slots?.slot_date}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{b.ptm_slots?.start_time} - {b.ptm_slots?.end_time}</div>
                          </td>
                          <td>
                            <span className="badge" style={{ background: b.ptm_slots?.meeting_type === 'online' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)', color: b.ptm_slots?.meeting_type === 'online' ? '#38bdf8' : '#34d399' }}>
                              {b.ptm_slots?.meeting_type === 'online' ? '💻 Online' : '🏫 In-Person'}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: bookingStatusColor[b.status]?.bg, color: bookingStatusColor[b.status]?.color }}>{b.status}</span>
                          </td>
                          <td>
                            <select value={b.status} onChange={e => updateBookingStatus(b.id, e.target.value)}
                              style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
                              {['booked', 'confirmed', 'completed', 'cancelled', 'no_show'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* SUMMARY VIEW */}
            {view === 'summary' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total Booked', value: bookings.filter(b => b.status === 'booked').length, color: '#38bdf8' },
                    { label: 'Confirmed', value: bookings.filter(b => b.status === 'confirmed').length, color: '#10b981' },
                    { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, color: '#a78bfa' },
                    { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, color: '#ef4444' },
                    { label: 'No Show', value: bookings.filter(b => b.status === 'no_show').length, color: '#f59e0b' },
                    { label: 'Online Meetings', value: bookings.filter(b => b.ptm_slots?.meeting_type === 'online').length, color: '#38bdf8' },
                    { label: 'In-Person', value: bookings.filter(b => b.ptm_slots?.meeting_type === 'in-person').length, color: '#34d399' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: item.color }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Per event summary */}
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '14px' }}>📅 Event-wise Summary</div>
                {events.map(event => {
                  const evB = eventBookings(event.id)
                  const evS = eventSlots(event.id)
                  const completionRate = evS.length > 0 ? Math.round((evB.filter(b => b.status === 'completed').length / evS.length) * 100) : 0
                  return (
                    <div key={event.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>{event.title}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📅 {event.from_date}{event.to_date && event.to_date !== event.from_date ? ` → ${event.to_date}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Slots', value: evS.length, color: '#38bdf8' },
                            { label: 'Booked', value: evB.length, color: '#10b981' },
                            { label: 'Completed', value: evB.filter(b => b.status === 'completed').length, color: '#a78bfa' },
                            { label: 'Cancelled', value: evB.filter(b => b.status === 'cancelled').length, color: '#ef4444' },
                          ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center' }}>
                              <div style={{ color: item.color, fontWeight: '700', fontSize: '18px' }}>{item.value}</div>
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Completion Rate</span>
                          <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600' }}>{completionRate}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#a78bfa', borderRadius: '4px', width: `${completionRate}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Event Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingEvent ? '✏️ Edit PTM Event' : '🤝 Create PTM Event'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Event Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder='e.g. Term 1 Parent Teacher Meeting' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder='Brief description...' style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>From Date *</label>
                <input type='date' value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>To Date</label>
                <input type='date' value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Meeting Type</label>
            <select value={form.meeting_type} onChange={e => setForm({ ...form, meeting_type: e.target.value })} style={inputStyle}>
              <option value='both'>Both (In-Person + Online)</option>
              <option value='in-person'>In-Person Only</option>
              <option value='online'>Online Only</option>
            </select>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
              {['upcoming', 'ongoing', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveEvent} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingEvent ? 'Update' : 'Create Event'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
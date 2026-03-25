'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TeacherPTMPage() {
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('slots') // slots | bookings | notes
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(null) // booking object
  const [editingSlot, setEditingSlot] = useState(null)
  const router = useRouter()

  const [slotForm, setSlotForm] = useState({
    event_id: '', slot_date: '', start_time: '', end_time: '',
    duration_minutes: 15, meeting_type: 'in-person',
    meeting_link: '', location: '', max_bookings: 1
  })

  const [noteForm, setNoteForm] = useState({
    discussion_points: '', action_items: '',
    teacher_observations: '', follow_up_required: false,
    follow_up_notes: '', shared_with_parent: false
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const [evRes, slRes, bkRes, ntRes] = await Promise.all([
      supabase.from('ptm_events').select('*').eq('school_id', prof.school_id).eq('status', 'upcoming').order('from_date'),
      supabase.from('ptm_slots').select('*').eq('teacher_id', user.id).order('slot_date').order('start_time'),
      supabase.from('ptm_bookings').select('*, students(full_name, program), profiles!ptm_bookings_parent_id_fkey(full_name, phone)').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ptm_notes').select('*, students(full_name)').eq('teacher_id', user.id).order('created_at', { ascending: false })
    ])
    setEvents(evRes.data || [])
    setSlots(slRes.data || [])
    setBookings(bkRes.data || [])
    setNotes(ntRes.data || [])
    setLoading(false)
  }

  const saveSlot = async () => {
    if (!slotForm.event_id || !slotForm.slot_date || !slotForm.start_time || !slotForm.end_time) {
      alert('Please fill event, date and times'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const data = { ...slotForm, teacher_id: user.id, school_id: profile.school_id }
    if (editingSlot) {
      await supabase.from('ptm_slots').update(data).eq('id', editingSlot.id)
    } else {
      await supabase.from('ptm_slots').insert(data)
    }
    setShowSlotForm(false)
    setEditingSlot(null)
    resetSlotForm()
    await loadData()
    setSaving(false)
  }

  const deleteSlot = async (id) => {
    if (!confirm('Delete this slot?')) return
    await supabase.from('ptm_slots').delete().eq('id', id)
    await loadData()
  }

  const saveNote = async () => {
    if (!showNoteForm) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const existing = notes.find(n => n.booking_id === showNoteForm.id)
    const data = {
      ...noteForm,
      booking_id: showNoteForm.id,
      teacher_id: user.id,
      student_id: showNoteForm.student_id,
      parent_id: showNoteForm.parent_id,
      school_id: profile.school_id
    }
    if (existing) {
      await supabase.from('ptm_notes').update(data).eq('id', existing.id)
    } else {
      await supabase.from('ptm_notes').insert(data)
    }
    // Mark booking as completed
    await supabase.from('ptm_bookings').update({ status: 'completed' }).eq('id', showNoteForm.id)
    setShowNoteForm(null)
    resetNoteForm()
    await loadData()
    setSaving(false)
  }

  const resetSlotForm = () => setSlotForm({
    event_id: '', slot_date: '', start_time: '', end_time: '',
    duration_minutes: 15, meeting_type: 'in-person',
    meeting_link: '', location: '', max_bookings: 1
  })

  const resetNoteForm = () => setNoteForm({
    discussion_points: '', action_items: '',
    teacher_observations: '', follow_up_required: false,
    follow_up_notes: '', shared_with_parent: false
  })

  const generateSlots = async () => {
    if (!slotForm.event_id || !slotForm.slot_date || !slotForm.start_time || !slotForm.end_time) {
      alert('Please fill event, date and times first'); return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const start = new Date(`2000-01-01T${slotForm.start_time}`)
    const end = new Date(`2000-01-01T${slotForm.end_time}`)
    const duration = parseInt(slotForm.duration_minutes)
    const slotsToCreate = []
    let current = new Date(start)
    while (current < end) {
      const next = new Date(current.getTime() + duration * 60000)
      if (next > end) break
      slotsToCreate.push({
        event_id: slotForm.event_id,
        teacher_id: user.id,
        school_id: profile.school_id,
        slot_date: slotForm.slot_date,
        start_time: current.toTimeString().slice(0, 5),
        end_time: next.toTimeString().slice(0, 5),
        duration_minutes: duration,
        meeting_type: slotForm.meeting_type,
        meeting_link: slotForm.meeting_link,
        location: slotForm.location,
        max_bookings: slotForm.max_bookings
      })
      current = next
    }
    if (slotsToCreate.length === 0) { alert('No slots can be generated with these times'); return }
    if (!confirm(`Generate ${slotsToCreate.length} slots of ${duration} minutes each?`)) return
    setSaving(true)
    await supabase.from('ptm_slots').insert(slotsToCreate)
    setShowSlotForm(false)
    resetSlotForm()
    await loadData()
    setSaving(false)
    alert(`✅ ${slotsToCreate.length} slots created!`)
  }

  const bookingStatusColor = {
    booked: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
    confirmed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    completed: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
    no_show: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }
  const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: '80px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; }
        .logo span { color: #38bdf8; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 600px) { .content { padding: 16px; } }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>🤝 PTM</span>
        </div>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
      </div>

      <div className="content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700' }}>🤝 My PTM Slots</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage your meeting slots and meeting notes</p>
          </div>
          <button onClick={() => { resetSlotForm(); setEditingSlot(null); setShowSlotForm(true) }} className="btn-primary">+ Add Slots</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'My Slots', value: slots.length, color: '#38bdf8' },
            { label: 'Booked', value: bookings.filter(b => b.status === 'booked').length, color: '#f59e0b' },
            { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, color: '#10b981' },
            { label: 'Notes Added', value: notes.length, color: '#a78bfa' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['slots', '🕐 My Slots'], ['bookings', '📋 Bookings'], ['notes', '📝 Notes']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* SLOTS VIEW */}
            {view === 'slots' && (
              <>
                {events.length === 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#fbbf24' }}>
                    ⚠️ No active PTM events found. Ask your admin to create a PTM event first.
                  </div>
                )}
                {slots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🕐</div>
                    <div>No slots created yet. Click "+ Add Slots" to create your availability.</div>
                  </div>
                ) : (
                  // Group by date
                  [...new Set(slots.map(s => s.slot_date))].sort().map(date => (
                    <div key={date} style={{ marginBottom: '20px' }}>
                      <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '10px', fontSize: '15px' }}>
                        📅 {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      {slots.filter(s => s.slot_date === date).map(slot => {
                        const slotBookings = bookings.filter(b => b.slot_id === slot.id)
                        return (
                          <div key={slot.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '14px 20px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>{slot.start_time} - {slot.end_time}</div>
                              <span className="badge" style={{ background: slot.meeting_type === 'online' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)', color: slot.meeting_type === 'online' ? '#38bdf8' : '#34d399' }}>
                                {slot.meeting_type === 'online' ? '💻 Online' : '🏫 In-Person'}
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{slot.duration_minutes} min</span>
                              {slot.location && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📍 {slot.location}</span>}
                              {slotBookings.length > 0 && (
                                <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>👤 {slotBookings[0]?.students?.full_name}</span>
                              )}
                              {slotBookings.length === 0 && (
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Available</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {slot.meeting_type === 'online' && slot.meeting_link && (
                                <a href={slot.meeting_link} target='_blank' rel='noreferrer'
                                  style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', textDecoration: 'none' }}>🔗 Join</a>
                              )}
                              {slotBookings.length === 0 && (
                                <button onClick={() => deleteSlot(slot.id)}
                                  style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </>
            )}

            {/* BOOKINGS VIEW */}
            {view === 'bookings' && (
              <>
                {bookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No bookings yet.</div>
                ) : bookings.map(b => {
                  const note = notes.find(n => n.booking_id === b.id)
                  return (
                    <div key={b.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{b.students?.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '6px' }}>{b.students?.program}</div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>👪 {b.profiles?.full_name}</span>
                            {b.profiles?.phone && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📞 {b.profiles.phone}</span>}
                            <span style={{ color: '#38bdf8', fontSize: '13px' }}>📅 {b.ptm_slots?.slot_date} {b.ptm_slots?.start_time}</span>
                          </div>
                          {b.parent_notes && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px', fontStyle: 'italic' }}>💬 Parent: {b.parent_notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: bookingStatusColor[b.status]?.bg, color: bookingStatusColor[b.status]?.color }}>{b.status}</span>
                          {b.status !== 'cancelled' && b.status !== 'completed' && (
                            <button onClick={() => supabase.from('ptm_bookings').update({ status: 'confirmed' }).eq('id', b.id).then(() => loadData())}
                              style={{ padding: '5px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', cursor: 'pointer', fontSize: '12px' }}>✅ Confirm</button>
                          )}
                          <button onClick={() => {
                            setShowNoteForm(b)
                            if (note) setNoteForm({ discussion_points: note.discussion_points || '', action_items: note.action_items || '', teacher_observations: note.teacher_observations || '', follow_up_required: note.follow_up_required || false, follow_up_notes: note.follow_up_notes || '', shared_with_parent: note.shared_with_parent || false })
                            else resetNoteForm()
                          }}
                            style={{ padding: '5px 10px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px' }}>
                            {note ? '✏️ Edit Notes' : '📝 Add Notes'}
                          </button>
                        </div>
                      </div>
                      {note && (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)', borderRadius: '10px' }}>
                          <div style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>📝 Meeting Notes</div>
                          {note.discussion_points && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '4px' }}>💬 {note.discussion_points}</div>}
                          {note.action_items && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '4px' }}>✅ Action: {note.action_items}</div>}
                          {note.follow_up_required && <div style={{ color: '#fbbf24', fontSize: '12px' }}>⚠️ Follow-up required: {note.follow_up_notes}</div>}
                          {note.shared_with_parent && <div style={{ color: '#34d399', fontSize: '12px', marginTop: '4px' }}>✅ Shared with parent</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* NOTES VIEW */}
            {view === 'notes' && (
              <>
                {notes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No meeting notes yet.</div>
                ) : notes.map(note => (
                  <div key={note.id} className="card">
                    <div style={{ fontWeight: '700', marginBottom: '8px' }}>{note.students?.full_name}</div>
                    {note.discussion_points && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Discussion Points</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.discussion_points}</div>
                      </div>
                    )}
                    {note.action_items && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Action Items</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.action_items}</div>
                      </div>
                    )}
                    {note.teacher_observations && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Observations</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{note.teacher_observations}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      {note.follow_up_required && <span style={{ color: '#fbbf24', fontSize: '12px' }}>⚠️ Follow-up needed</span>}
                      {note.shared_with_parent && <span style={{ color: '#34d399', fontSize: '12px' }}>✅ Shared with parent</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Slot Form Modal */}
      {showSlotForm && (
        <div className="modal-overlay" onClick={() => setShowSlotForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>🕐 Create Time Slots</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>PTM Event *</label>
            <select value={slotForm.event_id} onChange={e => setSlotForm({ ...slotForm, event_id: e.target.value })} style={inputStyle}>
              <option value=''>-- Select Event --</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.title} ({e.from_date})</option>)}
            </select>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date *</label>
            <input type='date' value={slotForm.slot_date} onChange={e => setSlotForm({ ...slotForm, slot_date: e.target.value })} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Start Time *</label>
                <input type='time' value={slotForm.start_time} onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>End Time *</label>
                <input type='time' value={slotForm.end_time} onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Duration (minutes)</label>
                <select value={slotForm.duration_minutes} onChange={e => setSlotForm({ ...slotForm, duration_minutes: parseInt(e.target.value) })} style={inputStyle}>
                  {[10, 15, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Meeting Type</label>
                <select value={slotForm.meeting_type} onChange={e => setSlotForm({ ...slotForm, meeting_type: e.target.value })} style={inputStyle}>
                  <option value='in-person'>🏫 In-Person</option>
                  <option value='online'>💻 Online</option>
                </select>
              </div>
            </div>
            {slotForm.meeting_type === 'online' && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Meeting Link (Google Meet / Zoom)</label>
                <input value={slotForm.meeting_link} onChange={e => setSlotForm({ ...slotForm, meeting_link: e.target.value })} placeholder='https://meet.google.com/...' style={inputStyle} />
              </>
            )}
            {slotForm.meeting_type === 'in-person' && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Location / Room</label>
                <input value={slotForm.location} onChange={e => setSlotForm({ ...slotForm, location: e.target.value })} placeholder='e.g. Classroom 1, Staff Room' style={inputStyle} />
              </>
            )}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              💡 Click <strong style={{ color: '#38bdf8' }}>Auto Generate</strong> to automatically create {slotForm.duration_minutes}-minute slots between start and end time.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSlotForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={generateSlots} disabled={saving} style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '10px', padding: '10px 20px', color: '#a78bfa', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                ⚡ Auto Generate
              </button>
              <button onClick={saveSlot} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Single Slot'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Form Modal */}
      {showNoteForm && (
        <div className="modal-overlay" onClick={() => setShowNoteForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>📝 Meeting Notes</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showNoteForm.students?.full_name}</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Discussion Points</label>
            <textarea value={noteForm.discussion_points} onChange={e => setNoteForm({ ...noteForm, discussion_points: e.target.value })} placeholder='What was discussed in the meeting...' style={textareaStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Action Items</label>
            <textarea value={noteForm.action_items} onChange={e => setNoteForm({ ...noteForm, action_items: e.target.value })} placeholder='What needs to be done...' style={textareaStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Teacher Observations</label>
            <textarea value={noteForm.teacher_observations} onChange={e => setNoteForm({ ...noteForm, teacher_observations: e.target.value })} placeholder="Child's progress, strengths, areas to improve..." style={textareaStyle} />
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={noteForm.follow_up_required} onChange={e => setNoteForm({ ...noteForm, follow_up_required: e.target.checked })} />
                ⚠️ Follow-up Required
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={noteForm.shared_with_parent} onChange={e => setNoteForm({ ...noteForm, shared_with_parent: e.target.checked })} />
                📤 Share with Parent
              </label>
            </div>
            {noteForm.follow_up_required && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Follow-up Notes</label>
                <textarea value={noteForm.follow_up_notes} onChange={e => setNoteForm({ ...noteForm, follow_up_notes: e.target.value })} placeholder='What follow-up is needed...' style={textareaStyle} />
              </>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNoteForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveNote} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Notes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
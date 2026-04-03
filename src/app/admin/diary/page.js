'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const NOTE_TYPES = [
  { id: 'general', label: 'General Note', icon: '📝', color: '#38bdf8' },
  { id: 'activity', label: 'Daily Activity', icon: '🎨', color: '#a78bfa' },
  { id: 'food', label: 'Food/Meal', icon: '🍱', color: '#10b981' },
  { id: 'behavior', label: 'Behavior', icon: '⭐', color: '#f59e0b' },
  { id: 'homework', label: 'Homework', icon: '📚', color: '#f87171' },
]

export default function AdminDiaryPage() {
  const [entries, setEntries] = useState([])
  const [acks, setAcks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [teachers, setTeachers] = useState([])
  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [entRes, ackRes, tchRes] = await Promise.all([
      supabase.from('diary_entries')
        .select('*, profiles(full_name), students(full_name, program)')
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('diary_acknowledgements').select('*'),
      supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).in('role', ['teacher', 'staff'])
    ])
    setEntries(entRes.data || [])
    setAcks(ackRes.data || [])
    setTeachers(tchRes.data || [])
    setLoading(false)
  }

  const deleteEntry = async (id) => {
    if (!confirm('Delete this diary entry?')) return
    await supabase.from('diary_acknowledgements').delete().eq('diary_entry_id', id)
    await supabase.from('diary_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const getAckCount = (entryId) => acks.filter(a => a.diary_entry_id === entryId).length

  const filtered = entries.filter(e => {
    if (filterType !== 'all' && e.note_type !== filterType) return false
    if (filterTeacher !== 'all' && e.teacher_id !== filterTeacher) return false
    if (filterDate && e.date !== filterDate) return false
    return true
  })

  // Group by date
  const grouped = filtered.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = []
    acc[entry.date].push(entry)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 16px; margin-bottom: 12px; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📔 Diary</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>All diary entries sent by teachers to parents</p>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '10px 0' }}>{filtered.length} entries</span>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {NOTE_TYPES.map(nt => (
            <div key={nt.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', cursor: 'pointer', borderColor: filterType === nt.id ? nt.color : 'rgba(255,255,255,0.07)' }}
              onClick={() => setFilterType(filterType === nt.id ? 'all' : nt.id)}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{nt.icon}</div>
              <div style={{ color: nt.color, fontWeight: '700', fontSize: '20px' }}>
                {entries.filter(e => e.note_type === nt.id).length}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{nt.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Note type filter */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['all', '📔 All'], ...NOTE_TYPES.map(n => [n.id, `${n.icon} ${n.label}`])].map(([id, label]) => (
              <button key={id} onClick={() => setFilterType(id)}
                style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${filterType === id ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: filterType === id ? 'rgba(56,189,248,0.15)' : 'transparent', color: filterType === id ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Teacher filter */}
          <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
            style={{ padding: '7px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
            <option value='all'>All Teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>

          {/* Date filter */}
          <input type='date' value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '7px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }} />
          {filterDate && (
            <button onClick={() => setFilterDate('')}
              style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📔</div>
            <div>No diary entries found.</div>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dateEntries]) => (
            <div key={date} style={{ marginBottom: '28px' }}>
              {/* Date header */}
              <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📅 {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: '400' }}>{dateEntries.length} note{dateEntries.length > 1 ? 's' : ''}</span>
              </div>

              {dateEntries.map(entry => {
                const noteType = NOTE_TYPES.find(n => n.id === entry.note_type)
                const ackCount = getAckCount(entry.id)
                return (
                  <div key={entry.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        {/* Badges */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: `${noteType?.color}22`, color: noteType?.color }}>
                            {noteType?.icon} {noteType?.label}
                          </span>
                          {entry.is_class_note ? (
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>👥 Class Note · {entry.program}</span>
                          ) : (
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                              👶 {entry.students?.full_name} · {entry.students?.program}
                            </span>
                          )}
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                            👩‍🏫 {entry.profiles?.full_name}
                          </span>
                        </div>

                        {/* Title & Content */}
                        {entry.title && <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{entry.title}</div>}
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{entry.content}</div>
                      </div>

                      {/* Actions */}
                      <button onClick={() => deleteEntry(entry.id)}
                        style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>🗑️</button>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                        {new Date(entry.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: ackCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: ackCount > 0 ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                        {ackCount > 0 ? `✅ ${ackCount} parent${ackCount > 1 ? 's' : ''} acknowledged` : '⏳ No acknowledgements yet'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
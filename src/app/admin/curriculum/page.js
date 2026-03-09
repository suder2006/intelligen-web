'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const SUBJECTS = ['Circle Time', 'English', 'Math', 'EVS', 'Art & Craft', 'Music', 'Physical Education', 'Story Time', 'Free Play']

export default function CurriculumPage() {
  const router = useRouter()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [schedule, setSchedule] = useState({})
  const [existing, setExisting] = useState([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('create')

  useEffect(() => {
    supabase.from('classes').select('*').then(({ data }) => setClasses(data || []))
    fetchExisting()
  }, [])

  async function fetchExisting() {
    const { data } = await supabase.from('curriculum').select('*').order('week_start', { ascending: false })
    setExisting(data || [])
  }

  function updateSchedule(day, field, value) {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  async function saveCurriculum() {
    if (!selectedClass || !weekStart) { alert('Please select class and week'); return }
    setSaving(true)
    const cls = classes.find(c => c.id === selectedClass)
    const rows = DAYS.map(day => ({
      class_id: selectedClass,
      class_name: cls?.name,
      week_start: weekStart,
      day,
      subject: schedule[day]?.subject || '',
      activity: schedule[day]?.activity || '',
    }))
    await supabase.from('curriculum').delete().match({ class_id: selectedClass, week_start: weekStart })
    const { error } = await supabase.from('curriculum').insert(rows)
    if (!error) {
      // Send push notification to teachers
      const { data: teachers } = await supabase.from('profiles').select('push_token').eq('role', 'teacher')
      const tokens = teachers?.map(t => t.push_token).filter(Boolean)
      if (tokens?.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokens.map(token => ({
            to: token,
            title: '📚 New Curriculum Published',
            body: `${cls?.name} curriculum for week of ${weekStart} is ready!`,
            sound: 'default'
          })))
        })
      }
      alert('Curriculum saved and teachers notified!')
      fetchExisting()
      setTab('view')
    }
    setSaving(false)
  }

  const grouped = existing.reduce((acc, row) => {
    const key = `${row.class_name}-${row.week_start}`
    if (!acc[key]) acc[key] = { class_name: row.class_name, week_start: row.week_start, days: [] }
    acc[key].days.push(row)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📚 Curriculum Manager</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {['create', 'view'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: tab === t ? '#38bdf8' : '#1e293b', color: tab === t ? '#0f172a' : '#94a3b8' }}>
              {t === 'create' ? '➕ Create' : '📋 View All'}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '14px' }}>Select Class</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  style={{ width: '100%', marginTop: '8px', padding: '12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }}>
                  <option value=''>-- Select Class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '14px' }}>Week Starting</label>
                <input type='date' value={weekStart} onChange={e => setWeekStart(e.target.value)}
                  style={{ width: '100%', marginTop: '8px', padding: '12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
              </div>
            </div>

            {DAYS.map(day => (
              <div key={day} style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '12px' }}>📅 {day}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <select value={schedule[day]?.subject || ''} onChange={e => updateSchedule(day, 'subject', e.target.value)}
                    style={{ padding: '10px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }}>
                    <option value=''>-- Subject --</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input placeholder='Activity description...' value={schedule[day]?.activity || ''} onChange={e => updateSchedule(day, 'activity', e.target.value)}
                    style={{ padding: '10px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
                </div>
              </div>
            ))}

            <button onClick={saveCurriculum} disabled={saving}
              style={{ width: '100%', padding: '14px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginTop: '8px' }}>
              {saving ? 'Saving...' : '💾 Save & Notify Teachers'}
            </button>
          </div>
        )}

        {tab === 'view' && (
          <div>
            {Object.values(grouped).length === 0 && <p style={{ color: '#64748b' }}>No curriculum created yet.</p>}
            {Object.values(grouped).map(group => (
              <div key={`${group.class_name}-${group.week_start}`} style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ color: '#38bdf8', fontWeight: 'bold' }}>🏫 {group.class_name}</h3>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Week of {group.week_start}</span>
                </div>
                {group.days.map(row => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '120px 150px 1fr', gap: '12px', padding: '10px', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: '#94a3b8' }}>{row.day}</span>
                    <span style={{ color: '#f59e0b' }}>{row.subject}</span>
                    <span style={{ color: '#cbd5e1' }}>{row.activity}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIME_SLOTS = ['Morning Circle', 'Pre-Lunch', 'Post-Lunch', 'Evening']

export default function PlannerPage() {
  const router = useRouter()
  const [blocks, setBlocks] = useState([])
  const [masters, setMasters] = useState([])
  const [curriculum, setCurriculum] = useState([])
  const [selectedBlock, setSelectedBlock] = useState('')
  const [form, setForm] = useState({
    program: '', day: '', time_slot: '', planned_activity: '',
    activity_category: '', activity_type: '', materials_needed: '',
    teacher_notes: '', special_event: false, assigned_date: ''
  })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    supabase.from('curriculum_blocks').select('*').order('start_date').then(({ data }) => setBlocks(data || []))
    supabase.from('curriculum_masters').select('*').order('value').then(({ data }) => setMasters(data || []))
  }, [])

  useEffect(() => { if (selectedBlock) fetchCurriculum() }, [selectedBlock])

  async function fetchCurriculum() {
    const { data } = await supabase.from('curriculum').select('*').eq('block_id', selectedBlock).order('assigned_date').order('time_slot')
    setCurriculum(data || [])
  }

  function getMasters(type) { return masters.filter(m => m.type === type).map(m => m.value) }

  async function save() {
    if (!form.program || !form.day || !form.time_slot) { alert('Please fill Program, Day and Time Slot'); return }
    setSaving(true)
    const payload = { ...form, block_id: selectedBlock }
    if (editing) {
      await supabase.from('curriculum').update(payload).eq('id', editing)
    } else {
      await supabase.from('curriculum').insert(payload)
    }
    setForm({ program: '', day: '', time_slot: '', planned_activity: '', activity_category: '', activity_type: '', materials_needed: '', teacher_notes: '', special_event: false, assigned_date: '' })
    setEditing(null)
    setShowForm(false)
    await fetchCurriculum()
    setSaving(false)
  }

  async function deleteRow(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('curriculum').delete().eq('id', id)
    fetchCurriculum()
  }

  function startEdit(row) {
    setEditing(row.id)
    setForm({ program: row.program, day: row.day, time_slot: row.time_slot, planned_activity: row.planned_activity, activity_category: row.activity_category, activity_type: row.activity_type, materials_needed: row.materials_needed, teacher_notes: row.teacher_notes, special_event: row.special_event, assigned_date: row.assigned_date })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  const grouped = curriculum.reduce((acc, row) => {
    const key = row.day
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const inputStyle = { width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📝 Curriculum Planner</h1>
        </div>

        {/* Block Selector */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', border: '1px solid #334155', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#94a3b8', fontSize: '13px' }}>Select Curriculum Block</label>
            <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)} style={inputStyle}>
              <option value=''>-- Select Block --</option>
              {blocks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.academic_year}) · {b.start_date} → {b.end_date}</option>)}
            </select>
          </div>
          {selectedBlock && (
            <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ program: '', day: '', time_slot: '', planned_activity: '', activity_category: '', activity_type: '', materials_needed: '', teacher_notes: '', special_event: false, assigned_date: '' }) }}
              style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ➕ Add Entry
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #38bdf8', marginBottom: '24px' }}>
            <h3 style={{ color: '#38bdf8', marginBottom: '20px' }}>{editing ? '✏️ Edit Entry' : '➕ New Curriculum Entry'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Program *</label>
                <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('program').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Day *</label>
                <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Time Slot *</label>
                <select value={form.time_slot} onChange={e => setForm({ ...form, time_slot: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Planned Activity</label>
                <select value={form.planned_activity} onChange={e => setForm({ ...form, planned_activity: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('activity').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Activity Category</label>
                <select value={form.activity_category} onChange={e => setForm({ ...form, activity_category: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('activity_category').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Activity Type</label>
                <select value={form.activity_type} onChange={e => setForm({ ...form, activity_type: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('activity_type').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Assigned Date</label>
                <input type='date' value={form.assigned_date} onChange={e => setForm({ ...form, assigned_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Materials Needed</label>
                <input placeholder='e.g. Crayons, Paper' value={form.materials_needed} onChange={e => setForm({ ...form, materials_needed: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                <input type='checkbox' checked={form.special_event} onChange={e => setForm({ ...form, special_event: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <label style={{ color: '#f59e0b', fontSize: '14px' }}>⭐ Special Event</label>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Teacher Notes</label>
              <textarea placeholder='Instructions or notes for teacher...' value={form.teacher_notes} onChange={e => setForm({ ...form, teacher_notes: e.target.value })}
                style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Saving...' : editing ? '✏️ Update' : '💾 Save Entry'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null) }}
                style={{ padding: '10px 24px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Curriculum Grid */}
        {selectedBlock && (
          <div>
            {curriculum.length === 0 && !showForm && (
              <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                <p>No curriculum entries yet. Click ➕ Add Entry to start planning!</p>
              </div>
            )}
            {DAYS.map(day => grouped[day] && (
              <div key={day} style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', border: '1px solid #334155', marginBottom: '16px' }}>
                <h3 style={{ color: '#38bdf8', marginBottom: '16px' }}>📅 {day}</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                        {['Program', 'Time Slot', 'Activity', 'Category', 'Type', 'Date', 'Special', ''].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[day].map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '10px 12px', color: '#a78bfa' }}>{row.program}</td>
                          <td style={{ padding: '10px 12px', color: '#38bdf8' }}>{row.time_slot}</td>
                          <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{row.planned_activity}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.activity_category}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.activity_type}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{row.assigned_date}</td>
                          <td style={{ padding: '10px 12px' }}>{row.special_event ? '⭐' : ''}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => startEdit(row)} style={{ padding: '4px 8px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                              <button onClick={() => deleteRow(row.id)} style={{ padding: '4px 8px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
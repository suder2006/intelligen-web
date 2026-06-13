'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSchool } from '@/hooks/useSchool'



export default function PlannerPage() {
  const router = useRouter()
  const { schoolId } = useSchool()
  const [blocks, setBlocks] = useState([])
  const [masters, setMasters] = useState([])
  const [curriculum, setCurriculum] = useState([])
  const [selectedBlock, setSelectedBlock] = useState('')
  const [form, setForm] = useState({
    program: '', assigned_date: '', day: '',
    concept_focus: '', assembly_time: '', circle_time: '',
    planned_activity: '', activity_category: '',
    play_type: '', home_task: '', teacher_notes: ''
  })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState([])
  const [uploadErrors, setUploadErrors] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [filterProgram, setFilterProgram] = useState('')
  const [filterDay, setFilterDay] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')


  useEffect(() => {
    if (!schoolId) return
    supabase.from('curriculum_blocks').select('*').eq('school_id', schoolId).order('start_date').then(({ data }) => setBlocks(data || []))
    supabase.from('curriculum_masters').select('*').eq('school_id', schoolId).order('value').then(({ data }) => setMasters(data || []))
  }, [schoolId])

  useEffect(() => { if (selectedBlock) fetchCurriculum() }, [selectedBlock])

  async function fetchCurriculum() {
    const { data } = await supabase.from('curriculum').select('*').eq('block_id', selectedBlock).order('assigned_date').order('program')
    setCurriculum(data || [])
  }

  function getMasters(type) { return masters.filter(m => m.type === type).map(m => m.value) }

  function handleDateChange(date) {
    if (!date) { setForm({ ...form, assigned_date: '', day: '' }); return }
    const d = new Date(date + 'T00:00:00')
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    setForm({ ...form, assigned_date: date, day: dayName })
  }

  async function save() {
    if (!form.program || !form.assigned_date) { alert('Please fill Program and Date'); return }
    setSaving(true)
    const payload = {
      program: form.program,
      assigned_date: form.assigned_date,
      day: form.day,
      concept_focus: form.concept_focus,
      assembly_time: form.assembly_time,
      circle_time: form.circle_time,
      planned_activity: form.planned_activity,
      activity_category: form.activity_category,
      play_type: form.play_type,
      home_task: form.home_task,
      teacher_notes: form.teacher_notes,
      block_id: selectedBlock,
      school_id: schoolId
    }
    if (editing) {
      await supabase.from('curriculum').update(payload).eq('id', editing)
    } else {
      await supabase.from('curriculum').insert(payload)
    }
    resetForm()
    setEditing(null)
    setShowForm(false)
    await fetchCurriculum()
    setSaving(false)
  }

  function resetForm() {
    setForm({
      program: '', assigned_date: '', day: '',
      concept_focus: '', assembly_time: '', circle_time: '',
      planned_activity: '', activity_category: '',
      play_type: '', home_task: '', teacher_notes: ''
    })
  }

function parseCSV(text) {
  // First fix line breaks inside quoted fields
  const normalized = normalizeCSV(text)
  const lines = normalized.split('\n')
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const values = parseCSVLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    if (row.date) {
      let dateStr = row.date
      if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [dd, mm, yyyy] = dateStr.split('-')
        dateStr = `${yyyy}-${mm}-${dd}`
        row.date = dateStr
      }
      try {
        const d = new Date(dateStr + 'T00:00:00')
        row.day = d.toLocaleDateString('en-US', { weekday: 'long' })
      } catch (e) { row.day = '' }
    }
    row._line = idx + 2
    return row
  })
}

function normalizeCSV(text) {
  // Replace line breaks inside quoted fields with a space
  let result = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      inQuotes = !inQuotes
      result += char
    } else if ((char === '\n' || char === '\r') && inQuotes) {
      // Replace line break inside quotes with space
      result += ' '
      // Skip \r\n combination
      if (char === '\r' && next === '\n') i++
    } else {
      result += char
    }
  }
  return result
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function validateCSV(rows) {
  const errors = []
  const programs = getMasters('program')
  rows.forEach(row => {
    if (!row.program) errors.push(`Row ${row._line}: Program is required`)
    if (!row.date) errors.push(`Row ${row._line}: Date is required`)
  })
  return errors
}

async function handleCSVUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const text = await file.text()
  const rows = parseCSV(text)
  const errors = validateCSV(rows)
  setUploadErrors(errors)
  setUploadPreview(rows)
  setShowUploadModal(true)
  e.target.value = ''
}

async function confirmUpload() {
  if (uploadErrors.length > 0) { alert('Please fix errors before uploading'); return }
  setUploading(true)
  const inserts = uploadPreview.map(row => ({
    program: row.program,
    assigned_date: row.date,
    day: row.day,
    concept_focus: row.concept_focus || '',
    assembly_time: row.assembly_time || '',
    circle_time: row.circle_time || '',
    planned_activity: row.curriculum || '',
    activity_category: row.category || '',
    play_type: row.play_type || '',
    home_task: row.home_task || '',
    teacher_notes: row.teacher_notes || '',
    block_id: selectedBlock,
    school_id: schoolId
  }))
  const { error } = await supabase.from('curriculum').insert(inserts)
  if (error) { alert('Upload error: ' + error.message); setUploading(false); return }
  setShowUploadModal(false)
  setUploadPreview([])
  setUploadErrors([])
  await fetchCurriculum()
  setUploading(false)
  alert(`✅ ${inserts.length} entries uploaded successfully!`)
}

  async function deleteRow(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('curriculum').delete().eq('id', id)
    fetchCurriculum()
  }

  function startEdit(row) {
    setEditing(row.id)
    setForm({
      program: row.program || '',
      assigned_date: row.assigned_date || '',
      day: row.day || '',
      concept_focus: row.concept_focus || '',
      assembly_time: row.assembly_time || '',
      circle_time: row.circle_time || '',
      planned_activity: row.planned_activity || '',
      activity_category: row.activity_category || '',
      play_type: row.play_type || '',
      home_task: row.home_task || '',
      teacher_notes: row.teacher_notes || ''
    })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  const filteredCurriculum = curriculum.filter(row => {
    if (filterProgram && row.program !== filterProgram) return false
    if (filterDay && row.day !== filterDay) return false
    if (filterFrom && row.assigned_date < filterFrom) return false
    if (filterTo && row.assigned_date > filterTo) return false
    return true
    })

  const grouped = filteredCurriculum.reduce((acc, row) => {
    const key = row.assigned_date || 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
    }, {})

  const inputStyle = { width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }
  const textareaStyle = { ...inputStyle, height: '72px', resize: 'vertical', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowForm(!showForm); setEditing(null); resetForm() }}
              style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ➕ Add Entry
            </button>
            <label style={{ padding: '10px 20px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '14px' }}>
              📤 Upload CSV
              <input type='file' accept='.csv' onChange={handleCSVUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}
        </div>
        {/* Filters */}
        {selectedBlock && curriculum.length > 0 && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '16px 20px', border: '1px solid #334155', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', alignSelf: 'center' }}>🔍 Filter:</div>
            
            {/* Program */}
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Program</div>
              <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                style={{ padding: '8px 12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
                <option value=''>All Programs</option>
                {getMasters('program').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Day */}
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Day</div>
              <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
                style={{ padding: '8px 12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
                <option value=''>All Days</option>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>From Date</div>
              <input type='date' value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                style={{ padding: '8px 12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }} />
            </div>

            {/* To Date */}
            <div>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>To Date</div>
              <input type='date' value={filterTo} onChange={e => setFilterTo(e.target.value)}
                style={{ padding: '8px 12px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }} />
            </div>

            {/* Results count + Clear */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                {filteredCurriculum.length} of {curriculum.length} entries
              </span>
              {(filterProgram || filterDay || filterFrom || filterTo) && (
                <button onClick={() => { setFilterProgram(''); setFilterDay(''); setFilterFrom(''); setFilterTo('') }}
                  style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}
        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #38bdf8', marginBottom: '24px' }}>
            <h3 style={{ color: '#38bdf8', marginBottom: '20px' }}>{editing ? '✏️ Edit Entry' : '➕ New Curriculum Entry'}</h3>

            {/* Row 1: Program, Date, Day */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Program *</label>
                <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('program').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Date *</label>
                <input type='date' value={form.assigned_date}
                  onChange={e => handleDateChange(e.target.value)}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Day (auto-filled)</label>
                <input
                  value={form.day}
                  readOnly
                  placeholder='Auto-filled from date'
                  style={{ ...inputStyle, backgroundColor: '#0f172a', color: form.day ? '#38bdf8' : '#475569', cursor: 'not-allowed', opacity: 0.8 }}
                />
              </div>
            </div>

            {/* Row 2: Concept Focus, Assembly Time, Circle Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Concept Focus</label>
                <input placeholder='e.g. Colors, Numbers, Shapes' value={form.concept_focus}
                  onChange={e => setForm({ ...form, concept_focus: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Assembly Time</label>
                <input placeholder='e.g. Morning Prayer, National Anthem' value={form.assembly_time}
                  onChange={e => setForm({ ...form, assembly_time: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Circle Time</label>
                <input placeholder='e.g. Show and Tell, Story Time' value={form.circle_time}
                  onChange={e => setForm({ ...form, circle_time: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {/* Row 3: Curriculum, Categories, Indoor/Outdoor Play */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Curriculum</label>
                <input placeholder='e.g. Finger Painting, Number Writing' value={form.planned_activity}
                  onChange={e => setForm({ ...form, planned_activity: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Categories</label>
                <select value={form.activity_category} onChange={e => setForm({ ...form, activity_category: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {getMasters('activity_category').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Indoor/Outdoor Play</label>
                <input placeholder='e.g. Indoor block building, Outdoor running' value={form.play_type}
                  onChange={e => setForm({ ...form, play_type: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {/* Row 4: Home Task, Teacher Notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Home Task</label>
                <textarea placeholder='e.g. Draw a flower, Count 10 objects at home'
                  value={form.home_task} onChange={e => setForm({ ...form, home_task: e.target.value })}
                  style={textareaStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Teacher Notes</label>
                <textarea placeholder='Instructions or notes for teacher...'
                  value={form.teacher_notes} onChange={e => setForm({ ...form, teacher_notes: e.target.value })}
                  style={textareaStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Saving...' : editing ? '✏️ Update' : '💾 Save Entry'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); resetForm() }}
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
            {Object.keys(grouped).sort().map(date => grouped[date] && (
              <div key={date} style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', border: '1px solid #334155', marginBottom: '16px' }}>
                <h3 style={{ color: '#38bdf8', marginBottom: '16px' }}>
                  📅 {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                        {['Program', 'Date', 'Concept Focus', 'Assembly', 'Circle Time', 'Curriculum', 'Category', 'Play', 'Home Task', 'Notes', ''].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[date].map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px', color: '#a78bfa', whiteSpace: 'nowrap' }}>{row.program}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.assigned_date}</td>
                          <td style={{ padding: '10px 12px', color: '#38bdf8' }}>{row.concept_focus || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.assembly_time || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.circle_time || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{row.planned_activity || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {row.activity_category ? (
                              <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{row.activity_category}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{row.play_type || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#fbbf24', maxWidth: '150px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.home_task || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: '150px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.teacher_notes || '—'}</div>
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
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
    {/* CSV Upload Modal */}
    {showUploadModal && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>📤 CSV Upload Preview</h3>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>{uploadPreview.length} rows found</p>

      {uploadErrors.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ color: '#f87171', fontWeight: '600', marginBottom: '8px' }}>❌ {uploadErrors.length} Error(s) found — fix before uploading:</div>
          {uploadErrors.map((e, i) => <div key={i} style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '4px' }}>• {e}</div>)}
        </div>
      )}

      {uploadErrors.length === 0 && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: '#34d399', fontWeight: '600' }}>✅ All rows validated successfully!</div>
        </div>
      )}

      {/* Preview Table */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
              {['#', 'Program', 'Date', 'Day', 'Concept', 'Assembly', 'Circle', 'Curriculum', 'Category', 'Play', 'Home Task'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uploadPreview.slice(0, 10).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                <td style={{ padding: '6px 10px', color: '#a78bfa' }}>{row.program}</td>
                <td style={{ padding: '6px 10px', color: '#64748b' }}>{row.date}</td>
                <td style={{ padding: '6px 10px', color: '#38bdf8' }}>{row.day}</td>
                <td style={{ padding: '6px 10px', color: '#e2e8f0' }}>{row.concept_focus}</td>
                <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.assembly_time}</td>
                <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.circle_time}</td>
                <td style={{ padding: '6px 10px', color: '#e2e8f0' }}>{row.curriculum}</td>
                <td style={{ padding: '6px 10px', color: '#a78bfa' }}>{row.category}</td>
                <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.play_type}</td>
                <td style={{ padding: '6px 10px', color: '#fbbf24' }}>{row.home_task}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {uploadPreview.length > 10 && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', padding: '8px 10px' }}>
            ... and {uploadPreview.length - 10} more rows
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => { setShowUploadModal(false); setUploadPreview([]); setUploadErrors([]) }}
          style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
          Cancel
        </button>
        <button onClick={confirmUpload} disabled={uploading || uploadErrors.length > 0}
          style={{ flex: 1, padding: '12px', background: uploadErrors.length > 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: uploadErrors.length > 0 ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          {uploading ? '⏳ Uploading...' : `✅ Upload ${uploadPreview.length} Rows`}
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  )
}
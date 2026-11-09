'use client'
import { useState } from 'react'
import { MEASURE_FIELDS, validateMeasurement, calculateBmi, bmiCategory, todayLocal } from '@/lib/growth'
import { GrowthModal, BMI_COLORS, fieldLabelStyle } from './shared'

// Admin adds one measurement. Saved through /api/admin/growth (action: create).
export default function AddGrowthEntryModal({ students, programs, schoolId, growthApi, inputStyle, onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [program, setProgram] = useState('')
  const [student, setStudent] = useState(null)
  const [form, setForm] = useState({ measurement_date: todayLocal(), height_cm: '', weight_kg: '', head_circumference_cm: '', chest_circumference_cm: '' })
  const [status, setStatus] = useState('approved')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const matches = students.filter(s =>
    s.full_name?.toLowerCase().includes(search.trim().toLowerCase()) && (!program || s.program === program))

  const bmi = calculateBmi(parseFloat(form.weight_kg), parseFloat(form.height_cm))
  const category = bmiCategory(bmi)

  const save = async () => {
    setError('')
    if (!student) { setError('Pick a student'); return }
    const { error: invalid } = validateMeasurement(form, { dateOfBirth: student.date_of_birth })
    if (invalid) { setError(invalid); return }
    setSaving(true)
    try {
      await growthApi({ action: 'create', school_id: schoolId, student_id: student.id, status, values: form })
      await onSaved(`Saved ${student.full_name}'s measurement as ${status}.`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <GrowthModal title="➕ Add Entry" onClose={onClose} busy={saving} maxWidth="520px">
      {/* Student */}
      <div style={fieldLabelStyle}>Student</div>
      {student ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ color: '#34d399', fontWeight: '600', fontSize: '14px' }}>{student.full_name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{student.program}{student.student_id ? ` · ${student.student_id}` : ''}</div>
          </div>
          <button className="btn-edit" onClick={() => setStudent(null)} disabled={saving}>Change</button>
        </div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ ...inputStyle, flex: 1 }} />
            <select value={program} onChange={e => setProgram(e.target.value)} style={inputStyle}>
              <option value=''>All Programs</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
            {matches.length === 0 ? (
              <div style={{ padding: '14px', color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center' }}>No students found</div>
            ) : matches.map(s => (
              <div key={s.id} onClick={() => setStudent(s)} className="pick-row"
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#fff' }}>{s.full_name}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{s.program}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Measurements */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
          <span style={fieldLabelStyle}>Date</span>
          <input type="date" max={todayLocal()} value={form.measurement_date}
            onChange={e => setForm(f => ({ ...f, measurement_date: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
        </label>
        {MEASURE_FIELDS.map(f => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={fieldLabelStyle}>{f.label} ({f.unit})</span>
            <input type="number" step="0.1" min={f.min} max={f.max} value={form[f.key]}
              onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
          </label>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={fieldLabelStyle}>BMI</span>
          <div style={{ padding: '8px 0', color: BMI_COLORS[category] || '#94a3b8', fontWeight: '700', fontSize: '13px' }}>
            {bmi ? `${bmi} (${category})` : '—'}
          </div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={fieldLabelStyle}>Save as</span>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            <option value="approved">Approved (parents see it now)</option>
            <option value="pending">Pending</option>
          </select>
        </label>
      </div>

      {error && <div style={{ marginTop: '14px', color: '#f87171', fontSize: '13px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</button>
      </div>
    </GrowthModal>
  )
}

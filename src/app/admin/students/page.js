'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [form, setForm] = useState({
    student_id: '', full_name: '', date_of_birth: '', gender: '',
    program: '', status: 'active', parent_name: '',
    parent_phone: '', parent_email: '', address: ''
  })

const [schoolId, setSchoolId] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
      setSchoolId(prof?.school_id)
      fetchStudents(prof?.school_id)
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value')
        .then(({ data }) => setPrograms(data?.map(d => d.value) || []))
    }
    init()
  }, [])

  async function fetchStudents(sid) {
    setLoading(true)
    const id = sid || schoolId
    const { data } = await supabase.from('students').select('*').eq('school_id', id).order('full_name')
    setStudents(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.full_name) { alert('Please enter student name'); return }
    setSaving(true)
    const SCHOOL_ID = schoolId
    try {
      let studentId = editing
      if (editing) {
        const { error } = await supabase.from('students').update(form).eq('id', editing)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('students').insert({ ...form, school_id: SCHOOL_ID }).select().single()
        if (error) throw error
        studentId = data.id
      }

      // Auto-link parent if email provided
      if (form.parent_email && studentId) {
        await supabase.functions.invoke('create-parent-user', {
          body: {
            student_id: studentId,
            parent_name: form.parent_name || '',
            parent_email: form.parent_email,
            parent_phone: form.parent_phone || ''
          }
        })
      }

      setForm({ student_id: '', full_name: '', date_of_birth: '', gender: '', program: '', status: 'active', parent_name: '', parent_phone: '', parent_email: '', address: '' })
      setEditing(null)
      setShowForm(false)
      await fetchStudents()
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  async function deleteStudent(id) {
    if (!confirm('Delete this student?')) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  function startEdit(s) {
    setEditing(s.id)
    setForm({ full_name: s.full_name, date_of_birth: s.date_of_birth || '', gender: s.gender || '', program: s.program || '', status: s.status || 'active', parent_name: s.parent_name || '', parent_phone: s.parent_phone || '', parent_email: s.parent_email || '', address: s.address || '' })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  const filtered = students.filter(s => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchProgram = filterProgram ? s.program === filterProgram : true
    return matchSearch && matchProgram
  })

  const inputStyle = { width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>👶 Students ({students.length})</h1>
          </div>
          <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ student_id: '', full_name: '', date_of_birth: '', gender: '', program: '', status: 'active', parent_name: '', parent_phone: '', parent_email: '', address: '' }) }}
            style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            ➕ Add Student
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #38bdf8', marginBottom: '24px' }}>
            <h3 style={{ color: '#38bdf8', marginBottom: '20px' }}>{editing ? '✏️ Edit Student' : '➕ New Student'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Student ID *</label>
                <input value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} placeholder='e.g. TK-001' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Full Name *</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder='Student full name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Date of Birth</label>
                <input type='date' value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Gender</label>
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  <option value='Male'>Male</option>
                  <option value='Female'>Female</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Program *</label>
                <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select Program --</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  <option value='active'>Active</option>
                  <option value='inactive'>Inactive</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Parent Name</label>
                <input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} placeholder='Parent full name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Parent Phone</label>
                <input value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Parent Email</label>
                <input type='email' value={form.parent_email} onChange={e => setForm({ ...form, parent_email: e.target.value })} placeholder='parent@email.com' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder='Home address' style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Saving...' : editing ? '✏️ Update' : '💾 Save Student'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null) }}
                style={{ padding: '10px 24px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input placeholder='Search students...' value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '10px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
            style={{ padding: '10px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }}>
            <option value=''>All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Stats by Program */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {programs.map(p => {
            const count = students.filter(s => s.program === p).length
            return (
              <div key={p} onClick={() => setFilterProgram(filterProgram === p ? '' : p)}
                style={{ padding: '8px 16px', backgroundColor: filterProgram === p ? '#38bdf8' : '#1e293b', color: filterProgram === p ? '#0f172a' : '#94a3b8', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', border: '1px solid #334155' }}>
                {p}: {count}
              </div>
            )
          })}
        </div>

        {/* Students Table */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['ID', 'Name', 'Program', 'DOB', 'Gender', 'Parent', 'Phone', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>No students found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                        {s.full_name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '500' }}>{s.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ backgroundColor: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{s.program || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{s.student_id || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{s.date_of_birth || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{s.gender || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{s.parent_name || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{s.parent_phone || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ backgroundColor: s.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: s.status === 'active' ? '#34d399' : '#f87171', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => startEdit(s)} style={{ padding: '5px 10px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                      <button onClick={() => deleteStudent(s.id)} style={{ padding: '5px 10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
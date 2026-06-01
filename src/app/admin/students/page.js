'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSchool } from '@/hooks/useSchool'
import { APP_URL } from '@/lib/config'
import Link from 'next/link'

export default function StudentsPage() {
  const router = useRouter()
  const { schoolId } = useSchool()
  const [students, setStudents] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [parentCredentials, setParentCredentials] = useState(null)
  const [copiedCredentials, setCopiedCredentials] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [form, setForm] = useState({
    student_id: '', full_name: '', date_of_birth: '', gender: '',
    program: '', status: 'active', parent_name: '',
    parent_phone: '', parent_email: '', address: '',
    blood_group: '', emergency_contact: '', admission_date: '',
    authorized_pickup: '', medical_info: '', allergies: '',
    immunization_complete: false, medical_alert: false,
    medical_alert_note: '', child_aadhar: '', father_aadhar: '', mother_aadhar: ''
  })



//const [schoolId, setSchoolId] = useState(null)

useEffect(() => {
  if (!schoolId) return
  fetchStudents(schoolId)
  supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value')
    .then(({ data }) => setPrograms(data?.map(d => d.value) || []))
}, [schoolId, showArchived])

const [showArchived, setShowArchived] = useState(false)

async function fetchStudents(sid) {
  setLoading(true)
  let query = supabase.from('students').select('*').eq('school_id', sid || schoolId).order('full_name')
  if (!showArchived) query = query.eq('status', 'active')
  else query = query.eq('status', 'archived')
  const { data } = await query
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
      if (form.parent_email && studentId && !editing) {
        const { data: parentRes } = await supabase.functions.invoke('create-parent-user', {
          body: {
            student_id: studentId,
            parent_name: form.parent_name || '',
            parent_email: form.parent_email,
            parent_phone: form.parent_phone || ''
          }
        })
        // Show credentials popup
        setParentCredentials({
          student_name: form.full_name,
          parent_name: form.parent_name || '',
          email: form.parent_email,
          password: 'Parent@123456',
          url: APP_URL
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

const [archiveModal, setArchiveModal] = useState(null)
const [archiveForm, setArchiveForm] = useState({ reason: '', notes: '' })
const [archiving, setArchiving] = useState(false)

const ARCHIVE_REASONS = [
  'Withdrawn from school',
  'Relocated to another city',
  'Completed program',
  'Transferred to another school',
  'Duplicate entry',
  'Family reasons',
  'Other'
]

async function archiveStudent() {
  if (!archiveForm.reason) { alert('Please select a reason'); return }
  setArchiving(true)
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('students').update({
    status: 'archived',
    archive_reason: archiveForm.reason,
    archive_notes: archiveForm.notes,
    archived_at: new Date().toISOString(),
    archived_by: user.id
  }).eq('id', archiveModal.id)
  if (error) { alert('Error: ' + error.message); setArchiving(false); return }
  setArchiveModal(null)
  setArchiveForm({ reason: '', notes: '' })
  setArchiving(false)
  await fetchStudents()
  alert(`✅ ${archiveModal.full_name} has been archived successfully!`)
}

async function restoreStudent(student) {
  if (!confirm(`Restore ${student.full_name} back to active?`)) return
  const { error } = await supabase.from('students').update({
    status: 'active',
    archive_reason: null,
    archive_notes: null,
    archived_at: null,
    archived_by: null
  }).eq('id', student.id)
  if (error) { alert('Error: ' + error.message); return }
  alert(`✅ ${student.full_name} has been restored successfully!`)
  await fetchStudents()
}

  function startEdit(s) {
    setEditing(s.id)
    setForm({
      student_id: s.student_id || '', full_name: s.full_name, date_of_birth: s.date_of_birth || '',
      gender: s.gender || '', program: s.program || '', status: s.status || 'active',
      parent_name: s.parent_name || '', parent_phone: s.parent_phone || '',
      parent_email: s.parent_email || '', address: s.address || '',
      blood_group: s.blood_group || '', emergency_contact: s.emergency_contact || '',
      admission_date: s.admission_date || '', authorized_pickup: s.authorized_pickup || '',
      medical_info: s.medical_info || '', allergies: s.allergies || '',
      immunization_complete: s.immunization_complete || false,
      medical_alert: s.medical_alert || false, medical_alert_note: s.medical_alert_note || '',
      child_aadhar: s.child_aadhar || '', father_aadhar: s.father_aadhar || '',
      mother_aadhar: s.mother_aadhar || ''
    })
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
            <Link href='/admin' style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', textDecoration: 'none' }}>← Back</Link>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>👶 Students ({students.length})</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href='/admin/students/idcard' style={{ padding: '10px 20px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', color: '#38bdf8', fontWeight: '600', fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>🪪 Print ID Cards</Link>
          
          <button onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ student_id: '', full_name: '', date_of_birth: '', gender: '', program: '', status: 'active', parent_name: '', parent_phone: '', parent_email: '', address: '' }) }}
            style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            ➕ Add Student
          </button>
          <button onClick={() => { setShowArchived(!showArchived); fetchStudents() }}
            style={{ padding: '10px 20px', backgroundColor: showArchived ? '#f59e0b' : '#334155', color: showArchived ? '#000' : '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
            {showArchived ? '👶 Active Students' : '🗃️ Archived Students'}
          </button>
          </div>
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
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Admission Date</label>
                <input type='date' value={form.admission_date} onChange={e => setForm({ ...form, admission_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Blood Group</label>
                <select value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Emergency Contact</label>
                <input value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Authorized Pickup Persons</label>
                <input value={form.authorized_pickup} onChange={e => setForm({ ...form, authorized_pickup: e.target.value })} placeholder='e.g. Father, Mother, Grandparent' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Allergies</label>
                <input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder='e.g. Nuts, Dairy, Gluten' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Medical Info / Conditions</label>
                <input value={form.medical_info} onChange={e => setForm({ ...form, medical_info: e.target.value })} placeholder='e.g. Asthma, Diabetes' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Medical Alert Note</label>
                <input value={form.medical_alert_note} onChange={e => setForm({ ...form, medical_alert_note: e.target.value })} placeholder='e.g. Carry EpiPen at all times' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Child Aadhar Number</label>
                <input value={form.child_aadhar} onChange={e => setForm({ ...form, child_aadhar: e.target.value })} placeholder='12 digit Aadhar number' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Father Aadhar Number</label>
                <input value={form.father_aadhar} onChange={e => setForm({ ...form, father_aadhar: e.target.value })} placeholder='12 digit Aadhar number' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px' }}>Mother Aadhar Number</label>
                <input value={form.mother_aadhar} onChange={e => setForm({ ...form, mother_aadhar: e.target.value })} placeholder='12 digit Aadhar number' style={inputStyle} />
              </div>
            </div>
                        {/* Checkboxes */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={form.immunization_complete} onChange={e => setForm({ ...form, immunization_complete: e.target.checked })} />
                ✅ Immunization Complete
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={form.medical_alert} onChange={e => setForm({ ...form, medical_alert: e.target.checked })} />
                🚨 Medical Alert
              </label>
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
                    {!showArchived && (
                    <button onClick={() => startEdit(s)} style={{ padding: '5px 10px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    )}
                    {showArchived ? (
                    <button onClick={() => restoreStudent(s)} 
                    style={{ padding: '5px 10px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                    ♻️ Restore
                    </button>
                     ) : (
                    <button onClick={() => { setArchiveModal(s); setArchiveForm({ reason: '', notes: '' }) }} 
                    style={{ padding: '5px 10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    🗃️
                    </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Parent Credentials Modal */}
      {parentCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
          onClick={() => setParentCredentials(null)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>Student Added!</div>
            <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>Parent account created for {parentCredentials.student_name}</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Parent Name</div>
                <div style={{ fontWeight: '600' }}>{parentCredentials.parent_name || '—'}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Login Email</div>
                <div style={{ fontWeight: '600', color: '#38bdf8' }}>{parentCredentials.email}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Password</div>
                <div style={{ fontWeight: '600', color: '#10b981' }}>{parentCredentials.password}</div>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Login URL</div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#f59e0b' }}>{parentCredentials.url}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => {
                const text = `IntelliGen Parent Login\nStudent: ${parentCredentials.student_name}\nParent: ${parentCredentials.parent_name}\nEmail: ${parentCredentials.email}\nPassword: ${parentCredentials.password}\nURL: ${parentCredentials.url}`
                navigator.clipboard.writeText(text)
                setCopiedCredentials(true)
                setTimeout(() => setCopiedCredentials(false), 2000)
              }} style={{ flex: 1, padding: '11px', background: copiedCredentials ? '#10b981' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: copiedCredentials ? '#fff' : 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                {copiedCredentials ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
              <button onClick={() => { setParentCredentials(null); setCopiedCredentials(false) }}
                style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveModal && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '460px' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '12px' }}>🗃️</div>
      <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px', textAlign: 'center' }}>Archive Student</div>
      <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>{archiveModal.full_name}</div>
      
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
        <div style={{ color: '#fbbf24', fontSize: '13px' }}>⚠️ This student will be archived, not permanently deleted. You can restore them later if needed.</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Reason for Archiving *</label>
        <select value={archiveForm.reason} onChange={e => setArchiveForm({ ...archiveForm, reason: e.target.value })}
          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
          <option value=''>-- Select Reason --</option>
          {ARCHIVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Additional Notes (optional)</label>
        <textarea value={archiveForm.notes} onChange={e => setArchiveForm({ ...archiveForm, notes: e.target.value })}
          placeholder='Any additional information...'
          rows={3}
          style={{ width: '100%', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => { setArchiveModal(null); setArchiveForm({ reason: '', notes: '' }) }}
          style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px' }}>
          Cancel
        </button>
        <button onClick={archiveStudent} disabled={archiving}
          style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
          {archiving ? '⏳ Archiving...' : '🗃️ Archive Student'}
        </button>
      </div>
    </div>
  </div>
)}    

    </div>
  )
}
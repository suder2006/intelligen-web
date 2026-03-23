'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSchool } from '@/hooks/useSchool'
import { APP_URL } from '@/lib/config'
import Link from 'next/link'

export default function IDCardPage() {
  const [students, setStudents] = useState([])
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterProgram, setFilterProgram] = useState('all')
  const [programs, setPrograms] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])
  const [printMode, setPrintMode] = useState(false)
  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [stuRes, schRes, progRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name'),
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value')
    ])
    setStudents(stuRes.data || [])
    setSchool(schRes.data)
    setPrograms(progRes.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const toggleStudent = (id) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const selectAll = () => {
    const filtered = filteredStudents.map(s => s.id)
    setSelectedStudents(filtered)
  }

  const clearAll = () => setSelectedStudents([])

  const filteredStudents = students.filter(s => filterProgram === 'all' || s.program === filterProgram)
  const studentsToPrint = printMode
    ? students.filter(s => selectedStudents.includes(s.id))
    : []

  const getAge = (dob) => {
    if (!dob) return ''
    const today = new Date()
    const birth = new Date(dob)
    const years = today.getFullYear() - birth.getFullYear()
    const months = today.getMonth() - birth.getMonth()
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
      return `${years - 1}y ${12 + months}m`
    }
    return `${years}y ${months}m`
  }

  const IDCard = ({ student }) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${APP_URL}/checkin?student=${student.id}`)}`
    const primaryColor = school?.primary_color || '#0ea5e9'

    return (
      <div style={{
        width: '85.6mm', height: '54mm',
        background: '#fff', borderRadius: '8px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden', position: 'relative',
        fontFamily: 'Arial, sans-serif',
        pageBreakInside: 'avoid',
        display: 'inline-block',
        margin: '4px'
      }}>
        {/* Top bar */}
        <div style={{ background: primaryColor, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {school?.logo_url && <img src={school.logo_url} alt='logo' style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />}
          <div>
            <div style={{ color: '#fff', fontSize: '7px', fontWeight: '700', lineHeight: 1.2 }}>{school?.name || 'School'}</div>
            {school?.address && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '5.5px', lineHeight: 1.2 }}>{school.address}</div>}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', padding: '5px 6px', gap: '6px', flex: 1 }}>
          {/* Left - Photo + QR */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            {/* Photo */}
            <div style={{ width: '28mm', height: '28mm', borderRadius: '4px', overflow: 'hidden', border: `2px solid ${primaryColor}`, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>👤</div>
              )}
            </div>
            {/* QR */}
            <img src={qrUrl} alt='QR' style={{ width: '18mm', height: '18mm' }} />
          </div>

          {/* Right - Details */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {/* Name */}
            <div style={{ fontWeight: '800', fontSize: '9px', color: '#1e293b', marginBottom: '2px', lineHeight: 1.2 }}>{student.full_name}</div>

            {/* Medical Alert */}
            {student.medical_alert && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '3px', padding: '1px 4px', fontSize: '6px', color: '#dc2626', fontWeight: '700', marginBottom: '2px', display: 'inline-block' }}>
                🚨 MEDICAL ALERT
              </div>
            )}

            {/* Info rows */}
            {[
              { label: 'ID', value: student.student_id },
              { label: 'Program', value: student.program },
              { label: 'Age', value: getAge(student.date_of_birth) },
              { label: 'Blood', value: student.blood_group, highlight: true },
              { label: 'Parent', value: student.parent_name },
              { label: 'Phone', value: student.parent_phone },
              { label: 'Emergency', value: student.emergency_contact },
            ].filter(item => item.value).map(item => (
              <div key={item.label} style={{ display: 'flex', gap: '3px', marginBottom: '1.5px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '5.5px', color: '#64748b', fontWeight: '600', minWidth: '20px', flexShrink: 0 }}>{item.label}:</span>
                <span style={{ fontSize: '6px', color: item.highlight ? '#dc2626' : '#1e293b', fontWeight: item.highlight ? '700' : '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
              </div>
            ))}

            {/* Allergies */}
            {student.allergies && (
              <div style={{ marginTop: '2px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '3px', padding: '1px 4px' }}>
                <span style={{ fontSize: '5.5px', color: '#92400e', fontWeight: '700' }}>⚠️ Allergy: </span>
                <span style={{ fontSize: '5.5px', color: '#92400e' }}>{student.allergies}</span>
              </div>
            )}

            {/* Immunization */}
            {student.immunization_complete && (
              <div style={{ marginTop: '2px', fontSize: '5.5px', color: '#16a34a', fontWeight: '600' }}>✅ Immunization Complete</div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '2px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '5px', color: '#94a3b8' }}>Admission: {student.admission_date || '—'}</span>
          <span style={{ fontSize: '5px', color: '#94a3b8' }}>Authorized: {student.authorized_pickup || '—'}</span>
          {student.immunization_complete && <span style={{ fontSize: '5px', color: '#16a34a' }}>✅ Vaccinated</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { background: white !important; padding: 10mm !important; display: block !important; }
          .id-card-grid { display: flex; flex-wrap: wrap; gap: 4mm; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href='/admin/students' style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>← Back to Students</Link>
          <h1 style={{ fontSize: '20px', fontWeight: '700' }}>🪪 Student ID Cards</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '10px 0' }}>{selectedStudents.length} selected</span>
          <button onClick={selectAll} className="btn-secondary">Select All</button>
          <button onClick={clearAll} className="btn-secondary">Clear</button>
          <button onClick={() => { setPrintMode(true); setTimeout(() => window.print(), 300) }} disabled={selectedStudents.length === 0} className="btn-primary">
            🖨️ Print {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ padding: '16px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
          style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
          <option value='all'>All Programs</option>
          {programs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{filteredStudents.length} students</span>
      </div>

      {/* Student selector grid */}
      <div className="no-print" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {filteredStudents.map(s => (
              <div key={s.id} onClick={() => toggleStudent(s.id)}
                style={{ background: selectedStudents.includes(s.id) ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedStudents.includes(s.id) ? '#38bdf8' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedStudents.includes(s.id) ? '#38bdf8' : 'rgba(255,255,255,0.3)'}`, background: selectedStudents.includes(s.id) ? '#38bdf8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selectedStudents.includes(s.id) && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', flexShrink: 0 }}>
                  {s.photo_url ? <img src={s.photo_url} alt={s.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : s.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.full_name}</div>
                  <div style={{ color: '#a78bfa', fontSize: '12px' }}>{s.program} · {s.student_id || 'No ID'}</div>
                  {s.medical_alert && <div style={{ color: '#f87171', fontSize: '11px' }}>🚨 Medical Alert</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview section */}
        {selectedStudents.length > 0 && (
          <>
            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '16px', color: '#38bdf8' }}>
              🪪 Preview — {selectedStudents.length} ID Card{selectedStudents.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {students.filter(s => selectedStudents.includes(s.id)).map(s => (
                <IDCard key={s.id} student={s} />
              ))}
            </div>
          </>
        )}
      </div>

{/* Print area */}
      <div className="print-area">
        <div className="id-card-grid">
          {students.filter(s => selectedStudents.includes(s.id)).map(s => (
            <IDCard key={s.id} student={s} />
          ))}
        </div>
      </div>
    </div>
  )
}
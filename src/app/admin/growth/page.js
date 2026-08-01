'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const BMI_CATEGORY = (bmi) => {
  if (!bmi) return { label: '—', color: '#94a3b8' }
  if (bmi < 14) return { label: 'Underweight', color: '#f59e0b' }
  if (bmi < 18) return { label: 'Normal', color: '#10b981' }
  if (bmi < 20) return { label: 'Overweight', color: '#f97316' }
  return { label: 'Obese', color: '#ef4444' }
}

const calculateBMI = (weight, height) => {
  if (!weight || !height) return null
  const heightM = height / 100
  return (weight / (heightM * heightM)).toFixed(1)
}

export default function AdminGrowthPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [activeTab, setActiveTab] = useState('pending')
  const [approving, setApproving] = useState(null)
  const [programs, setPrograms] = useState([])
  const [filterProgram, setFilterProgram] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { if (schoolId) fetchData() }, [schoolId])

  const fetchData = async () => {
    setLoading(true)
    const [studRes, measRes, progRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name'),
      supabase.from('physical_growth').select('*, students(full_name, program, date_of_birth, photo_url), profiles(full_name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('curriculum_masters').select('value').eq('type', 'program').eq('school_id', schoolId).order('value')
    ])
    setStudents(studRes.data || [])
    setMeasurements(measRes.data || [])
    setPrograms(progRes.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const approveMeasurement = async (id) => {
    setApproving(id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('physical_growth').update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', id)
    if (!error) await fetchData()
    setApproving(null)
  }

  const rejectMeasurement = async (id) => {
    if (!confirm('Reject this measurement?')) return
    const { error } = await supabase.from('physical_growth').update({ status: 'rejected' }).eq('id', id)
    if (!error) await fetchData()
  }

  const deleteMeasurement = async (id) => {
    if (!confirm('Delete this measurement permanently?')) return
    await supabase.from('physical_growth').delete().eq('id', id)
    await fetchData()
  }

  const pending = measurements.filter(m => m.status === 'pending')
  const approved = measurements.filter(m => m.status === 'approved')

  const studentMeasurements = selectedStudent
    ? measurements.filter(m => m.student_id === selectedStudent.id).sort((a, b) => new Date(a.measurement_date) - new Date(b.measurement_date))
    : []

  const filteredStudents = students.filter(s => {
    const matchSearch = s.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchProgram = filterProgram ? s.program === filterProgram : true
    return matchSearch && matchProgram
  })

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #10b981, #34d399); border: none; border-radius: 10px; padding: 8px 16px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 6px 12px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .tab { padding: 8px 20px; border-radius: 10px; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; }
        .tab-active { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
        .tab-inactive { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.07); }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📏 Physical Growth</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Track height, weight and growth measurements · IAP standards
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '6px 14px', background: 'rgba(245,158,11,0.15)', borderRadius: '20px', color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>
              ⏳ {pending.length} Pending
            </span>
            <span style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.15)', borderRadius: '20px', color: '#34d399', fontSize: '13px', fontWeight: '600' }}>
              ✅ {approved.length} Approved
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>

            {/* Student list */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px' }}>Students</div>
              <input
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginBottom: '8px' }}
              />
              <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginBottom: '12px' }}>
                <option value=''>All Programs</option>
                {programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {filteredStudents.map(s => {
                const studentMeas = measurements.filter(m => m.student_id === s.id)
                const latest = studentMeas.find(m => m.status === 'approved')
                const hasPending = studentMeas.some(m => m.status === 'pending')
                return (
                  <div key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    style={{
                      padding: '12px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
                      background: selectedStudent?.id === s.id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selectedStudent?.id === s.id ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {s.photo_url ? (
                          <img src={s.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{s.full_name?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: selectedStudent?.id === s.id ? '#34d399' : '#fff', fontWeight: '600', fontSize: '13px' }}>{s.full_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{s.program}</div>
                      </div>
                      {hasPending && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
                    </div>
                    {latest && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '12px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>📏 {latest.height_cm}cm</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>⚖️ {latest.weight_kg}kg</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right panel */}
            <div>
              {selectedStudent ? (
                <>
                  {/* Student header */}
                  <div className="card" style={{ borderColor: 'rgba(16,185,129,0.2)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedStudent.photo_url ? (
                          <img src={selectedStudent.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: '#fff', fontWeight: '700', fontSize: '22px' }}>{selectedStudent.full_name?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>{selectedStudent.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px' }}>{selectedStudent.program}</div>
                        {selectedStudent.date_of_birth && (
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                            DOB: {new Date(selectedStudent.date_of_birth).toLocaleDateString('en-IN')}
                          </div>
                        )}
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <span style={{ padding: '4px 12px', background: 'rgba(245,158,11,0.15)', borderRadius: '20px', color: '#f59e0b', fontSize: '12px' }}>
                          ⏳ {studentMeasurements.filter(m => m.status === 'pending').length} Pending
                        </span>
                        <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.15)', borderRadius: '20px', color: '#34d399', fontSize: '12px' }}>
                          ✅ {studentMeasurements.filter(m => m.status === 'approved').length} Approved
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button className={`tab ${activeTab === 'pending' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('pending')}>
                      ⏳ Pending ({studentMeasurements.filter(m => m.status === 'pending').length})
                    </button>
                    <button className={`tab ${activeTab === 'approved' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('approved')}>
                      ✅ Approved ({studentMeasurements.filter(m => m.status === 'approved').length})
                    </button>
                    <button className={`tab ${activeTab === 'history' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('history')}>
                      📊 Growth Chart
                    </button>
                  </div>

                  {/* Pending measurements */}
                  {activeTab === 'pending' && (
                    <>
                      {studentMeasurements.filter(m => m.status === 'pending').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                          <div>No pending measurements</div>
                        </div>
                      ) : studentMeasurements.filter(m => m.status === 'pending').map(m => {
                        const bmi = calculateBMI(m.weight_kg, m.height_cm)
                        const bmiInfo = BMI_CATEGORY(bmi)
                        return (
                          <div key={m.id} className="card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                              <div>
                                <div style={{ color: '#f59e0b', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                                  ⏳ Pending Approval
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                  Measured: {new Date(m.measurement_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                                {m.profiles?.full_name && (
                                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>
                                    By: {m.profiles.full_name}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-primary" onClick={() => approveMeasurement(m.id)} disabled={approving === m.id}>
                                  {approving === m.id ? '⏳' : '✅ Approve'}
                                </button>
                                <button className="btn-danger" onClick={() => rejectMeasurement(m.id)}>
                                  ❌ Reject
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                              {m.height_cm && (
                                <div style={{ background: 'rgba(56,189,248,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#38bdf8', fontSize: '20px', fontWeight: '700' }}>{m.height_cm}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Height (cm)</div>
                                </div>
                              )}
                              {m.weight_kg && (
                                <div style={{ background: 'rgba(167,139,250,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#a78bfa', fontSize: '20px', fontWeight: '700' }}>{m.weight_kg}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Weight (kg)</div>
                                </div>
                              )}
                              {m.head_circumference_cm && (
                                <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#f97316', fontSize: '20px', fontWeight: '700' }}>{m.head_circumference_cm}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Head (cm)</div>
                                </div>
                              )}
                              {bmi && (
                                <div style={{ background: `rgba(16,185,129,0.08)`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: bmiInfo.color, fontSize: '20px', fontWeight: '700' }}>{bmi}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>BMI ({bmiInfo.label})</div>
                                </div>
                              )}
                            </div>
                            {m.chest_circumference_cm && (
                              <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                                Chest: {m.chest_circumference_cm} cm
                              </div>
                            )}
                            {m.notes && (
                              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                                📝 {m.notes}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Approved measurements */}
                  {activeTab === 'approved' && (
                    <>
                      {studentMeasurements.filter(m => m.status === 'approved').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                          No approved measurements yet
                        </div>
                      ) : studentMeasurements.filter(m => m.status === 'approved').map(m => {
                        const bmi = calculateBMI(m.weight_kg, m.height_cm)
                        const bmiInfo = BMI_CATEGORY(bmi)
                        return (
                          <div key={m.id} className="card" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div>
                                <div style={{ color: '#34d399', fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>
                                  ✅ {new Date(m.measurement_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                                {m.profiles?.full_name && (
                                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>By: {m.profiles.full_name}</div>
                                )}
                              </div>
                              <button className="btn-danger" onClick={() => deleteMeasurement(m.id)}>🗑️ Delete</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                              {m.height_cm && (
                                <div style={{ background: 'rgba(56,189,248,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#38bdf8', fontSize: '20px', fontWeight: '700' }}>{m.height_cm}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Height (cm)</div>
                                </div>
                              )}
                              {m.weight_kg && (
                                <div style={{ background: 'rgba(167,139,250,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#a78bfa', fontSize: '20px', fontWeight: '700' }}>{m.weight_kg}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Weight (kg)</div>
                                </div>
                              )}
                              {m.head_circumference_cm && (
                                <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: '#f97316', fontSize: '20px', fontWeight: '700' }}>{m.head_circumference_cm}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Head (cm)</div>
                                </div>
                              )}
                              {bmi && (
                                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                  <div style={{ color: bmiInfo.color, fontSize: '20px', fontWeight: '700' }}>{bmi}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>BMI ({bmiInfo.label})</div>
                                </div>
                              )}
                            </div>
                            {m.notes && (
                              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                                📝 {m.notes}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Growth Chart */}
                  {activeTab === 'history' && (
                    <div className="card">
                      {studentMeasurements.filter(m => m.status === 'approved').length < 2 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
                          <div>Need at least 2 approved measurements to show chart</div>
                        </div>
                      ) : (
                        <>
                          <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px', marginBottom: '16px' }}>📊 Growth Chart</div>
                          {/* Simple table chart */}
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                  {['Date', 'Height (cm)', 'Weight (kg)', 'Head (cm)', 'BMI', 'Category'].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {studentMeasurements.filter(m => m.status === 'approved').map((m, idx, arr) => {
                                  const bmi = calculateBMI(m.weight_kg, m.height_cm)
                                  const bmiInfo = BMI_CATEGORY(bmi)
                                  const prev = arr[idx - 1]
                                  const heightDiff = prev && m.height_cm && prev.height_cm ? (m.height_cm - prev.height_cm).toFixed(1) : null
                                  const weightDiff = prev && m.weight_kg && prev.weight_kg ? (m.weight_kg - prev.weight_kg).toFixed(1) : null
                                  return (
                                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                                        {new Date(m.measurement_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </td>
                                      <td style={{ padding: '10px 12px', color: '#38bdf8', fontWeight: '600' }}>
                                        {m.height_cm}
                                        {heightDiff && <span style={{ color: heightDiff > 0 ? '#34d399' : '#f87171', fontSize: '11px', marginLeft: '4px' }}>
                                          {heightDiff > 0 ? '↑' : '↓'}{Math.abs(heightDiff)}
                                        </span>}
                                      </td>
                                      <td style={{ padding: '10px 12px', color: '#a78bfa', fontWeight: '600' }}>
                                        {m.weight_kg}
                                        {weightDiff && <span style={{ color: weightDiff > 0 ? '#34d399' : '#f87171', fontSize: '11px', marginLeft: '4px' }}>
                                          {weightDiff > 0 ? '↑' : '↓'}{Math.abs(weightDiff)}
                                        </span>}
                                      </td>
                                      <td style={{ padding: '10px 12px', color: '#f97316' }}>{m.head_circumference_cm || '—'}</td>
                                      <td style={{ padding: '10px 12px', color: bmiInfo.color, fontWeight: '600' }}>{bmi || '—'}</td>
                                      <td style={{ padding: '10px 12px' }}>
                                        <span style={{ padding: '3px 10px', background: `${bmiInfo.color}22`, borderRadius: '20px', color: bmiInfo.color, fontSize: '11px', fontWeight: '600' }}>
                                          {bmiInfo.label}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>📏</div>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Select a student</div>
                  <div style={{ fontSize: '13px' }}>Choose a student from the left to view growth measurements</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TERMS = ['Term 1', 'Term 2', 'Term 3']
const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
const RATINGS = [
  { value: 'emerging', label: '🌱 Emerging', short: '🌱', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  { value: 'developing', label: '🌿 Developing', short: '🌿', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' },
  { value: 'achieved', label: '🌟 Achieved', short: '🌟', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
]

export default function TeacherProgressPage() {
  const [profile, setProfile] = useState(null)
  const [teacherPrograms, setTeacherPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [selectedTerm, setSelectedTerm] = useState('Term 1')
  const [skills, setSkills] = useState([]) // skills with activities for selected program
  const [ratings, setRatings] = useState({}) // activity_id -> rating
  const [reportNotes, setReportNotes] = useState({ observations: '', strengths: '', areas_to_improve: '' })
  const [reportId, setReportId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)
  const [alreadySent, setAlreadySent] = useState(false)
  const router = useRouter()

  useEffect(() => { loadTeacher() }, [])
  useEffect(() => { if (selectedProgram) fetchSkills() }, [selectedProgram, academicYear])
  useEffect(() => { if (selectedStudent) fetchProgress() }, [selectedStudent, selectedTerm, academicYear])

  const loadTeacher = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    const { data: spData } = await supabase.from('staff_programs').select('program').eq('staff_id', user.id)
    const progs = spData?.map(p => p.program) || []
    setTeacherPrograms(progs)
    if (progs.length > 0) setSelectedProgram(progs[0])
    setLoading(false)
  }

  const fetchSkills = async () => {
    // Get skills assigned to this program for this academic year
    const { data: maps } = await supabase.from('skill_program_map').select('skill_id').eq('program', selectedProgram)
    const skillIds = maps?.map(m => m.skill_id) || []
    if (skillIds.length === 0) { setSkills([]); return }
      const { data: skillsData } = await supabase.from('skill_masters')
      .select('*, skill_activities(*)')
      .eq('academic_year', academicYear)
      .eq('school_id', profile.school_id)
      .in('id', skillIds)
      .order('order_index')
    setSkills(skillsData || [])

    // Fetch students for this program
    const { data: sData } = await supabase.from('students').select('*')
      .eq('status', 'active').eq('program', selectedProgram).eq('school_id', profile.school_id).order('full_name')
    setStudents(sData || [])
    setSelectedStudent(null)
    setRatings({})
    setReportNotes({ observations: '', strengths: '', areas_to_improve: '' })
  }

  const fetchProgress = async () => {
    if (!selectedStudent) return
    // Fetch ratings
    const { data: ratingsData } = await supabase.from('progress_ratings').select('*')
      .eq('student_id', selectedStudent.id)
      .eq('academic_year', academicYear)
      .eq('term', selectedTerm)
    const ratingsMap = {}
    ;(ratingsData || []).forEach(r => { ratingsMap[r.activity_id] = r.rating })
    setRatings(ratingsMap)

    // Fetch report notes
    const { data: report } = await supabase.from('progress_reports').select('*')
      .eq('student_id', selectedStudent.id)
      .eq('academic_year', academicYear)
      .eq('term', selectedTerm)
      .single()
    if (report) {
      setReportNotes({ observations: report.observations || '', strengths: report.strengths || '', areas_to_improve: report.areas_to_improve || '' })
      setReportId(report.id)
      setAlreadySent(report.sent_to_parent || false)
    } else {
      setReportNotes({ observations: '', strengths: '', areas_to_improve: '' })
      setReportId(null)
      setAlreadySent(false)
    }
  }

  const setRating = (activityId, rating) => {
    setRatings(prev => ({ ...prev, [activityId]: prev[activityId] === rating ? null : rating }))
  }

  const saveProgress = async () => {
    if (!selectedStudent) { alert('Please select a student'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Save ratings using upsert
    for (const [activityId, rating] of Object.entries(ratings)) {
      if (!rating) continue
      await supabase.from('progress_ratings').upsert({
        student_id: selectedStudent.id,
        activity_id: activityId,
        teacher_id: user.id,
        academic_year: academicYear,
        term: selectedTerm,
        rating,
        updated_at: new Date().toISOString()
      }, { onConflict: 'student_id,activity_id,academic_year,term' })
    }

    // Save report notes
    const reportData = {
      student_id: selectedStudent.id,
      teacher_id: user.id,
      academic_year: academicYear,
      term: selectedTerm,
      ...reportNotes,
      updated_at: new Date().toISOString()
    }
    if (reportId) {
      await supabase.from('progress_reports').update(reportData).eq('id', reportId)
    } else {
      const { data: newReport } = await supabase.from('progress_reports').insert({ ...reportData, sent_to_parent: false }).select().single()
      if (newReport) setReportId(newReport.id)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const sendToParent = async () => {
    if (!selectedStudent) return
    if (!confirm(`Send progress report for ${selectedStudent.full_name} (${selectedTerm}) to parents?`)) return
    setSending(true)
    await saveProgress()

    // Mark as sent
    if (reportId) {
      await supabase.from('progress_reports').update({ sent_to_parent: true, sent_at: new Date().toISOString() }).eq('id', reportId)
    }

    // Send notification via chat to parent
    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', selectedStudent.id)
    for (const { parent_id } of (ps || [])) {
      await supabase.from('chat_messages').insert({
        sender_id: profile?.id,
        receiver_id: parent_id,
        sender_name: profile?.full_name || 'Teacher',
        content: `📊 Progress Report for ${selectedStudent.full_name} — ${selectedTerm} (${academicYear}) is now available. Please check the Progress tab in your portal.`
      })
    }

    setAlreadySent(true)
    setSending(false)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  // Calculate completion stats
  const totalActivities = skills.reduce((s, skill) => s + (skill.skill_activities?.length || 0), 0)
  const ratedActivities = Object.values(ratings).filter(Boolean).length
  const achievedCount = Object.values(ratings).filter(r => r === 'achieved').length

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", resize: 'vertical' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; }
        .logo span { color: #38bdf8; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .activity-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; flex-wrap: wrap; }
        .activity-row:last-child { border-bottom: none; }
        .rating-btn { padding: 7px 14px; border-radius: 20px; border: 1px solid transparent; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .term-btn { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .term-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .term-btn:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        @media (max-width: 600px) { .content { padding: 16px; } }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>📊 Progress Tracker</span>
        </div>
        <button onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
      </div>

      <div className="content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>📊 Student Progress Entry</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Rate skills and send term reports to parents</p>
        </div>

        {/* Selectors */}
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Program */}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Program</label>
              <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)}
                style={{ ...inputStyle, resize: 'none', marginBottom: 0 }}>
                {teacherPrograms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {/* Student */}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Student</label>
              <select value={selectedStudent?.id || ''} onChange={e => setSelectedStudent(students.find(s => s.id === e.target.value) || null)}
                style={{ ...inputStyle, resize: 'none', marginBottom: 0 }}>
                <option value=''>-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            {/* Academic Year */}
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Academic Year</label>
              <input value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                style={{ ...inputStyle, resize: 'none', marginBottom: 0 }} />
            </div>
          </div>

          {/* Term Selector */}
          <div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Term</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TERMS.map(term => (
                <button key={term} className={`term-btn ${selectedTerm === term ? 'active' : ''}`} onClick={() => setSelectedTerm(term)}>{term}</button>
              ))}
            </div>
          </div>

          {/* Student Info + Progress Bar */}
          {selectedStudent && (
            <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{selectedStudent.full_name?.[0]}</div>
                <div>
                  <div style={{ fontWeight: '700' }}>{selectedStudent.full_name}</div>
                  <div style={{ color: '#a78bfa', fontSize: '13px' }}>{selectedProgram} · {selectedTerm}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '18px' }}>{ratedActivities}/{totalActivities}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Rated</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>{achievedCount}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Achieved</div>
                </div>
                {alreadySent && <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>✅ Sent to Parent</span>}
              </div>
            </div>
          )}
        </div>

        {selectedStudent && (
          <>
            {skills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                No skills assigned to {selectedProgram} for {academicYear}. Ask admin to assign skills.
              </div>
            ) : (
              <>
                {/* Rating Legend */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {RATINGS.map(r => (
                    <span key={r.value} style={{ padding: '4px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>{r.label}</span>
                  ))}
                </div>

                {/* Skills & Activities */}
                {skills.map(skill => (
                  <div key={skill.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ fontWeight: '700', fontSize: '16px' }}>{skill.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                        {(skill.skill_activities || []).filter(a => ratings[a.id]).length}/{skill.skill_activities?.length || 0} rated
                      </div>
                    </div>
                    {skill.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '12px' }}>{skill.description}</div>}
                    {(skill.skill_activities || []).sort((a, b) => a.order_index - b.order_index).map(act => {
                      const currentRating = ratings[act.id]
                      return (
                        <div key={act.id} className="activity-row">
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>{act.name}</div>
                            {act.description && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {RATINGS.map(r => (
                              <button key={r.value} className="rating-btn"
                                onClick={() => setRating(act.id, r.value)}
                                style={{
                                  background: currentRating === r.value ? r.bg : 'transparent',
                                  border: `1px solid ${currentRating === r.value ? r.border : 'rgba(255,255,255,0.1)'}`,
                                  color: currentRating === r.value ? r.color : 'rgba(255,255,255,0.3)'
                                }}>
                                {r.short}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Teacher Observations */}
                <div className="card">
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '16px' }}>📝 Teacher Observations</div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>General Observations</label>
                    <textarea rows={3} value={reportNotes.observations} onChange={e => setReportNotes({ ...reportNotes, observations: e.target.value })}
                      placeholder='Overall behavior and learning this term...' style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🌟 Strengths</label>
                    <textarea rows={2} value={reportNotes.strengths} onChange={e => setReportNotes({ ...reportNotes, strengths: e.target.value })}
                      placeholder='What is the child doing well?' style={inputStyle} />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🎯 Areas to Improve</label>
                    <textarea rows={2} value={reportNotes.areas_to_improve} onChange={e => setReportNotes({ ...reportNotes, areas_to_improve: e.target.value })}
                      placeholder='What needs more focus?' style={inputStyle} />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={saveProgress} disabled={saving}
                      style={{ flex: 1, padding: '12px', background: saved ? '#10b981' : 'rgba(255,255,255,0.06)', border: `1px solid ${saved ? '#10b981' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', color: saved ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Progress'}
                    </button>
                    <button onClick={sendToParent} disabled={sending || alreadySent}
                      style={{ flex: 1, padding: '12px', background: alreadySent ? 'rgba(16,185,129,0.1)' : sent ? '#10b981' : 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: alreadySent ? '1px solid rgba(16,185,129,0.3)' : 'none', borderRadius: '10px', color: alreadySent ? '#34d399' : '#fff', fontWeight: '700', fontSize: '14px', cursor: alreadySent ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      {sending ? '⏳ Sending...' : sent ? '✅ Sent!' : alreadySent ? '✅ Already Sent to Parent' : '📤 Send to Parent'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {!selectedStudent && !loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div>Select a program and student to start entering progress</div>
          </div>
        )}
      </div>
    </div>
  )
}
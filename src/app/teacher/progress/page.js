'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const MILESTONES = {
  'Social & Emotional': [
    'Shares and takes turns with peers',
    'Shows empathy towards others',
    'Manages emotions appropriately',
    'Participates in group activities',
    'Shows confidence and self-esteem',
    'Follows classroom rules',
  ],
  'Cognitive': [
    'Shows curiosity and asks questions',
    'Solves simple problems independently',
    'Recognizes numbers 1-10',
    'Recognizes letters of alphabet',
    'Understands cause and effect',
    'Demonstrates good memory',
  ],
  'Physical': [
    'Holds pencil/crayon correctly',
    'Cuts with scissors accurately',
    'Runs, jumps and climbs safely',
    'Maintains balance and coordination',
    'Completes art/craft activities',
    'Handles daily self-care tasks',
  ],
  'Language & Communication': [
    'Expresses thoughts clearly',
    'Listens and follows instructions',
    'Participates in conversations',
    'Knows and uses new vocabulary',
    'Tells simple stories or events',
    'Responds to questions appropriately',
  ],
}

const RATINGS = [
  { value: 'emerging', label: '🌱 Emerging', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  { value: 'developing', label: '🌿 Developing', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' },
  { value: 'achieved', label: '🌟 Achieved', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
]

export default function ProgressTracking() {
  const [profile, setProfile] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [milestones, setMilestones] = useState({})
  const [notes, setNotes] = useState({ observations: '', strengths: '', areas_to_improve: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeArea, setActiveArea] = useState(Object.keys(MILESTONES)[0])
  const router = useRouter()

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedStudent) fetchProgress() }, [selectedStudent, selectedMonth])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    const { data: spData } = await supabase.from('staff_programs').select('program').eq('staff_id', user.id)
    const teacherPrograms = spData?.map(p => p.program) || []
    const { data: sData } = await supabase.from('students').select('*')
      .eq('status', 'active')
      .in('program', teacherPrograms.length > 0 ? teacherPrograms : ['__none__'])
      .order('full_name')
    setStudents(sData || [])
    setLoading(false)
  }

  const fetchProgress = async () => {
    if (!selectedStudent) return
    const [mData, nData] = await Promise.all([
      supabase.from('progress_milestones').select('*')
        .eq('student_id', selectedStudent.id).eq('month', selectedMonth),
      supabase.from('progress_notes').select('*')
        .eq('student_id', selectedStudent.id).eq('month', selectedMonth).single()
    ])
    const milestonesMap = {}
    ;(mData.data || []).forEach(m => { milestonesMap[`${m.area}|||${m.milestone}`] = m.rating })
    setMilestones(milestonesMap)
    setNotes(nData.data ? {
      observations: nData.data.observations || '',
      strengths: nData.data.strengths || '',
      areas_to_improve: nData.data.areas_to_improve || ''
    } : { observations: '', strengths: '', areas_to_improve: '' })
  }

  const setRating = (area, milestone, rating) => {
    const key = `${area}|||${milestone}`
    setMilestones(prev => ({ ...prev, [key]: prev[key] === rating ? null : rating }))
  }

  const saveProgress = async () => {
    if (!selectedStudent) { alert('Please select a student'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Save milestones
    for (const [key, rating] of Object.entries(milestones)) {
      if (!rating) continue
      const [area, milestone] = key.split('|||')
      const existing = await supabase.from('progress_milestones').select('id')
        .eq('student_id', selectedStudent.id).eq('month', selectedMonth)
        .eq('area', area).eq('milestone', milestone).single()
      if (existing.data) {
        await supabase.from('progress_milestones').update({ rating, updated_at: new Date().toISOString() }).eq('id', existing.data.id)
      } else {
        await supabase.from('progress_milestones').insert({
          student_id: selectedStudent.id, teacher_id: user.id,
          month: selectedMonth, area, milestone, rating
        })
      }
    }

    // Save notes
    const existingNote = await supabase.from('progress_notes').select('id')
      .eq('student_id', selectedStudent.id).eq('month', selectedMonth).single()
    if (existingNote.data) {
      await supabase.from('progress_notes').update({ ...notes, updated_at: new Date().toISOString() }).eq('id', existingNote.data.id)
    } else {
      await supabase.from('progress_notes').insert({
        student_id: selectedStudent.id, teacher_id: user.id,
        month: selectedMonth, ...notes
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const getRating = (area, milestone) => milestones[`${area}|||${milestone}`] || null
  const getAreaProgress = (area) => {
    const total = MILESTONES[area].length
    const rated = MILESTONES[area].filter(m => milestones[`${area}|||${m}`]).length
    const achieved = MILESTONES[area].filter(m => milestones[`${area}|||${m}`] === 'achieved').length
    return { total, rated, achieved }
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", resize: 'vertical' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; }
        .logo span { color: #38bdf8; }
        .role-badge { background: rgba(16,185,129,0.15); color: #34d399; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
        .logout-btn { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .area-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
        .area-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .area-tab:not(.active) { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); }
        .milestone-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; flex-wrap: wrap; }
        .milestone-row:last-child { border-bottom: none; }
        .rating-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid transparent; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <div className="role-badge">📊 Progress Tracking</div>
        </div>
        <button className="logout-btn" onClick={() => router.back()}>← Back</button>
      </div>

      <div className="content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>📊 Student Progress Tracking</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Track developmental milestones and observations</p>
        </div>

        {/* Student & Month Selector */}
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Select Student *</label>
              <select value={selectedStudent?.id || ''} onChange={e => setSelectedStudent(students.find(s => s.id === e.target.value) || null)}
                style={{ ...inputStyle, resize: 'none' }}>
                <option value=''>-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.program})</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Month *</label>
              <input type='month' value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          {selectedStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px' }}>{selectedStudent.full_name?.[0]}</div>
              <div>
                <div style={{ fontWeight: '700' }}>{selectedStudent.full_name}</div>
                <div style={{ color: '#a78bfa', fontSize: '13px' }}>{selectedStudent.program}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                {Object.values(milestones).filter(Boolean).length} / {Object.values(MILESTONES).flat().length} milestones rated
              </div>
            </div>
          )}
        </div>

        {selectedStudent && (
          <>
            {/* Area Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {Object.keys(MILESTONES).map(area => {
                const prog = getAreaProgress(area)
                return (
                  <button key={area} className={`area-tab ${activeArea === area ? 'active' : ''}`} onClick={() => setActiveArea(area)}>
                    {area} ({prog.rated}/{prog.total})
                  </button>
                )
              })}
            </div>

            {/* Milestones */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '16px' }}>{activeArea}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {RATINGS.map(r => (
                    <span key={r.value} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: r.bg, color: r.color, border: `1px solid ${r.border}` }}>{r.label}</span>
                  ))}
                </div>
              </div>
              {MILESTONES[activeArea].map(milestone => {
                const currentRating = getRating(activeArea, milestone)
                return (
                  <div key={milestone} className="milestone-row">
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', flex: 1 }}>{milestone}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {RATINGS.map(r => (
                        <button key={r.value} className="rating-btn"
                          onClick={() => setRating(activeArea, milestone, r.value)}
                          style={{
                            background: currentRating === r.value ? r.bg : 'transparent',
                            border: `1px solid ${currentRating === r.value ? r.border : 'rgba(255,255,255,0.1)'}`,
                            color: currentRating === r.value ? r.color : 'rgba(255,255,255,0.3)'
                          }}>
                          {r.value === 'emerging' ? '🌱' : r.value === 'developing' ? '🌿' : '🌟'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Progress Summary */}
            <div className="card">
              <div style={{ fontWeight: '700', marginBottom: '16px' }}>📊 Progress Summary</div>
              {Object.keys(MILESTONES).map(area => {
                const prog = getAreaProgress(area)
                const pct = prog.total > 0 ? Math.round((prog.achieved / prog.total) * 100) : 0
                return (
                  <div key={area} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{area}</span>
                      <span style={{ fontSize: '13px', color: '#10b981' }}>{prog.achieved}/{prog.total} achieved</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '4px', width: `${pct}%`, background: pct >= 75 ? '#10b981' : pct >= 50 ? '#38bdf8' : '#f59e0b', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Teacher Notes */}
            <div className="card">
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '16px' }}>📝 Teacher Observations</div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>General Observations</label>
                <textarea rows={3} value={notes.observations} onChange={e => setNotes({ ...notes, observations: e.target.value })}
                  placeholder='Describe the child&apos;s overall behavior and learning this month...' style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>🌟 Strengths</label>
                <textarea rows={2} value={notes.strengths} onChange={e => setNotes({ ...notes, strengths: e.target.value })}
                  placeholder='What is the child doing well?' style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>🎯 Areas to Improve</label>
                <textarea rows={2} value={notes.areas_to_improve} onChange={e => setNotes({ ...notes, areas_to_improve: e.target.value })}
                  placeholder='What areas need more focus?' style={inputStyle} />
              </div>

              <button onClick={saveProgress} disabled={saving}
                style={{ width: '100%', padding: '12px', background: saved ? '#10b981' : 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {saving ? '⏳ Saving...' : saved ? '✅ Saved Successfully!' : '💾 Save Progress Report'}
              </button>
            </div>
          </>
        )}

        {!selectedStudent && !loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '16px' }}>Select a student to start tracking progress</div>
          </div>
        )}
      </div>
    </div>
  )
}
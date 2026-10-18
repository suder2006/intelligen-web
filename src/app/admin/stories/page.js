'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = {
  monday: '🌅 Monday',
  tuesday: '🌤️ Tuesday',
  wednesday: '🌞 Wednesday',
  thursday: '🌈 Thursday',
  friday: '🎉 Friday'
}
const DAY_NAMES = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' }
// Tab for older plans saved before stories were per program (program is NULL)
const ALL_TAB = '__all__'

const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function AdminStoriesPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [programs, setPrograms] = useState([])
  const [activeProgram, setActiveProgram] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [selectedDay, setSelectedDay] = useState('monday')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => { if (schoolId) fetchPlans() }, [schoolId])

  const fetchPlans = async () => {
    setLoading(true)
    const [{ data: planData }, { data: programData }] = await Promise.all([
      supabase
        .from('story_plans')
        .select('*')
        .eq('school_id', schoolId)
        .order('week_start_date', { ascending: false }),
      supabase
        .from('curriculum_masters')
        .select('value')
        .eq('type', 'program')
        .eq('school_id', schoolId)
        .order('value')
    ])
    const programList = [...new Set((programData || []).map(p => p.value).filter(Boolean))]
    setPlans(planData || [])
    setPrograms(programList)
    setActiveProgram(prev => prev || programList[0] || ALL_TAB)
    setLoading(false)
  }

  const hasLegacyPlans = plans.some(p => !p.program)
  const programPlans = plans.filter(p => activeProgram === ALL_TAB ? !p.program : p.program === activeProgram)
  const selectedPlan = programPlans.find(p => p.id === selectedPlanId) || programPlans[0] || null

  const selectProgram = (program) => {
    setActiveProgram(program)
    setSelectedPlanId(null)
    setEditing(false)
  }

  const startEditing = () => {
    if (!selectedPlan) return
    setEditForm({ [selectedDay]: { ...selectedPlan[selectedDay] } })
    setEditing(true)
  }

  // Saves only the day being edited
  const saveDay = async () => {
    if (!selectedPlan) return
    setSaving(true)
    const { error } = await supabase
      .from('story_plans')
      .update({ [selectedDay]: editForm[selectedDay], edited_by_admin: true })
      .eq('id', selectedPlan.id)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setEditing(false)
      await fetchPlans()
    }
    setSaving(false)
  }

  const regenerateDay = async () => {
    if (!selectedPlan) return
    if (!confirm(`Replace the ${DAY_NAMES[selectedDay]} story for ${selectedPlan.program} with a new AI story?`)) return
    setRegenerating(true)
    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ planId: selectedPlan.id, day: selectedDay })
      })
      const data = await response.json()
      if (!response.ok) {
        alert('Error: ' + data.error)
      } else {
        await fetchPlans()
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setRegenerating(false)
  }

  const generateNewPlan = async () => {
    if (!activeProgram || activeProgram === ALL_TAB) return
    if (!confirm(`Generate new ${activeProgram} stories for next week using AI?`)) return
    setGenerating(true)
    try {
      const today = new Date()
      const day = today.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      const weekStart = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`

      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ weekStart, program: activeProgram })
      })

      const data = await response.json()

      if (!response.ok) {
        alert('Error: ' + data.error)
      } else {
        alert(`✅ ${activeProgram} stories generated for week starting ${weekStart}!`)
        setSelectedPlanId(null)
        await fetchPlans()
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGenerating(false)
  }

  const canGenerate = activeProgram && activeProgram !== ALL_TAB
  const currentDayStory = editing ? editForm[selectedDay] : selectedPlan?.[selectedDay]

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: '8px',
    resize: 'vertical'
  }

  const labelStyle = {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    display: 'block',
    marginBottom: '4px'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #f97316, #fb923c); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📚 Story Plans</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Weekly stories for each program, matched to the children&apos;s age · Generated every Sunday
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button onClick={saveDay} disabled={saving} className="btn-primary">
                  {saving ? '⏳ Saving...' : '✅ Save Story'}
                </button>
              </>
            ) : canGenerate && (
              <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
                {generating ? '⏳ Generating...' : `🤖 Generate ${activeProgram} Stories`}
              </button>
            )}
          </div>
        </div>

        {/* Program tabs */}
        {!loading && (programs.length > 0 || hasLegacyPlans) && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[...programs, ...(hasLegacyPlans ? [ALL_TAB] : [])].map(program => {
              const active = activeProgram === program
              return (
                <button key={program} onClick={() => selectProgram(program)}
                  style={{
                    padding: '9px 18px', borderRadius: '10px', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600',
                    background: active ? 'linear-gradient(135deg, #f97316, #fb923c)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.1)'}`
                  }}>
                  {program === ALL_TAB ? 'All' : program}
                </button>
              )
            })}
          </div>
        )}
        {!loading && activeProgram === ALL_TAB && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px' }}>
            Older stories saved before stories were per program. Parents see these only when their child&apos;s program has no stories for that week.
          </p>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : programs.length === 0 && !hasLegacyPlans ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No programs set up</div>
            <div style={{ fontSize: '13px' }}>Add programs in Curriculum → Masters to generate stories for each program</div>
          </div>
        ) : programPlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No {activeProgram} story plans yet</div>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>Stories are auto-generated every Sunday at 6 AM IST</div>
            <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
              {generating ? '⏳ Generating...' : '🤖 Generate Stories Now'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>

            {/* Week selector */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px' }}>
                Available Plans
              </div>
              {programPlans.map(plan => (
                <div key={plan.id}
                  onClick={() => { setSelectedPlanId(plan.id); setEditing(false) }}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
                    background: selectedPlan?.id === plan.id ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedPlan?.id === plan.id ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div style={{ color: selectedPlan?.id === plan.id ? '#f97316' : '#fff', fontWeight: '600', fontSize: '13px' }}>
                    Week of {new Date(plan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                    {plan.generated_by_ai ? '🤖 AI Generated' : '✏️ Manual'}
                    {plan.edited_by_admin ? ' · Edited' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Story details */}
            {selectedPlan && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ color: '#f97316', fontWeight: '700', fontSize: '16px' }}>
                    Week of {new Date(selectedPlan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedPlan.generated_by_ai && (
                      <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.15)', borderRadius: '20px', color: '#f97316', fontSize: '12px' }}>🤖 AI Generated</span>
                    )}
                    {selectedPlan.edited_by_admin && (
                      <span style={{ padding: '3px 10px', background: 'rgba(56,189,248,0.15)', borderRadius: '20px', color: '#38bdf8', fontSize: '12px' }}>✏️ Edited</span>
                    )}
                  </div>
                </div>

                {/* Day tabs */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {DAYS.map(day => (
                    <button key={day} onClick={() => { setSelectedDay(day); setEditing(false) }}
                      style={{
                        padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '600',
                        background: selectedDay === day ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selectedDay === day ? '#f97316' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${selectedDay === day ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}`
                      }}>
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>

                {/* Per-day actions */}
                {!editing && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    {currentDayStory && (
                      <button onClick={startEditing} className="btn-secondary">✏️ Edit {DAY_NAMES[selectedDay]}&apos;s Story</button>
                    )}
                    {selectedPlan.program && (
                      <button onClick={regenerateDay} disabled={regenerating} className="btn-secondary">
                        {regenerating ? '⏳ Regenerating...' : `🔄 Regenerate ${DAY_NAMES[selectedDay]}'s Story`}
                      </button>
                    )}
                  </div>
                )}

                {/* Story content */}
                {currentDayStory ? (
                  <div>
                    {editing ? (
                      <div className="card">
                        <label style={labelStyle}>Story Title</label>
                        <input value={editForm[selectedDay]?.title || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], title: e.target.value } }))} style={inputStyle} />

                        <label style={labelStyle}>Category</label>
                        <input value={editForm[selectedDay]?.category || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], category: e.target.value } }))} style={inputStyle} />

                        <label style={labelStyle}>Emoji</label>
                        <input value={editForm[selectedDay]?.emoji || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], emoji: e.target.value } }))} style={{ ...inputStyle, width: '80px' }} />

                        <label style={labelStyle}>Story Text</label>
                        <textarea value={editForm[selectedDay]?.story || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], story: e.target.value } }))} rows={10} style={inputStyle} />

                        <label style={labelStyle}>Moral of the Story</label>
                        <input value={editForm[selectedDay]?.moral || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], moral: e.target.value } }))} style={inputStyle} />

                        <label style={labelStyle}>Questions (one per line)</label>
                        <textarea
                          value={(editForm[selectedDay]?.questions || []).join('\n')}
                          onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], questions: e.target.value.split('\n').filter(q => q.trim()) } }))}
                          rows={4} style={inputStyle} />

                        <label style={labelStyle}>Activity Title</label>
                        <input value={editForm[selectedDay]?.activity?.title || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], activity: { ...prev[selectedDay]?.activity, title: e.target.value } } }))} style={inputStyle} />

                        <label style={labelStyle}>Activity Description</label>
                        <textarea value={editForm[selectedDay]?.activity?.description || ''} onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], activity: { ...prev[selectedDay]?.activity, description: e.target.value } } }))} rows={3} style={inputStyle} />
                      </div>
                    ) : (
                      <>
                        {/* Story card */}
                        <div className="card" style={{ borderColor: 'rgba(249,115,22,0.2)' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <span style={{ fontSize: '44px' }}>{currentDayStory.emoji || '📖'}</span>
                            <div>
                              <div style={{ display: 'inline-block', padding: '3px 10px', background: 'rgba(249,115,22,0.15)', borderRadius: '20px', color: '#f97316', fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>
                                {currentDayStory.category}
                              </div>
                              <div style={{ color: '#fff', fontSize: '20px', fontWeight: '700' }}>{currentDayStory.title}</div>
                            </div>
                          </div>
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '16px' }} />
                          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '26px', whiteSpace: 'pre-wrap' }}>
                            {currentDayStory.story}
                          </div>
                          {currentDayStory.moral && (
                            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(249,115,22,0.08)', borderRadius: '10px', borderLeft: '3px solid #f97316' }}>
                              <div style={{ color: '#f97316', fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>💡 Moral</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontStyle: 'italic' }}>{currentDayStory.moral}</div>
                            </div>
                          )}
                        </div>

                        {/* Questions */}
                        {currentDayStory.questions && (
                          <div className="card" style={{ borderColor: 'rgba(56,189,248,0.15)' }}>
                            <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>❓ Questions for Child</div>
                            {currentDayStory.questions.map((q, idx) => (
                              <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: '700' }}>{idx + 1}</span>
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '22px' }}>{q}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Activity */}
                        {currentDayStory.activity && (
                          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
                            <div style={{ color: '#34d399', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>🎯 Activity</div>
                            <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{currentDayStory.activity.title}</div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '20px' }}>{currentDayStory.activity.description}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    No story for {DAY_LABELS[selectedDay]}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
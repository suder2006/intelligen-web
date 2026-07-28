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

export default function AdminStoriesPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedDay, setSelectedDay] = useState('monday')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { if (schoolId) fetchPlans() }, [schoolId])

  const fetchPlans = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('story_plans')
      .select('*')
      .eq('school_id', schoolId)
      .order('week_start_date', { ascending: false })
    setPlans(data || [])
    if (data && data.length > 0) {
      setSelectedPlan(data[0])
    }
    setLoading(false)
  }

  const startEditing = () => {
    if (!selectedPlan) return
    setEditForm({
      monday: { ...selectedPlan.monday },
      tuesday: { ...selectedPlan.tuesday },
      wednesday: { ...selectedPlan.wednesday },
      thursday: { ...selectedPlan.thursday },
      friday: { ...selectedPlan.friday }
    })
    setEditing(true)
  }

  const savePlan = async () => {
    if (!selectedPlan) return
    setSaving(true)
    const { error } = await supabase
      .from('story_plans')
      .update({
        monday: editForm.monday,
        tuesday: editForm.tuesday,
        wednesday: editForm.wednesday,
        thursday: editForm.thursday,
        friday: editForm.friday,
        edited_by_admin: true
      })
      .eq('id', selectedPlan.id)

    if (!error) {
      setSelectedPlan(prev => ({ ...prev, ...editForm, edited_by_admin: true }))
      setEditing(false)
      await fetchPlans()
    }
    setSaving(false)
  }

  const generateNewPlan = async () => {
    if (!confirm('Generate new stories for next week using AI?')) return
    setGenerating(true)
    try {
      const today = new Date()
      const day = today.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      const weekStart = nextMonday.toISOString().split('T')[0]

      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, weekStart })
      })

      const data = await response.json()

      if (!response.ok) {
        alert('Error: ' + data.error)
      } else {
        alert(`✅ Stories generated for week starting ${weekStart}!`)
        await fetchPlans()
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGenerating(false)
  }

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
              Weekly Indian stories for children aged 2-6 · Generated every Sunday
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button onClick={savePlan} disabled={saving} className="btn-primary">
                  {saving ? '⏳ Saving...' : '✅ Save Changes'}
                </button>
              </>
            ) : (
              <>
                {selectedPlan && (
                  <button onClick={startEditing} className="btn-secondary">✏️ Edit Stories</button>
                )}
                <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
                  {generating ? '⏳ Generating...' : '🤖 Generate New Stories'}
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No story plans yet</div>
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
              {plans.map(plan => (
                <div key={plan.id}
                  onClick={() => { setSelectedPlan(plan); setEditing(false) }}
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
                    <button key={day} onClick={() => setSelectedDay(day)}
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
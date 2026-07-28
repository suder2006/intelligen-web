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

const POSES = [
  { key: 'morning_pose', label: '🌅 Morning Pose', color: '#f59e0b' },
  { key: 'main_pose', label: '🧘 Main Pose', color: '#10b981' },
  { key: 'breathing', label: '🌬️ Breathing Exercise', color: '#38bdf8' },
  { key: 'relaxation', label: '🌙 Relaxation', color: '#a78bfa' },
]

export default function AdminYogaPage() {
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
      .from('yoga_plans')
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
      .from('yoga_plans')
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
    if (!confirm('Generate a new yoga plan for next week using AI?')) return
    setGenerating(true)
    try {
      const today = new Date()
      const day = today.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      const weekStart = nextMonday.toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('yoga_plans')
        .select('id')
        .eq('school_id', schoolId)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (existing) {
        alert(`Plan already exists for week starting ${weekStart}!`)
        setGenerating(false)
        return
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Generate a fun weekly kids yoga plan for preschool children aged 2-6 years for Monday to Friday.

Requirements:
- Simple, fun and playful poses
- Age appropriate for 2-6 year olds
- Animal and nature themed poses
- Include breathing exercises
- Each day has 4 activities
- Include YouTube search terms for each pose

Return ONLY valid JSON, no other text:
{
  "monday": {
    "morning_pose": {
      "name": "Cat-Cow Stretch",
      "emoji": "🐱",
      "instructions": ["Get on hands and knees", "Breathe in arch your back", "Breathe out round your back", "Repeat 5 times"],
      "duration": "2 minutes",
      "benefit": "Warms up the spine",
      "youtube_search": "cat cow stretch for kids yoga"
    },
    "main_pose": {
      "name": "Tree Pose",
      "emoji": "🌳",
      "instructions": ["Stand tall", "Place one foot on ankle", "Raise arms like branches", "Hold 10 seconds each side"],
      "duration": "3 minutes",
      "benefit": "Builds balance and focus",
      "youtube_search": "tree pose kids yoga"
    },
    "breathing": {
      "name": "Bunny Breathing",
      "emoji": "🐰",
      "instructions": ["Take 3 quick sniffs in", "One long breath out", "Repeat 5 times"],
      "duration": "2 minutes",
      "benefit": "Calms the mind",
      "youtube_search": "bunny breathing kids yoga"
    },
    "relaxation": {
      "name": "Sleeping Star",
      "emoji": "⭐",
      "instructions": ["Lie on your back", "Spread arms and legs wide", "Close your eyes", "Take 5 deep breaths"],
      "duration": "3 minutes",
      "benefit": "Relaxes the body",
      "youtube_search": "relaxation kids yoga savasana"
    },
    "theme": "Forest Adventure",
    "overall_benefit": "Energy and focus for the day"
  },
  "tuesday": { "same structure" },
  "wednesday": { "same structure" },
  "thursday": { "same structure" },
  "friday": { "same structure" }
}`
          }]
        })
      })

      const data = await response.json()
      const content = data.content[0].text
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const plan = JSON.parse(cleanContent)

      const { error: insertError } = await supabase
        .from('yoga_plans')
        .insert({
          school_id: schoolId,
          week_start_date: weekStart,
          monday: plan.monday,
          tuesday: plan.tuesday,
          wednesday: plan.wednesday,
          thursday: plan.thursday,
          friday: plan.friday,
          generated_by_ai: true,
          edited_by_admin: false
        })

      if (insertError) {
        alert('Error saving plan: ' + insertError.message)
      } else {
        alert(`✅ Yoga plan generated for week starting ${weekStart}!`)
        await fetchPlans()
      }
    } catch (e) {
      alert('Error generating plan: ' + e.message)
    }
    setGenerating(false)
  }

  const currentDayPlan = editing ? editForm[selectedDay] : selectedPlan?.[selectedDay]

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #7c3aed, #a78bfa); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🧘 Yoga Plans</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Weekly yoga routines for children aged 2-6 years · Generated every Sunday
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
                  <button onClick={startEditing} className="btn-secondary">✏️ Edit Plan</button>
                )}
                <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
                  {generating ? '⏳ Generating...' : '🤖 Generate New Plan'}
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧘</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No yoga plans yet</div>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>Plans are auto-generated every Sunday at 6 AM IST</div>
            <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
              {generating ? '⏳ Generating...' : '🤖 Generate Plan Now'}
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
                    background: selectedPlan?.id === plan.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedPlan?.id === plan.id ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div style={{ color: selectedPlan?.id === plan.id ? '#a78bfa' : '#fff', fontWeight: '600', fontSize: '13px' }}>
                    Week of {new Date(plan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                    {plan.generated_by_ai ? '🤖 AI Generated' : '✏️ Manual'}
                    {plan.edited_by_admin ? ' · Edited' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Plan details */}
            {selectedPlan && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ color: '#a78bfa', fontWeight: '700', fontSize: '16px' }}>
                    Week of {new Date(selectedPlan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedPlan.generated_by_ai && (
                      <span style={{ padding: '3px 10px', background: 'rgba(167,139,250,0.15)', borderRadius: '20px', color: '#a78bfa', fontSize: '12px' }}>🤖 AI Generated</span>
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
                        background: selectedDay === day ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selectedDay === day ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${selectedDay === day ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`
                      }}>
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>

                {/* Theme */}
                {currentDayPlan?.theme && (
                  <div className="card" style={{ borderColor: 'rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.04)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '24px' }}>🌟</span>
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Theme</div>
                        <div style={{ color: '#a78bfa', fontWeight: '700', fontSize: '16px' }}>{currentDayPlan.theme}</div>
                        {currentDayPlan.overall_benefit && (
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>✨ {currentDayPlan.overall_benefit}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pose cards */}
                {currentDayPlan && POSES.map(pose => {
                  const poseData = currentDayPlan[pose.key]
                  if (!poseData && !editing) return null
                  return (
                    <div key={pose.key} className="card" style={{ borderLeftWidth: '3px', borderLeftColor: pose.color, marginBottom: '12px' }}>
                      <div style={{ color: pose.color, fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>
                        {pose.label} {poseData?.emoji || ''}
                      </div>

                      {editing ? (
                        <div>
                          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Pose Name</label>
                          <input
                            value={editForm[selectedDay]?.[pose.key]?.name || ''}
                            onChange={e => setEditForm(prev => ({
                              ...prev,
                              [selectedDay]: {
                                ...prev[selectedDay],
                                [pose.key]: { ...prev[selectedDay]?.[pose.key], name: e.target.value }
                              }
                            }))}
                            style={inputStyle}
                          />
                          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Instructions (one per line)</label>
                          <textarea
                            value={(editForm[selectedDay]?.[pose.key]?.instructions || []).join('\n')}
                            onChange={e => setEditForm(prev => ({
                              ...prev,
                              [selectedDay]: {
                                ...prev[selectedDay],
                                [pose.key]: {
                                  ...prev[selectedDay]?.[pose.key],
                                  instructions: e.target.value.split('\n').filter(i => i.trim())
                                }
                              }
                            }))}
                            rows={4}
                            style={inputStyle}
                          />
                          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Benefit</label>
                          <input
                            value={editForm[selectedDay]?.[pose.key]?.benefit || ''}
                            onChange={e => setEditForm(prev => ({
                              ...prev,
                              [selectedDay]: {
                                ...prev[selectedDay],
                                [pose.key]: { ...prev[selectedDay]?.[pose.key], benefit: e.target.value }
                              }
                            }))}
                            style={inputStyle}
                          />
                          <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>YouTube Search Term</label>
                          <input
                            value={editForm[selectedDay]?.[pose.key]?.youtube_search || ''}
                            onChange={e => setEditForm(prev => ({
                              ...prev,
                              [selectedDay]: {
                                ...prev[selectedDay],
                                [pose.key]: { ...prev[selectedDay]?.[pose.key], youtube_search: e.target.value }
                              }
                            }))}
                            style={inputStyle}
                          />
                        </div>
                      ) : poseData ? (
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
                            {poseData.emoji} {poseData.name}
                            {poseData.duration && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '400', marginLeft: '8px' }}>⏱ {poseData.duration}</span>}
                          </div>
                          {poseData.instructions && (
                            <div style={{ marginBottom: '10px' }}>
                              {poseData.instructions.map((step, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'flex-start' }}>
                                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: `${pose.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ color: pose.color, fontSize: '11px', fontWeight: '700' }}>{idx + 1}</span>
                                  </div>
                                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '22px' }}>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {poseData.benefit && (
                            <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                              <span style={{ color: '#34d399', fontSize: '12px' }}>💪 {poseData.benefit}</span>
                            </div>
                          )}
                          {poseData.youtube_search && (
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(poseData.youtube_search)}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#f87171', fontSize: '12px', fontWeight: '600', textDecoration: 'none', border: '1px solid rgba(239,68,68,0.2)' }}>
                              ▶️ Watch on YouTube
                            </a>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = {
  monday: '🌅 Monday',
  tuesday: '🌤️ Tuesday',
  wednesday: '🌞 Wednesday',
  thursday: '🌈 Thursday',
  friday: '🎉 Friday',
  saturday: '🌟 Saturday',
  sunday: '☀️ Sunday'
}

export default function AdminTipsPage() {
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
      .from('daily_tips')
      .select('*')
      .eq('school_id', schoolId)
      .order('week_start_date', { ascending: false })
    setPlans(data || [])
    if (data && data.length > 0) setSelectedPlan(data[0])
    setLoading(false)
  }

  const startEditing = () => {
    if (!selectedPlan) return
    setEditForm({
      monday: { ...selectedPlan.monday },
      tuesday: { ...selectedPlan.tuesday },
      wednesday: { ...selectedPlan.wednesday },
      thursday: { ...selectedPlan.thursday },
      friday: { ...selectedPlan.friday },
      saturday: { ...selectedPlan.saturday },
      sunday: { ...selectedPlan.sunday }
    })
    setEditing(true)
  }

  const savePlan = async () => {
    if (!selectedPlan) return
    setSaving(true)
    const { error } = await supabase
      .from('daily_tips')
      .update({ ...editForm, edited_by_admin: true })
      .eq('id', selectedPlan.id)
    if (!error) {
      setSelectedPlan(prev => ({ ...prev, ...editForm, edited_by_admin: true }))
      setEditing(false)
      await fetchPlans()
    }
    setSaving(false)
  }

  const generateNewPlan = async () => {
    if (!confirm('Generate new tips for next week using AI?')) return
    setGenerating(true)
    try {
      const today = new Date()
      const day = today.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      const weekStart = nextMonday.toISOString().split('T')[0]

      const response = await fetch('/api/generate-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, weekStart })
      })

      const data = await response.json()
      if (!response.ok) {
        alert('Error: ' + data.error)
      } else {
        alert(`✅ Tips generated for week starting ${weekStart}!`)
        await fetchPlans()
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGenerating(false)
  }

  const currentDayTip = editing ? editForm[selectedDay] : selectedPlan?.[selectedDay]

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
        .btn-primary { background: linear-gradient(135deg, #f59e0b, #fbbf24); border: none; border-radius: 10px; padding: 10px 20px; color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>💡 Daily Tips</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Weekly parenting tips shown on parent home screen · Generated every Sunday
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
                  <button onClick={startEditing} className="btn-secondary">✏️ Edit Tips</button>
                )}
                <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
                  {generating ? '⏳ Generating...' : '🤖 Generate New Tips'}
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💡</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No tips yet</div>
            <div style={{ fontSize: '13px', marginBottom: '20px' }}>Tips are auto-generated every Sunday at 6 AM IST</div>
            <button onClick={generateNewPlan} disabled={generating} className="btn-primary">
              {generating ? '⏳ Generating...' : '🤖 Generate Tips Now'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>

            {/* Week selector */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px' }}>
                Available Weeks
              </div>
              {plans.map(plan => (
                <div key={plan.id}
                  onClick={() => { setSelectedPlan(plan); setEditing(false) }}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
                    background: selectedPlan?.id === plan.id ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedPlan?.id === plan.id ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div style={{ color: selectedPlan?.id === plan.id ? '#f59e0b' : '#fff', fontWeight: '600', fontSize: '13px' }}>
                    Week of {new Date(plan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px' }}>
                    {plan.generated_by_ai ? '🤖 AI Generated' : '✏️ Manual'}
                    {plan.edited_by_admin ? ' · Edited' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips details */}
            {selectedPlan && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ color: '#f59e0b', fontWeight: '700', fontSize: '16px' }}>
                    Week of {new Date(selectedPlan.week_start_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedPlan.generated_by_ai && (
                      <span style={{ padding: '3px 10px', background: 'rgba(245,158,11,0.15)', borderRadius: '20px', color: '#f59e0b', fontSize: '12px' }}>🤖 AI Generated</span>
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
                        padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '600',
                        background: selectedDay === day ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selectedDay === day ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${selectedDay === day ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`
                      }}>
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>

                {/* Tip content */}
                {currentDayTip ? (
                  <div className="card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                    {editing ? (
                      <div>
                        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Category</label>
                        <input
                          value={editForm[selectedDay]?.category || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], category: e.target.value } }))}
                          style={inputStyle}
                        />
                        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Emoji</label>
                        <input
                          value={editForm[selectedDay]?.emoji || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], emoji: e.target.value } }))}
                          style={{ ...inputStyle, width: '80px' }}
                        />
                        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Tip Text</label>
                        <textarea
                          value={editForm[selectedDay]?.tip || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], tip: e.target.value } }))}
                          rows={4}
                          style={inputStyle}
                        />
                        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Share Text</label>
                        <textarea
                          value={editForm[selectedDay]?.share_text || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, [selectedDay]: { ...prev[selectedDay], share_text: e.target.value } }))}
                          rows={4}
                          style={inputStyle}
                        />
                      </div>
                    ) : (
                      <div>
                        {/* Category badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                          <span style={{ fontSize: '32px' }}>{currentDayTip.emoji}</span>
                          <span style={{ padding: '4px 12px', background: 'rgba(245,158,11,0.15)', borderRadius: '20px', color: '#f59e0b', fontSize: '12px', fontWeight: '600' }}>
                            {currentDayTip.category}
                          </span>
                        </div>

                        {/* Tip text */}
                        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', lineHeight: '26px', marginBottom: '16px', padding: '14px', background: 'rgba(245,158,11,0.06)', borderRadius: '10px', borderLeft: '3px solid #f59e0b' }}>
                          {currentDayTip.tip}
                        </div>

                        {/* Share text preview */}
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                          📤 Share Text Preview:
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', whiteSpace: 'pre-line' }}>
                          {currentDayTip.share_text}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    No tip for {DAY_LABELS[selectedDay]}
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
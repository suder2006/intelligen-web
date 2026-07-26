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

const MEAL_LABELS = {
  breakfast: '🌅 Breakfast',
  morning_snack: '🍌 Morning Snack',
  lunch: '🍛 Lunch',
  evening_snack: '🍠 Evening Snack',
  dinner: '🌙 Dinner'
}

export default function AdminNutritionPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(null)
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
      .from('nutrition_plans')
      .select('*')
      .eq('school_id', schoolId)
      .order('week_start_date', { ascending: false })
    setPlans(data || [])
    if (data && data.length > 0) {
      setSelectedPlan(data[0])
      setSelectedWeek(data[0].week_start_date)
    }
    setLoading(false)
  }

  const selectPlan = (plan) => {
    setSelectedPlan(plan)
    setSelectedWeek(plan.week_start_date)
    setEditing(false)
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
      .from('nutrition_plans')
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
      setSelectedPlan(prev => ({
        ...prev,
        ...editForm,
        edited_by_admin: true
      }))
      setEditing(false)
      await fetchPlans()
    }
    setSaving(false)
  }

  const generateNewPlan = async () => {
    if (!confirm('Generate a new nutrition plan for next week using AI? This will use Claude API.')) return
    setGenerating(true)
    try {
      // Calculate next Monday
      const today = new Date()
      const day = today.getDay()
      const daysUntilMonday = day === 0 ? 1 : 8 - day
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + daysUntilMonday)
      const weekStart = nextMonday.toISOString().split('T')[0]

      // Check if already exists
      const { data: existing } = await supabase
        .from('nutrition_plans')
        .select('id')
        .eq('school_id', schoolId)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (existing) {
        alert(`Plan already exists for week starting ${weekStart}!`)
        setGenerating(false)
        return
      }

      // Call Claude API
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
            content: `Generate a healthy Indian nutrition meal plan for preschool children aged 2-6 years for a full week (Monday to Friday).

Requirements:
- South Indian / Tamil Nadu style meals preferred
- Age appropriate portions for 2-6 year olds
- Balanced nutrition each day
- Variety across the week (no repetition)
- Include breakfast, morning snack, lunch, evening snack, dinner
- Include key nutrients and child benefits

Return ONLY valid JSON, no other text:
{
  "monday": {
    "breakfast": "meal description",
    "morning_snack": "snack description",
    "lunch": "meal description",
    "evening_snack": "snack description",
    "dinner": "meal description",
    "nutrients": ["Protein: dal and curd", "Calcium: milk"],
    "benefits": ["💪 Protein supports muscle growth", "🦴 Calcium builds strong bones"]
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
        .from('nutrition_plans')
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
        alert(`✅ Nutrition plan generated for week starting ${weekStart}!`)
        await fetchPlans()
      }
    } catch (e) {
      alert('Error generating plan: ' + e.message)
    }
    setGenerating(false)
  }

  const currentDayPlan = editing
    ? editForm[selectedDay]
    : selectedPlan?.[selectedDay]

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
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🥗 Nutrition Plans</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Weekly meal plans for children aged 2-6 years · South Indian style
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥗</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No nutrition plans yet</div>
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
                  onClick={() => selectPlan(plan)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: selectedPlan?.id === plan.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedPlan?.id === plan.id ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div style={{ color: selectedPlan?.id === plan.id ? '#38bdf8' : '#fff', fontWeight: '600', fontSize: '13px' }}>
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
                {/* Week info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '16px' }}>
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
                    <button key={day}
                      onClick={() => setSelectedDay(day)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: '600',
                        background: selectedDay === day ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selectedDay === day ? '#38bdf8' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${selectedDay === day ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`
                      }}>
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>

                {/* Meals */}
                {currentDayPlan && (
                  <div>
                    {/* Meal cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {Object.entries(MEAL_LABELS).map(([meal, label]) => (
                        <div key={meal} className="card">
                          <div style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px', marginBottom: '8px' }}>
                            {label}
                          </div>
                          {editing ? (
                            <textarea
                              value={editForm[selectedDay]?.[meal] || ''}
                              onChange={e => setEditForm(prev => ({
                                ...prev,
                                [selectedDay]: { ...prev[selectedDay], [meal]: e.target.value }
                              }))}
                              rows={3}
                              style={inputStyle}
                            />
                          ) : (
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', lineHeight: '1.6' }}>
                              {currentDayPlan[meal]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Nutrients */}
                    <div className="card" style={{ marginBottom: '12px' }}>
                      <div style={{ color: '#34d399', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>
                        💊 Key Nutrients
                      </div>
                      {editing ? (
                        <textarea
                          value={(editForm[selectedDay]?.nutrients || []).join('\n')}
                          onChange={e => setEditForm(prev => ({
                            ...prev,
                            [selectedDay]: {
                              ...prev[selectedDay],
                              nutrients: e.target.value.split('\n').filter(n => n.trim())
                            }
                          }))}
                          rows={4}
                          placeholder="One nutrient per line e.g. Protein: Dal and curd"
                          style={inputStyle}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(currentDayPlan.nutrients || []).map((n, idx) => (
                            <span key={idx} style={{
                              padding: '4px 12px',
                              background: 'rgba(16,185,129,0.1)',
                              borderRadius: '20px',
                              color: '#34d399',
                              fontSize: '12px',
                              border: '1px solid rgba(16,185,129,0.2)'
                            }}>
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Benefits */}
                    <div className="card">
                      <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>
                        ✨ Benefits for Your Child
                      </div>
                      {editing ? (
                        <textarea
                          value={(editForm[selectedDay]?.benefits || []).join('\n')}
                          onChange={e => setEditForm(prev => ({
                            ...prev,
                            [selectedDay]: {
                              ...prev[selectedDay],
                              benefits: e.target.value.split('\n').filter(b => b.trim())
                            }
                          }))}
                          rows={4}
                          placeholder="One benefit per line e.g. 💪 Protein supports muscle growth"
                          style={inputStyle}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(currentDayPlan.benefits || []).map((b, idx) => (
                            <div key={idx} style={{
                              padding: '8px 12px',
                              background: 'rgba(56,189,248,0.06)',
                              borderRadius: '8px',
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: '13px',
                              borderLeft: '3px solid #38bdf8'
                            }}>
                              {b}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
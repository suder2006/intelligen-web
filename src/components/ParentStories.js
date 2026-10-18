'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri' }
const DAY_FULL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' }

const getWeekStart = (offset = 0) => {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

const fmt = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })

// The child's program plan wins; older plans saved without a program (program = NULL) are the fallback.
const findPlan = async (schoolId, program, weekStart) => {
  const query = (programFilter) => {
    let q = supabase.from('story_plans').select('*').eq('school_id', schoolId)
    q = programFilter ? q.eq('program', programFilter) : q.is('program', null)
    return weekStart
      ? q.eq('week_start_date', weekStart).limit(1).maybeSingle()
      : q.order('week_start_date', { ascending: false }).limit(1).maybeSingle()
  }
  if (program) {
    const { data } = await query(program)
    if (data) return data
  }
  const { data } = await query(null)
  return data
}

export default function ParentStories({ students, schoolId }) {
  const [selectedChildId, setSelectedChildId] = useState(students[0]?.id || null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayName = ['sunday', ...DAYS, 'saturday'][new Date().getDay()]
    return DAYS.includes(todayName) ? todayName : 'monday'
  })

  const child = students.find(s => s.id === selectedChildId) || students[0]
  const childSchoolId = child?.school_id || schoolId

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const found = !childSchoolId ? null : await findPlan(childSchoolId, child?.program, getWeekStart(weekOffset))
        // Fallback to most recent plan
        || await findPlan(childSchoolId, child?.program, null)
      if (!cancelled) {
        setPlan(found)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [childSchoolId, child?.program, weekOffset])

  const story = plan?.[selectedDay]
  const showChildPicker = new Set(students.map(s => s.program)).size > 1
  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset === 1 ? 'Next Week'
    : weekOffset < 0 ? `${Math.abs(weekOffset)} Weeks Ago` : `${weekOffset} Weeks Ahead`
  const showingOtherWeek = plan && plan.week_start_date !== getWeekStart(weekOffset)

  const pill = (active) => ({
    padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    fontFamily: "'DM Sans', sans-serif",
    background: active ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? '#f97316' : 'rgba(255,255,255,0.5)',
    border: `1px solid ${active ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}`
  })
  const navBtn = { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', cursor: 'pointer', fontWeight: '700' }

  return (
    <>
      <div className="section-title">📚 Story Time{child?.program ? ` · ${child.program}` : ''}</div>

      {showChildPicker && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {students.map(s => (
            <button key={s.id} onClick={() => setSelectedChildId(s.id)} style={pill(child?.id === s.id)}>
              {s.full_name?.split(' ')[0]}{s.program ? ` · ${s.program}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={navBtn}>◀</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>{weekLabel}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Week of {fmt(getWeekStart(weekOffset))}</div>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' }}>
              Back to Current Week
            </button>
          )}
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} style={navBtn}>▶</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading stories...</div>
      ) : !plan ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📖</div>
          {weekOffset === 0 ? 'This week\'s stories are not available yet. Check back soon!' : 'No stories found for this week.'}
        </div>
      ) : (
        <>
          {showingOtherWeek && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '12px' }}>
              Showing the latest stories (week of {fmt(plan.week_start_date)})
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => setSelectedDay(day)} style={pill(selectedDay === day)}>{DAY_LABELS[day]}</button>
            ))}
          </div>

          {!story ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No story for {DAY_FULL[selectedDay]}</div>
          ) : (
            <>
              <div className="card" style={{ borderColor: 'rgba(249,115,22,0.2)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <span style={{ fontSize: '40px' }}>{story.emoji || '📖'}</span>
                  <div>
                    {story.category && (
                      <div style={{ display: 'inline-block', padding: '3px 10px', background: 'rgba(249,115,22,0.15)', borderRadius: '20px', color: '#f97316', fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>
                        {story.category}
                      </div>
                    )}
                    <div style={{ fontSize: '19px', fontWeight: '700' }}>{story.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{DAY_FULL[selectedDay]}&apos;s story</div>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: '27px', whiteSpace: 'pre-wrap' }}>{story.story}</div>
                {story.moral && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(249,115,22,0.08)', borderRadius: '10px', borderLeft: '3px solid #f97316' }}>
                    <div style={{ color: '#f97316', fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>💡 Moral</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontStyle: 'italic' }}>{story.moral}</div>
                  </div>
                )}
              </div>

              {story.questions?.length > 0 && (
                <div className="card" style={{ borderColor: 'rgba(56,189,248,0.15)' }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '14px', marginBottom: '10px' }}>❓ Ask Your Child</div>
                  {story.questions.map((q, i) => (
                    <div key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '22px', marginBottom: '6px' }}>{i + 1}. {q}</div>
                  ))}
                </div>
              )}

              {story.activity && (
                <div className="card" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
                  <div style={{ color: '#34d399', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>🎯 Fun Activity</div>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{story.activity.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '20px' }}>{story.activity.description}</div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

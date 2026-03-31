'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function BirthdayCalendarPage() {
  const [students, setStudents] = useState([])
  const [school, setSchool] = useState(null)
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProgram, setFilterProgram] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(null)
  const [wishSent, setWishSent] = useState({})
  const [sendingWishes, setSendingWishes] = useState(null)
  const [birthdayTemplate, setBirthdayTemplate] = useState('')

  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [stuRes, schRes, progRes, notifRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name'),
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value'),
      supabase.from('birthday_notifications').select('student_id, notification_date').eq('school_id', schoolId)
    ])
    setStudents(stuRes.data || [])
    setSchool(schRes.data)
    setBirthdayTemplate(schRes.data?.birthday_message_template || '🎂 Happy Birthday, [Name]! 🎉 Wishing you a wonderful day filled with joy and laughter. With love from all of us at [School]! 🌟')
    setPrograms(progRes.data?.map(p => p.value) || [])
    const sentMap = {}
    const today = new Date().toISOString().split('T')[0]
    ;(notifRes.data || []).forEach(n => { if (n.notification_date === today) sentMap[n.student_id] = true })
    setWishSent(sentMap)
    setLoading(false)
  }

  const filteredStudents = filterProgram === 'all' ? students : students.filter(s => s.program === filterProgram)

  const getBirthdaysForDay = (day) => {
    const mm = String(selectedMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return filteredStudents.filter(s => s.date_of_birth && s.date_of_birth.slice(5) === `${mm}-${dd}`)
  }

  const getMonthBirthdays = () => {
    const mm = String(selectedMonth + 1).padStart(2, '0')
    return filteredStudents.filter(s => s.date_of_birth && s.date_of_birth.slice(5, 7) === mm)
      .sort((a, b) => parseInt(a.date_of_birth.slice(8)) - parseInt(b.date_of_birth.slice(8)))
  }

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay()
  const today = new Date()
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear

  const sendBirthdayWish = async (student) => {
    setSendingWishes(student.id)
    const { data: { user } } = await supabase.auth.getUser()
    const message = birthdayTemplate
      .replace(/\[Name\]/g, student.full_name)
      .replace(/\[School\]/g, school?.name || 'School')
    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', student.id)
    if (ps && ps.length > 0) {
      for (const { parent_id } of ps) {
        await supabase.from('chat_messages').insert({
          sender_id: schoolId, receiver_id: parent_id,
          sender_name: school?.name || 'School', content: message
        })
      }
    }
    await supabase.from('birthday_notifications').insert({
      school_id: schoolId, student_id: student.id,
      notification_date: new Date().toISOString().split('T')[0],
      sent_by: user.id, message, notification_type: 'birthday'
    })
    setWishSent(prev => ({ ...prev, [student.id]: true }))
    setSendingWishes(null)
  }

  const monthBdays = getMonthBirthdays()
  const selectedDayBdays = selectedDay ? getBirthdaysForDay(selectedDay) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .cal-cell { min-height: 90px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 6px; cursor: pointer; transition: all 0.15s; }
        .cal-cell:hover { background: rgba(255,255,255,0.05); border-color: rgba(56,189,248,0.2); }
        .cal-cell.today { border-color: #38bdf8; background: rgba(56,189,248,0.05); }
        .cal-cell.selected { border-color: #a78bfa; background: rgba(167,139,250,0.08); }
        .cal-cell.has-bday { background: rgba(245,158,11,0.04); }
        .day-num { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
        .day-num.today { color: #38bdf8; }
        .day-num.sunday { color: #f87171; }
        .bday-chip { padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(245,158,11,0.2); color: #fbbf24; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bday-chip.more { background: rgba(167,139,250,0.2); color: #a78bfa; }
        .month-nav { display: flex; align-items: center; gap: '12px'; }
        .nav-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 14px; color: #fff; cursor: pointer; font-size: 14px; font-family: 'DM Sans', sans-serif; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎂 Birthday Calendar</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Monthly view of student birthdays</p>
          </div>
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
            style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
            <option value='all'>All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Month Navigator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="nav-btn" onClick={() => {
              if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1) }
              else setSelectedMonth(m => m - 1)
              setSelectedDay(null)
            }}>← Prev</button>
            <div style={{ fontSize: '20px', fontWeight: '700', minWidth: '200px', textAlign: 'center' }}>
              {MONTHS[selectedMonth]} {selectedYear}
            </div>
            <button className="nav-btn" onClick={() => {
              if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1) }
              else setSelectedMonth(m => m + 1)
              setSelectedDay(null)
            }}>Next →</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
              🎂 {monthBdays.length} birthday{monthBdays.length !== 1 ? 's' : ''} this month
            </span>
            <button className="nav-btn" onClick={() => { setSelectedMonth(new Date().getMonth()); setSelectedYear(new Date().getFullYear()); setSelectedDay(null) }}
              style={{ fontSize: '13px', padding: '6px 12px' }}>Today</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 300px' : '1fr', gap: '20px' }}>
          {/* Calendar */}
          <div>
            {/* Day headers */}
            <div className="cal-grid" style={{ marginBottom: '6px' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: d === 'Sun' ? '#f87171' : 'rgba(255,255,255,0.4)', padding: '8px 0' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="cal-grid">
              {/* Empty cells */}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayBdays = getBirthdaysForDay(day)
                const isToday = isCurrentMonth && today.getDate() === day
                const isSunday = new Date(selectedYear, selectedMonth, day).getDay() === 0
                const isSelected = selectedDay === day
                return (
                  <div key={day}
                    className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayBdays.length > 0 ? 'has-bday' : ''}`}
                    onClick={() => setSelectedDay(isSelected ? null : day)}>
                    <div className={`day-num ${isToday ? 'today' : ''} ${isSunday ? 'sunday' : ''}`}>{day}</div>
                    {dayBdays.slice(0, 2).map(s => (
                      <div key={s.id} className="bday-chip" title={s.full_name}>
                        🎂 {s.full_name.split(' ')[0]}
                      </div>
                    ))}
                    {dayBdays.length > 2 && (
                      <div className="bday-chip more">+{dayBdays.length - 2} more</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Side Panel - selected day */}
          {selectedDay && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', height: 'fit-content' }}>
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px', color: '#a78bfa' }}>
                {MONTHS[selectedMonth]} {selectedDay}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px' }}>
                {selectedDayBdays.length > 0 ? `${selectedDayBdays.length} birthday${selectedDayBdays.length > 1 ? 's' : ''}` : 'No birthdays'}
              </div>
              {selectedDayBdays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
                  No birthdays on this day
                </div>
              ) : selectedDayBdays.map(s => (
                <div key={s.id} style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#000', flexShrink: 0 }}>
                      {s.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>{s.full_name}</div>
                      <div style={{ color: '#fbbf24', fontSize: '12px' }}>{s.program}</div>
                    </div>
                  </div>
                  {isCurrentMonth && today.getDate() === selectedDay && (
                    <button onClick={() => sendBirthdayWish(s)} disabled={sendingWishes === s.id || wishSent[s.id]}
                      style={{ width: '100%', padding: '8px', background: wishSent[s.id] ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.2)', border: `1px solid ${wishSent[s.id] ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '8px', color: wishSent[s.id] ? '#34d399' : '#fbbf24', cursor: wishSent[s.id] ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                      {sendingWishes === s.id ? '⏳ Sending...' : wishSent[s.id] ? '✅ Wish Sent!' : '🎉 Send Wish'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Month list below calendar */}
        {monthBdays.length > 0 && (
          <div style={{ marginTop: '28px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '16px', color: 'rgba(255,255,255,0.7)' }}>
              📋 {MONTHS[selectedMonth]} Birthday List ({monthBdays.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {monthBdays.map(s => {
                const day = parseInt(s.date_of_birth.slice(8))
                const isToday = isCurrentMonth && today.getDate() === day
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: isToday ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: `1px solid ${isToday ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isToday ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: isToday ? '#000' : '#fff', flexShrink: 0 }}>
                      {day}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: isToday ? '#fbbf24' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.full_name} {isToday ? '🎂' : ''}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{s.program}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        )}
      </div>
    </div>
  )
}
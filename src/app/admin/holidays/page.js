'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const SCHOOL_ID = '554c668d-1668-474b-a8aa-f529941dbcf6'
const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
const HOLIDAY_TYPES = ['National Holiday', 'School Holiday', 'Program-specific Holiday', 'Staff Holiday', 'Optional Holiday']
const APPLIES_TO = [
  { value: 'all', label: '👥 Everyone (Staff + Students)' },
  { value: 'staff_only', label: '👩‍🏫 Staff Only' },
  { value: 'students_only', label: '👶 Students Only' },
  { value: 'programs', label: '📚 Specific Programs' },
]
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/staff-groups', label: 'Staff Groups', icon: '⏰' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
  { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
  { href: '/admin/holidays', label: 'Holiday Calendar', icon: '📅' },
  { href: '/admin/staff-report', label: 'Staff Report', icon: '📋' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
]

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth())
  const [viewMode, setViewMode] = useState('calendar') // calendar | list
  const [showForm, setShowForm] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [form, setForm] = useState({
    name: '', holiday_type: 'School Holiday', from_date: '', to_date: '',
    description: '', applies_to: 'all', programs: [], is_optional: false,
    academic_year: CURRENT_AY
  })

  useEffect(() => { fetchAll() }, [academicYear])

  const fetchAll = async () => {
    setLoading(true)
    const [holRes, progRes] = await Promise.all([
      supabase.from('holidays').select('*').eq('academic_year', academicYear).order('from_date'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value')
    ])
    setHolidays(holRes.data || [])
    setPrograms(progRes?.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const saveHoliday = async () => {
    if (!form.name || !form.from_date) { alert('Please enter name and date'); return }
    if (!form.to_date) form.to_date = form.from_date
    setSaving(true)
    const data = { ...form, school_id: SCHOOL_ID, academic_year: academicYear, to_date: form.to_date || form.from_date }
    if (editingHoliday) {
      await supabase.from('holidays').update(data).eq('id', editingHoliday.id)
    } else {
      await supabase.from('holidays').insert(data)
    }
    setShowForm(false)
    setEditingHoliday(null)
    resetForm()
    await fetchAll()
    setSaving(false)
  }

  const deleteHoliday = async (id) => {
    if (!confirm('Delete this holiday?')) return
    await supabase.from('holidays').delete().eq('id', id)
    await fetchAll()
  }

  const resetForm = () => setForm({ name: '', holiday_type: 'School Holiday', from_date: '', to_date: '', description: '', applies_to: 'all', programs: [], is_optional: false, academic_year: CURRENT_AY })

  const toggleProgram = (prog) => {
    setForm(f => ({ ...f, programs: f.programs.includes(prog) ? f.programs.filter(p => p !== prog) : [...f.programs, prog] }))
  }

  // Calendar helpers
  const year = parseInt(academicYear.split('-')[0])
  const calYear = filterMonth >= 5 ? year : year + 1 // June onwards = first year, Jan-May = second year
  const daysInMonth = new Date(calYear, filterMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, filterMonth, 1).getDay()
  const monthHolidays = holidays.filter(h => {
    const from = new Date(h.from_date)
    const to = new Date(h.to_date)
    const monthStart = new Date(calYear, filterMonth, 1)
    const monthEnd = new Date(calYear, filterMonth + 1, 0)
    return from <= monthEnd && to >= monthStart
  })

  const getHolidaysForDate = (day) => {
    const date = new Date(calYear, filterMonth, day)
    return monthHolidays.filter(h => {
      const from = new Date(h.from_date)
      const to = new Date(h.to_date)
      return date >= from && date <= to
    })
  }

  const typeColor = {
    'National Holiday': { bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
    'School Holiday': { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
    'Program-specific Holiday': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
    'Staff Holiday': { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
    'Optional Holiday': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .month-btn { padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .month-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .month-btn:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-day { min-height: 80px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 6px; }
        .cal-day.today { border-color: #38bdf8; }
        .cal-day.has-holiday { background: rgba(56,189,248,0.04); }
        .cal-day-num { font-size: 13px; font-weight: '600'; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
        .cal-day-num.sunday { color: #f87171; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .main { margin-left: 0 !important; padding: 20px !important; }
        }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/holidays' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📅 Holiday Calendar</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage school holidays for staff and students</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.print()} className="btn-secondary print-hide">🖨️ Print</button>
            <button onClick={() => { resetForm(); setEditingHoliday(null); setShowForm(true) }} className="btn-primary">+ Add Holiday</button>
          </div>
        </div>

        {/* Academic Year + View Toggle */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
            style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
            {[CURRENT_AY, `${new Date().getFullYear()-1}-${new Date().getFullYear()}`].map(ay => <option key={ay} value={ay}>{ay}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px' }}>
            {[['calendar', '📅 Calendar'], ['list', '📋 List']].map(([v, l]) => (
              <button key={v} className={`view-tab ${viewMode === v ? 'active' : ''}`} onClick={() => setViewMode(v)}>{l}</button>
            ))}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{holidays.length} holidays this year</span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }} className="print-hide">
          {Object.entries(typeColor).map(([type, style]) => (
            <span key={type} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{type}</span>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* CALENDAR VIEW */}
            {viewMode === 'calendar' && (
              <>
                {/* Month selector */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }} className="print-hide">
                  {MONTHS.map((m, i) => (
                    <button key={i} className={`month-btn ${filterMonth === i ? 'active' : ''}`} onClick={() => setFilterMonth(i)}>
                      {m.slice(0, 3)}
                      {holidays.filter(h => {
                        const from = new Date(h.from_date)
                        const to = new Date(h.to_date)
                        const mStart = new Date(calYear, i, 1)
                        const mEnd = new Date(calYear, i + 1, 0)
                        return from <= mEnd && to >= mStart
                      }).length > 0 && <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#38bdf8', borderRadius: '50%', marginLeft: '4px', verticalAlign: 'middle' }} />}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: '16px', fontWeight: '700', fontSize: '18px' }}>{MONTHS[filterMonth]} {calYear}</div>

                {/* Calendar Grid */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  {/* Day headers */}
                  <div className="cal-grid" style={{ marginBottom: '8px' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: d === 'Sun' ? '#f87171' : 'rgba(255,255,255,0.4)', padding: '6px' }}>{d}</div>
                    ))}
                  </div>
                  {/* Calendar days */}
                  <div className="cal-grid">
                    {/* Empty cells before first day */}
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dayHolidays = getHolidaysForDate(day)
                      const isToday = new Date().toDateString() === new Date(calYear, filterMonth, day).toDateString()
                      const isSunday = new Date(calYear, filterMonth, day).getDay() === 0
                      return (
                        <div key={day} className={`cal-day ${isToday ? 'today' : ''} ${dayHolidays.length > 0 ? 'has-holiday' : ''}`}>
                          <div className={`cal-day-num ${isSunday ? 'sunday' : ''}`} style={{ fontWeight: isToday ? '700' : '500', color: isToday ? '#38bdf8' : isSunday ? '#f87171' : 'rgba(255,255,255,0.6)' }}>{day}</div>
                          {dayHolidays.slice(0, 2).map(h => (
                            <div key={h.id} style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px', marginBottom: '2px', background: typeColor[h.holiday_type]?.bg || 'rgba(56,189,248,0.15)', color: typeColor[h.holiday_type]?.color || '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {h.name}
                            </div>
                          ))}
                          {dayHolidays.length > 2 && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>+{dayHolidays.length - 2}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* This month's holidays list */}
                {monthHolidays.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>Holidays in {MONTHS[filterMonth]}:</h3>
                    {monthHolidays.map(h => (
                      <div key={h.id} className="card" style={{ borderColor: typeColor[h.holiday_type]?.border || 'rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>{h.name}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: typeColor[h.holiday_type]?.bg, color: typeColor[h.holiday_type]?.color }}>{h.holiday_type}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>📅 {h.from_date}{h.to_date !== h.from_date ? ` → ${h.to_date}` : ''}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{APPLIES_TO.find(a => a.value === h.applies_to)?.label}</span>
                            {h.is_optional && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Optional</span>}
                          </div>
                          {h.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{h.description}</div>}
                          {h.applies_to === 'programs' && h.programs?.length > 0 && (
                            <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {h.programs.map(p => <span key={p} style={{ padding: '2px 6px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{p}</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }} className="print-hide">
                          <button onClick={() => { setEditingHoliday(h); setForm({ name: h.name, holiday_type: h.holiday_type, from_date: h.from_date, to_date: h.to_date, description: h.description || '', applies_to: h.applies_to, programs: h.programs || [], is_optional: h.is_optional, academic_year: h.academic_year }); setShowForm(true) }}
                            style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => deleteHoliday(h.id)}
                            style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {monthHolidays.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No holidays in {MONTHS[filterMonth]}.</div>
                )}
              </>
            )}

            {/* LIST VIEW */}
            {viewMode === 'list' && (
              <>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>All Holidays — {academicYear}</h3>
                {holidays.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No holidays added yet.</div>
                ) : (
                  // Group by month
                  MONTHS.map((month, i) => {
                    const monthYear = i >= 5 ? parseInt(academicYear.split('-')[0]) : parseInt(academicYear.split('-')[1])
                    const monthStr = `${monthYear}-${String(i + 1).padStart(2, '0')}`
                    const monthHols = holidays.filter(h => h.from_date.startsWith(monthStr) || h.to_date.startsWith(monthStr))
                    if (monthHols.length === 0) return null
                    return (
                      <div key={i} style={{ marginBottom: '20px' }}>
                        <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '10px', fontSize: '15px' }}>📅 {month} {monthYear}</div>
                        {monthHols.map(h => (
                          <div key={h.id} className="card" style={{ borderColor: typeColor[h.holiday_type]?.border || 'rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <div style={{ fontWeight: '700', marginBottom: '6px' }}>{h.name}</div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: typeColor[h.holiday_type]?.bg, color: typeColor[h.holiday_type]?.color }}>{h.holiday_type}</span>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📅 {h.from_date}{h.to_date !== h.from_date ? ` → ${h.to_date}` : ''}</span>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{APPLIES_TO.find(a => a.value === h.applies_to)?.label}</span>
                                {h.is_optional && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Optional</span>}
                              </div>
                              {h.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{h.description}</div>}
                              {h.applies_to === 'programs' && h.programs?.length > 0 && (
                                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {h.programs.map(p => <span key={p} style={{ padding: '2px 6px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{p}</span>)}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }} className="print-hide">
                              <button onClick={() => { setEditingHoliday(h); setForm({ name: h.name, holiday_type: h.holiday_type, from_date: h.from_date, to_date: h.to_date, description: h.description || '', applies_to: h.applies_to, programs: h.programs || [], is_optional: h.is_optional, academic_year: h.academic_year }); setShowForm(true) }}
                                style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                              <button onClick={() => deleteHoliday(h.id)}
                                style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Holiday Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingHoliday ? '✏️ Edit Holiday' : '📅 Add Holiday'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Holiday Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. Diwali, Christmas, Sports Day...' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Holiday Type *</label>
            <select value={form.holiday_type} onChange={e => setForm({ ...form, holiday_type: e.target.value })} style={inputStyle}>
              {HOLIDAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>From Date *</label>
                <input type='date' value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value, to_date: form.to_date || e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>To Date (leave same for single day)</label>
                <input type='date' value={form.to_date || form.from_date} onChange={e => setForm({ ...form, to_date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Applies To *</label>
            <select value={form.applies_to} onChange={e => setForm({ ...form, applies_to: e.target.value })} style={inputStyle}>
              {APPLIES_TO.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            {form.applies_to === 'programs' && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Select Programs *</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {programs.map(p => (
                    <button key={p} onClick={() => toggleProgram(p)} type='button'
                      style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${form.programs.includes(p) ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`, background: form.programs.includes(p) ? 'rgba(167,139,250,0.2)' : 'transparent', color: form.programs.includes(p) ? '#a78bfa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}>
                      {form.programs.includes(p) ? '✓ ' : ''}{p}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder='Additional notes...' style={inputStyle} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <input type='checkbox' id='optional' checked={form.is_optional} onChange={e => setForm({ ...form, is_optional: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor='optional' style={{ color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>Optional holiday (staff can choose to take)</label>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditingHoliday(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveHoliday} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingHoliday ? 'Update' : 'Add Holiday'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
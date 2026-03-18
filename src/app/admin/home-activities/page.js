'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const SCHOOL_ID = '554c668d-1668-474b-a8aa-f529941dbcf6'
const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
const MONTHS = ['June','July','August','September','October','November','December','January','February','March','April','May']

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
  { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
  { href: '/admin/holidays', label: 'Holidays', icon: '📅' },
  { href: '/admin/home-activities', label: 'Home Activities', icon: '🏠' },
  { href: '/admin/payroll', label: 'Payroll', icon: '💰' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
]

export default function HomeActivitiesPage() {
  const [activities, setActivities] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [filterMonth, setFilterMonth] = useState(MONTHS[new Date().getMonth() >= 5 ? new Date().getMonth() - 5 : new Date().getMonth() + 7])
  const [filterProgram, setFilterProgram] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [expandedActivity, setExpandedActivity] = useState(null)
  const [form, setForm] = useState({
    title: '', goal: '', skills_built: '', you_need: '',
    do_this: '', video_link: '', month: filterMonth,
    programs: [], academic_year: CURRENT_AY
  })

  useEffect(() => { fetchAll() }, [academicYear])

  const fetchAll = async () => {
    setLoading(true)
    const [actRes, progRes] = await Promise.all([
      supabase.from('home_activities').select('*').eq('academic_year', academicYear).order('month').order('order_index'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value')
    ])
    setActivities(actRes.data || [])
    setPrograms(progRes?.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const saveActivity = async () => {
    if (!form.title.trim()) { alert('Please enter activity title'); return }
    if (form.programs.length === 0) { alert('Please select at least one program'); return }
    if (!form.do_this.trim()) { alert('Please enter activity steps'); return }
    setSaving(true)
    // Save one activity per program
    if (editingActivity) {
      await supabase.from('home_activities').update({
        title: form.title, goal: form.goal, skills_built: form.skills_built,
        you_need: form.you_need, do_this: form.do_this, video_link: form.video_link,
        month: form.month, academic_year: academicYear
      }).eq('id', editingActivity.id)
    } else {
      for (const prog of form.programs) {
        const count = activities.filter(a => a.program === prog && a.month === form.month).length
        await supabase.from('home_activities').insert({
          title: form.title, goal: form.goal, skills_built: form.skills_built,
          you_need: form.you_need, do_this: form.do_this, video_link: form.video_link,
          month: form.month, program: prog, academic_year: academicYear,
          order_index: count, school_id: SCHOOL_ID
        })
      }
    }
    setShowForm(false)
    setEditingActivity(null)
    resetForm()
    await fetchAll()
    setSaving(false)
  }

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return
    await supabase.from('home_activities').delete().eq('id', id)
    await fetchAll()
  }

  const resetForm = () => setForm({ title: '', goal: '', skills_built: '', you_need: '', do_this: '', video_link: '', month: filterMonth, programs: [], academic_year: CURRENT_AY })

  const toggleProgram = (prog) => setForm(f => ({ ...f, programs: f.programs.includes(prog) ? f.programs.filter(p => p !== prog) : [...f.programs, prog] }))

  const filteredActivities = activities.filter(a => {
    const matchMonth = a.month === filterMonth
    const matchProgram = filterProgram === 'all' || a.program === filterProgram
    return matchMonth && matchProgram
  })

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }
  const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: '80px' }

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
        .month-btn { padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .month-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .month-btn:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/home-activities' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🏠 Home Activities</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Monthly activities for parents to do with children at home</p>
          </div>
          <button onClick={() => { resetForm(); setForm(f => ({ ...f, month: filterMonth })); setEditingActivity(null); setShowForm(true) }} className="btn-primary">+ Add Activity</button>
        </div>

        {/* Academic Year + Program Filter */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
            style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
            {[CURRENT_AY, `${new Date().getFullYear()-1}-${new Date().getFullYear()}`].map(ay => <option key={ay} value={ay}>{ay}</option>)}
          </select>
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
            style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
            <option value='all'>All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{filteredActivities.length} activities this month</span>
        </div>

        {/* Month Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {MONTHS.map(m => (
            <button key={m} className={`month-btn ${filterMonth === m ? 'active' : ''}`} onClick={() => setFilterMonth(m)}>
              {m.slice(0, 3)}
              {activities.filter(a => a.month === m && (filterProgram === 'all' || a.program === filterProgram)).length > 0 &&
                <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#38bdf8', borderRadius: '50%', marginLeft: '4px', verticalAlign: 'middle' }} />}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {filteredActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏠</div>
                <div>No activities for {filterMonth} yet.</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>Click "+ Add Activity" to create one.</div>
              </div>
            ) : filteredActivities.map(activity => (
              <div key={activity.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{activity.program}</span>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>{activity.month}</span>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{activity.title}</div>
                    {activity.goal && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>🎯 {activity.goal}</div>}
                    {activity.skills_built && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>⚡ Skills: {activity.skills_built}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setEditingActivity(activity); setForm({ title: activity.title, goal: activity.goal || '', skills_built: activity.skills_built || '', you_need: activity.you_need || '', do_this: activity.do_this || '', video_link: activity.video_link || '', month: activity.month, programs: [activity.program], academic_year: activity.academic_year }); setShowForm(true) }}
                      style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteActivity(activity.id) }}
                      style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    <span style={{ color: 'rgba(255,255,255,0.3)', padding: '5px', fontSize: '12px' }}>{expandedActivity === activity.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandedActivity === activity.id && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    {activity.you_need && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ color: '#38bdf8', fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>🧰 You Need:</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>{activity.you_need}</div>
                      </div>
                    )}
                    {activity.do_this && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ color: '#10b981', fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>✅ Do This:</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{activity.do_this}</div>
                      </div>
                    )}
                    {activity.video_link && (
                      <a href={activity.video_link} target='_blank' rel='noreferrer'
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                        ▶️ Watch Video
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Activity Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingActivity ? '✏️ Edit Activity' : '🏠 Add Home Activity'}</h3>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Month *</label>
            <select value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} style={inputStyle}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {!editingActivity && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Programs * (select one or more)</label>
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

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Activity Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder='e.g. Colour Mixing Fun' style={inputStyle} autoFocus />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🎯 Goal</label>
            <input value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder='e.g. Develop colour recognition and creativity' style={inputStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>⚡ Skills Built</label>
            <input value={form.skills_built} onChange={e => setForm({ ...form, skills_built: e.target.value })} placeholder='e.g. Fine Motor, Creativity, Sensory' style={inputStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>🧰 You Need (materials)</label>
            <textarea value={form.you_need} onChange={e => setForm({ ...form, you_need: e.target.value })} placeholder='e.g. Red, blue and yellow paint&#10;White paper&#10;Paintbrush or fingers' style={textareaStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>✅ Do This (steps for parents) *</label>
            <textarea value={form.do_this} onChange={e => setForm({ ...form, do_this: e.target.value })} rows={6} placeholder='Step 1: Put a blob of red paint on the paper&#10;Step 2: Add yellow next to it&#10;Step 3: Ask your child to mix them with their finger&#10;Step 4: See what colour appears!' style={textareaStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>▶️ Video Link (optional)</label>
            <input value={form.video_link} onChange={e => setForm({ ...form, video_link: e.target.value })} placeholder='https://youtube.com/...' style={inputStyle} />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowForm(false); setEditingActivity(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveActivity} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingActivity ? 'Update' : 'Add Activity'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/classes', label: 'Classes', icon: '📚' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills & Progress', icon: '🎯' },
]

const TERMS = ['Term 1', 'Term 2', 'Term 3']
const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

export default function AdminSkillsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [academicYears, setAcademicYears] = useState([CURRENT_AY])
  const [skills, setSkills] = useState([])
  const [programs, setPrograms] = useState([])
  const [expandedSkill, setExpandedSkill] = useState(null)
  const [view, setView] = useState('skills') // skills | assign

  // Skill form
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [skillForm, setSkillForm] = useState({ name: '', description: '' })
  const [editingSkill, setEditingSkill] = useState(null)

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(null) // skill_id
  const [activityForm, setActivityForm] = useState({ name: '', description: '' })
  const [editingActivity, setEditingActivity] = useState(null)

  // Program assignments
  const [skillPrograms, setSkillPrograms] = useState({}) // skill_id -> [programs]

  useEffect(() => { fetchAll() }, [academicYear])

  const fetchAll = async () => {
    setLoading(true)
    const [skillsData, progsData, mapsData] = await Promise.all([
      supabase.from('skill_masters').select('*, skill_activities(*)')
        .eq('academic_year', academicYear)
        .order('order_index').order('created_at'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value'),
      supabase.from('skill_program_map').select('*')
    ])
    // Get all academic years
    const { data: ayData } = await supabase.from('skill_masters').select('academic_year')
    const years = [...new Set([CURRENT_AY, ...(ayData?.map(s => s.academic_year) || [])])]
    setAcademicYears(years.sort().reverse())
    setSkills(skillsData.data || [])
    setPrograms(progsData?.data?.map(p => p.value) || [])
    // Build skill->programs map
    const map = {}
    ;(mapsData.data || []).forEach(m => {
      if (!map[m.skill_id]) map[m.skill_id] = []
      map[m.skill_id].push(m.program)
    })
    setSkillPrograms(map)
    setLoading(false)
  }

  const saveSkill = async () => {
    if (!skillForm.name.trim()) { alert('Please enter skill name'); return }
    setSaving(true)
    if (editingSkill) {
      await supabase.from('skill_masters').update({ name: skillForm.name, description: skillForm.description }).eq('id', editingSkill.id)
    } else {
      await supabase.from('skill_masters').insert({ name: skillForm.name, description: skillForm.description, academic_year: academicYear, order_index: skills.length })
    }
    setSkillForm({ name: '', description: '' })
    setShowSkillForm(false)
    setEditingSkill(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteSkill = async (id) => {
    if (!confirm('Delete this skill and all its activities?')) return
    await supabase.from('skill_program_map').delete().eq('skill_id', id)
    await supabase.from('skill_masters').delete().eq('id', id)
    await fetchAll()
  }

  const saveActivity = async (skillId) => {
    if (!activityForm.name.trim()) { alert('Please enter activity name'); return }
    setSaving(true)
    if (editingActivity) {
      await supabase.from('skill_activities').update({ name: activityForm.name, description: activityForm.description }).eq('id', editingActivity.id)
    } else {
      const skill = skills.find(s => s.id === skillId)
      const actCount = skill?.skill_activities?.length || 0
      await supabase.from('skill_activities').insert({ skill_id: skillId, name: activityForm.name, description: activityForm.description, order_index: actCount })
    }
    setActivityForm({ name: '', description: '' })
    setShowActivityForm(null)
    setEditingActivity(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return
    await supabase.from('skill_activities').delete().eq('id', id)
    await fetchAll()
  }

  const toggleProgram = async (skillId, program) => {
    const currentPrograms = skillPrograms[skillId] || []
    const isAssigned = currentPrograms.includes(program)
    if (isAssigned) {
      await supabase.from('skill_program_map').delete().eq('skill_id', skillId).eq('program', program)
    } else {
      await supabase.from('skill_program_map').insert({ skill_id: skillId, program })
    }
    await fetchAll()
  }

  const copyFromPrevYear = async () => {
    const sorted = [...academicYears].sort()
    const idx = sorted.indexOf(academicYear)
    if (idx <= 0) { alert('No previous year to copy from'); return }
    const prevYear = sorted[idx - 1]
    const { data: prevSkills } = await supabase.from('skill_masters').select('*, skill_activities(*)')
      .eq('academic_year', prevYear)
    if (!prevSkills?.length) { alert(`No skills found for ${prevYear}`); return }
    if (!confirm(`Copy all skills & activities from ${prevYear} to ${academicYear}?`)) return
    setSaving(true)
    for (const skill of prevSkills) {
      const { data: newSkill } = await supabase.from('skill_masters').insert({
        name: skill.name, description: skill.description,
        academic_year: academicYear, order_index: skill.order_index
      }).select().single()
      if (newSkill) {
        for (const act of (skill.skill_activities || [])) {
          await supabase.from('skill_activities').insert({
            skill_id: newSkill.id, name: act.name,
            description: act.description, order_index: act.order_index
          })
        }
        // Copy program assignments
        const { data: maps } = await supabase.from('skill_program_map').select('program').eq('skill_id', skill.id)
        for (const map of (maps || [])) {
          await supabase.from('skill_program_map').insert({ skill_id: newSkill.id, program: map.program })
        }
      }
    }
    await fetchAll()
    setSaving(false)
    alert('Copied successfully!')
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }

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
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .skill-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .activity-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; }
        .activity-row:last-child { border-bottom: none; }
        .prog-chip { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; }
        .view-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/skills' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎯 Skills & Progress Setup</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage skills, activities and program assignments</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={copyFromPrevYear} className="btn-secondary" disabled={saving}>📋 Copy from Prev Year</button>
            <button onClick={() => { setEditingSkill(null); setSkillForm({ name: '', description: '' }); setShowSkillForm(true) }} className="btn-primary">+ Add Skill</button>
          </div>
        </div>

        {/* Academic Year Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Academic Year:</span>
          {academicYears.map(ay => (
            <button key={ay} onClick={() => setAcademicYear(ay)}
              style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${academicYear === ay ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: academicYear === ay ? 'rgba(56,189,248,0.15)' : 'transparent', color: academicYear === ay ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {ay}
            </button>
          ))}
          <button onClick={() => {
            const y = prompt('Enter academic year (e.g. 2026-2027)')
            if (y) { setAcademicYears(prev => [...new Set([...prev, y])].sort().reverse()); setAcademicYear(y) }
          }} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}>+ New Year</button>
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['skills', '🎯 Skills & Activities'], ['assign', '📌 Program Assignments']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* SKILLS & ACTIVITIES VIEW */}
            {view === 'skills' && (
              <>
                {skills.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                    <div>No skills added for {academicYear} yet.</div>
                    <div style={{ fontSize: '13px', marginTop: '8px' }}>Click "+ Add Skill" to get started.</div>
                  </div>
                ) : skills.map(skill => (
                  <div key={skill.id} className="card">
                    {/* Skill Header */}
                    <div className="skill-header" onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700' }}>{skill.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>{skill.skill_activities?.length || 0} activities</span>
                          {(skillPrograms[skill.id] || []).length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(skillPrograms[skill.id] || []).map(p => (
                                <span key={p} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>{p}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {skill.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{skill.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingSkill(skill); setSkillForm({ name: skill.name, description: skill.description || '' }); setShowSkillForm(true) }}
                          style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => deleteSkill(skill.id)}
                          style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                        <span style={{ color: 'rgba(255,255,255,0.3)', padding: '5px' }}>{expandedSkill === skill.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Activities */}
                    {expandedSkill === skill.id && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                        {(skill.skill_activities || []).sort((a, b) => a.order_index - b.order_index).map(act => (
                          <div key={act.id} className="activity-row">
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '500' }}>{act.name}</div>
                              {act.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => { setEditingActivity(act); setActivityForm({ name: act.name, description: act.description || '' }); setShowActivityForm(skill.id) }}
                                style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                              <button onClick={() => deleteActivity(act.id)}
                                style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => { setEditingActivity(null); setActivityForm({ name: '', description: '' }); setShowActivityForm(skill.id) }}
                          style={{ marginTop: '12px', padding: '8px 16px', background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
                          + Add Activity
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* PROGRAM ASSIGNMENTS VIEW */}
            {view === 'assign' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Click program chips to assign/unassign skills to programs. Teachers will only see skills assigned to their programs.
                </div>
                {skills.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No skills yet. Add skills first.</div>
                ) : skills.map(skill => (
                  <div key={skill.id} className="card">
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '8px' }}>{skill.name}</div>
                    {skill.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '12px' }}>{skill.description}</div>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {programs.map(prog => {
                        const assigned = (skillPrograms[skill.id] || []).includes(prog)
                        return (
                          <button key={prog} className="prog-chip" onClick={() => toggleProgram(skill.id, prog)}
                            style={{
                              background: assigned ? 'rgba(167,139,250,0.2)' : 'transparent',
                              borderColor: assigned ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                              color: assigned ? '#a78bfa' : 'rgba(255,255,255,0.4)'
                            }}>
                            {assigned ? '✓ ' : ''}{prog}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                      {(skillPrograms[skill.id] || []).length === 0 ? '⚠️ Not assigned to any program' : `Assigned to: ${(skillPrograms[skill.id] || []).join(', ')}`}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Skill Modal */}
      {showSkillForm && (
        <div className="modal-overlay" onClick={() => setShowSkillForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingSkill ? '✏️ Edit Skill' : '🎯 Add New Skill'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Skill Name *</label>
            <input value={skillForm.name} onChange={e => setSkillForm({ ...skillForm, name: e.target.value })}
              placeholder='e.g. Fine Motor Skills' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <input value={skillForm.description} onChange={e => setSkillForm({ ...skillForm, description: e.target.value })}
              placeholder='Brief description of this skill' style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowSkillForm(false); setEditingSkill(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveSkill} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingSkill ? 'Update Skill' : 'Add Skill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Activity Modal */}
      {showActivityForm && (
        <div className="modal-overlay" onClick={() => { setShowActivityForm(null); setEditingActivity(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>{editingActivity ? '✏️ Edit Activity' : '➕ Add Activity'}</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{skills.find(s => s.id === showActivityForm)?.name}</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Activity Name *</label>
            <input value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })}
              placeholder='e.g. Holds pencil correctly' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <input value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
              placeholder='What to observe...' style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowActivityForm(null); setEditingActivity(null) }} className="btn-secondary">Cancel</button>
              <button onClick={() => saveActivity(showActivityForm)} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingActivity ? 'Update' : 'Add Activity'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
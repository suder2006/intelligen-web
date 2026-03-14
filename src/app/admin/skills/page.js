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

const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
const TERMS = ['Term 1', 'Term 2', 'Term 3']

export default function AdminSkillsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [academicYears, setAcademicYears] = useState([CURRENT_AY])
  const [skills, setSkills] = useState([])
  const [programs, setPrograms] = useState([])
  const [skillMaps, setSkillMaps] = useState([]) // {skill_id, program, term}
  const [expandedSkill, setExpandedSkill] = useState(null)

  // Modals
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(null)
  const [editingSkill, setEditingSkill] = useState(null)
  const [editingActivity, setEditingActivity] = useState(null)
  const [skillForm, setSkillForm] = useState({ name: '', description: '' })
  const [activityForm, setActivityForm] = useState({ name: '', description: '' })

  useEffect(() => { fetchAll() }, [academicYear])

  const fetchAll = async () => {
    setLoading(true)
    const [skillsRes, progsRes, mapsRes, ayRes] = await Promise.all([
      supabase.from('skill_masters').select(`*, skill_activities(*)`).eq('academic_year', academicYear).order('order_index').order('created_at'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value'),
      supabase.from('skill_program_map').select('*'),
      supabase.from('skill_masters').select('academic_year')
    ])
    const years = [...new Set([CURRENT_AY, ...(ayRes.data?.map(s => s.academic_year) || [])])]
    setAcademicYears(years.sort().reverse())
    setSkills(skillsRes.data || [])
    setPrograms(progsRes?.data?.map(p => p.value) || [])
    setSkillMaps(mapsRes.data || [])
    setLoading(false)
  }

  const saveSkill = async () => {
    if (!skillForm.name.trim()) { alert('Please enter skill name'); return }
    setSaving(true)
    if (editingSkill) {
      await supabase.from('skill_masters').update({ name: skillForm.name, description: skillForm.description }).eq('id', editingSkill.id)
    } else {
      const { data: newSkill } = await supabase.from('skill_masters').insert({
        name: skillForm.name, description: skillForm.description,
        academic_year: academicYear, order_index: skills.length
      }).select().single()
      if (newSkill) setExpandedSkill(newSkill.id)
    }
    setShowSkillModal(false)
    setSkillForm({ name: '', description: '' })
    setEditingSkill(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteSkill = async (id) => {
    if (!confirm('Delete this skill and all its activities?')) return
    await supabase.from('skill_program_map').delete().eq('skill_id', id)
    await supabase.from('skill_activities').delete().eq('skill_id', id)
    await supabase.from('skill_masters').delete().eq('id', id)
    if (expandedSkill === id) setExpandedSkill(null)
    await fetchAll()
  }

  const saveActivity = async (skillId) => {
    if (!activityForm.name.trim()) { alert('Please enter activity name'); return }
    setSaving(true)
    const skill = skills.find(s => s.id === skillId)
    const actCount = skill?.skill_activities?.length || 0
    if (editingActivity) {
      await supabase.from('skill_activities').update({ name: activityForm.name, description: activityForm.description }).eq('id', editingActivity.id)
    } else {
      await supabase.from('skill_activities').insert({
        skill_id: skillId, name: activityForm.name,
        description: activityForm.description, order_index: actCount
      })
    }
    setShowActivityModal(null)
    setActivityForm({ name: '', description: '' })
    setEditingActivity(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return
    await supabase.from('skill_activities').delete().eq('id', id)
    await fetchAll()
  }

  const isAssigned = (skillId, program, term) => {
    return skillMaps.some(m => m.skill_id === skillId && m.program === program && m.term === term)
  }

  const toggleAssignment = async (skillId, program, term) => {
    const assigned = isAssigned(skillId, program, term)
    if (assigned) {
      await supabase.from('skill_program_map').delete()
        .eq('skill_id', skillId).eq('program', program).eq('term', term)
    } else {
      await supabase.from('skill_program_map').insert({ skill_id: skillId, program, term })
    }
    await fetchAll()
  }

  const getSkillSummary = (skillId) => {
    const maps = skillMaps.filter(m => m.skill_id === skillId)
    if (maps.length === 0) return null
    // Group by program
    const grouped = {}
    maps.forEach(m => {
      if (!grouped[m.program]) grouped[m.program] = []
      grouped[m.program].push(m.term)
    })
    return grouped
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
        .skill-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; margin-bottom: 16px; overflow: hidden; }
        .skill-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; cursor: pointer; }
        .skill-header:hover { background: rgba(255,255,255,0.02); }
        .skill-body { padding: 0 20px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .activity-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px; }
        .activity-row:last-child { border-bottom: none; }
        .assign-chip { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎯 Skills & Progress Setup</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Add skills → Add activities → Assign to Program + Term</p>
          </div>
          <button onClick={() => { setEditingSkill(null); setSkillForm({ name: '', description: '' }); setShowSkillModal(true) }} className="btn-primary">+ Add Skill</button>
        </div>

        {/* Academic Year */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Academic Year:</span>
          {academicYears.map(ay => (
            <button key={ay} onClick={() => setAcademicYear(ay)}
              style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${academicYear === ay ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: academicYear === ay ? 'rgba(56,189,248,0.15)' : 'transparent', color: academicYear === ay ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {ay}
            </button>
          ))}
          <button onClick={() => { const y = prompt('Enter academic year (e.g. 2026-2027)'); if (y) { setAcademicYears(prev => [...new Set([...prev, y])].sort().reverse()); setAcademicYear(y) } }}
            style={{ padding: '7px 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}>+ New Year</button>
        </div>

        {/* Guide */}
        <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.8' }}>
          <strong style={{ color: '#38bdf8' }}>How to set up:</strong><br/>
          1. Click <strong style={{ color: '#fff' }}>+ Add Skill</strong> → Enter skill name (e.g. Fine Motor Skills)<br/>
          2. Expand the skill → Click <strong style={{ color: '#fff' }}>+ Add Activity</strong> to add activities<br/>
          3. In the <strong style={{ color: '#fff' }}>Assign to Program & Term</strong> section → click each Program+Term combination to assign
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No skills added yet for {academicYear}</div>
          </div>
        ) : skills.map(skill => {
          const summary = getSkillSummary(skill.id)
          return (
            <div key={skill.id} className="skill-card">
              <div className="skill-header" onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700' }}>{skill.name}</span>
                    <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>
                      {skill.skill_activities?.length || 0} activities
                    </span>
                    {summary ? (
                      Object.entries(summary).map(([prog, terms]) => (
                        <span key={prog} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                          {prog}: {terms.join(', ')}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '12px' }}>⚠️ Not assigned yet</span>
                    )}
                  </div>
                  {skill.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{skill.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingSkill(skill); setSkillForm({ name: skill.name, description: skill.description || '' }); setShowSkillModal(true) }}
                    style={{ padding: '6px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                  <button onClick={() => deleteSkill(skill.id)}
                    style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  <span style={{ color: 'rgba(255,255,255,0.3)', padding: '6px 4px', fontSize: '12px' }}>{expandedSkill === skill.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedSkill === skill.id && (
                <div className="skill-body">
                  <div style={{ paddingTop: '16px' }}>
                    {/* Activities */}
                    {(skill.skill_activities || []).length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '12px 0', textAlign: 'center' }}>No activities yet. Click "+ Add Activity" below.</div>
                    ) : (
                      <>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Activities</div>
                        {(skill.skill_activities || []).sort((a, b) => a.order_index - b.order_index).map(act => (
                          <div key={act.id} className="activity-row">
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>• {act.name}</div>
                              {act.description && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '2px', paddingLeft: '12px' }}>{act.description}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => { setEditingActivity(act); setActivityForm({ name: act.name, description: act.description || '' }); setShowActivityModal(skill.id) }}
                                style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                              <button onClick={() => deleteActivity(act.id)}
                                style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    <button onClick={() => { setEditingActivity(null); setActivityForm({ name: '', description: '' }); setShowActivityModal(skill.id) }}
                      style={{ marginTop: '12px', padding: '10px 16px', background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
                      + Add Activity under "{skill.name}"
                    </button>

                    {/* Program + Term Assignment Grid */}
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Assign to Program & Term</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', minWidth: '400px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600' }}>Program</th>
                              {TERMS.map(term => (
                                <th key={term} style={{ padding: '8px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600' }}>{term}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {programs.map(prog => (
                              <tr key={prog}>
                                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '500' }}>{prog}</td>
                                {TERMS.map(term => {
                                  const assigned = isAssigned(skill.id, prog, term)
                                  return (
                                    <td key={term} style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <button onClick={() => toggleAssignment(skill.id, prog, term)}
                                        style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${assigned ? '#a78bfa' : 'rgba(255,255,255,0.12)'}`, background: assigned ? 'rgba(167,139,250,0.2)' : 'transparent', color: assigned ? '#a78bfa' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                                        {assigned ? '✓ On' : 'Off'}
                                      </button>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Skill Modal */}
      {showSkillModal && (
        <div className="modal-overlay" onClick={() => { setShowSkillModal(false); setEditingSkill(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>{editingSkill ? '✏️ Edit Skill' : '🎯 Add New Skill'}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>A skill is a broad area like "Fine Motor Skills". You'll add specific activities under it.</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Skill Name *</label>
            <input value={skillForm.name} onChange={e => setSkillForm({ ...skillForm, name: e.target.value })}
              placeholder='e.g. Fine Motor Skills, Gross Motor Skills...' style={inputStyle} autoFocus
              onKeyDown={e => e.key === 'Enter' && saveSkill()} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <input value={skillForm.description} onChange={e => setSkillForm({ ...skillForm, description: e.target.value })}
              placeholder='Brief description' style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowSkillModal(false); setEditingSkill(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveSkill} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingSkill ? 'Update' : 'Add Skill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => { setShowActivityModal(null); setEditingActivity(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>{editingActivity ? '✏️ Edit Activity' : '➕ Add Activity'}</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>Under: <strong>{skills.find(s => s.id === showActivityModal)?.name}</strong></p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Activity Name *</label>
            <input value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })}
              placeholder='e.g. Holds pencil correctly' style={inputStyle} autoFocus
              onKeyDown={e => e.key === 'Enter' && saveActivity(showActivityModal)} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>What to observe (optional)</label>
            <input value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
              placeholder='What should the teacher look for?' style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowActivityModal(null); setEditingActivity(null) }} className="btn-secondary">Cancel</button>
              <button onClick={() => saveActivity(showActivityModal)} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingActivity ? 'Update' : 'Add Activity'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
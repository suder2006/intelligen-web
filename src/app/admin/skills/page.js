'use client'
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'
import { TEMPLATE_HEADERS, parseSkillSheet, groupSkillRows } from '@/lib/skillsUpload'



const CURRENT_AY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
const TERMS = ['Term 1', 'Term 2', 'Term 3']

const TERM_MONTHS = {
  'Term 1': ['June', 'July', 'August'],
  'Term 2': ['September', 'October', 'November', 'December'],
  'Term 3': ['January', 'February', 'March'],
}

const EMPTY_SKILL_FORM = { name: '', description: '', development_area: '', program: '', outcomes: [] }
const EMPTY_ACTIVITY_FORM = { name: '', description: '', program: '', term: '', month: '' }

const sortedOutcomes = (skill) => [...(skill?.skill_learning_outcomes || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
// "LKG · Term 1: June" for an activity's program/term/month tags.
const activityTag = (act) => [act.program, [act.term, act.month].filter(Boolean).join(': ')].filter(Boolean).join(' · ')

export default function AdminSkillsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [academicYears, setAcademicYears] = useState([CURRENT_AY])
  const [skills, setSkills] = useState([])
  const [programs, setPrograms] = useState([])
  const [skillMaps, setSkillMaps] = useState([]) // {skill_id, program, term}
  const [expandedSkill, setExpandedSkill] = useState(null)
  const [filterProgram, setFilterProgram] = useState('All')
  const [filterTerm, setFilterTerm] = useState('All')
  const [filterMonth, setFilterMonth] = useState('All')

  // Modals
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(null)
  const [editingSkill, setEditingSkill] = useState(null)
  const [editingActivity, setEditingActivity] = useState(null)
  const [skillForm, setSkillForm] = useState(EMPTY_SKILL_FORM)
  const [activityForm, setActivityForm] = useState(EMPTY_ACTIVITY_FORM)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkPreview, setBulkPreview] = useState([])
  const [bulkErrors, setBulkErrors] = useState([]) // rows that can't be saved with program/term/month
  const [bulkSaving, setBulkSaving] = useState(false)
  const bulkFileRef = useRef(null)

  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [academicYear, schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [skillsRes, progsRes, mapsRes, ayRes] = await Promise.all([
      supabase.from('skill_masters').select(`*, skill_activities(*), skill_learning_outcomes(*)`).eq('academic_year', academicYear).eq('school_id', schoolId).order('order_index').order('created_at'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value'),
      supabase.from('skill_program_map').select('*'),
      supabase.from('skill_masters').select('academic_year').eq('school_id', schoolId)
    ])
    const years = [...new Set([CURRENT_AY, ...(ayRes.data?.map(s => s.academic_year) || [])])]
    setAcademicYears(years.sort().reverse())
    setSkills(skillsRes.data || [])
    setPrograms(progsRes?.data?.map(p => p.value) || [])
    setSkillMaps(mapsRes.data || [])
    setLoading(false)
  }

  const openSkillModal = (skill) => {
    setEditingSkill(skill)
    setSkillForm(skill ? {
      name: skill.name,
      description: skill.description || '',
      development_area: skill.development_area || '',
      program: skill.program || (skillPrograms(skill).length === 1 ? skillPrograms(skill)[0] : ''),
      outcomes: sortedOutcomes(skill).map(o => o.outcome)
    } : { ...EMPTY_SKILL_FORM, program: filterProgram !== 'All' ? filterProgram : '' })
    setShowSkillModal(true)
  }

  const setOutcome = (index, value) => setSkillForm(prev => ({ ...prev, outcomes: prev.outcomes.map((o, i) => i === index ? value : o) }))
  const addOutcome = () => setSkillForm(prev => ({ ...prev, outcomes: [...prev.outcomes, ''] }))
  const removeOutcome = (index) => setSkillForm(prev => ({ ...prev, outcomes: prev.outcomes.filter((_, i) => i !== index) }))

  const saveSkill = async () => {
    if (!skillForm.name.trim()) { alert('Please enter skill name'); return }
    if (!skillForm.program) { alert('Please choose a program'); return }
    setSaving(true)
    const fields = {
      name: skillForm.name,
      description: skillForm.description,
      development_area: skillForm.development_area.trim() || null,
      program: skillForm.program
    }
    // skill_masters is unique by school + year + name + program.
    const saveError = (error) => alert(error.code === '23505'
      ? `"${skillForm.name}" already exists for ${skillForm.program} in ${academicYear}`
      : 'Error: ' + error.message)
    let skillId = editingSkill?.id
    if (editingSkill) {
      const { error } = await supabase.from('skill_masters').update(fields).eq('id', skillId)
      if (error) { saveError(error); setSaving(false); return }
    } else {
      const { data: newSkill, error } = await supabase.from('skill_masters').insert({
        ...fields, academic_year: academicYear, order_index: skills.length, school_id: schoolId
      }).select().single()
      if (error) { saveError(error); setSaving(false); return }
      skillId = newSkill.id
      setExpandedSkill(skillId)
    }

    // Replace the skill's outcomes with what's in the form, in form order.
    const outcomes = skillForm.outcomes.map(o => o.trim()).filter(Boolean)
    let outcomeError = null
    if (editingSkill) {
      const { error } = await supabase.from('skill_learning_outcomes').delete().eq('skill_id', skillId)
      outcomeError = error
    }
    if (!outcomeError && outcomes.length) {
      const { error } = await supabase.from('skill_learning_outcomes')
        .insert(outcomes.map((outcome, i) => ({ skill_id: skillId, outcome, order_index: i })))
      outcomeError = error
    }
    if (outcomeError) alert('Skill saved, but learning outcomes failed: ' + outcomeError.message)

    setShowSkillModal(false)
    setSkillForm(EMPTY_SKILL_FORM)
    setEditingSkill(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteSkill = async (id) => {
    if (!confirm('Delete this skill and all its activities?')) return
    await supabase.from('skill_program_map').delete().eq('skill_id', id)
    await supabase.from('skill_learning_outcomes').delete().eq('skill_id', id)
    await supabase.from('skill_activities').delete().eq('skill_id', id)
    await supabase.from('skill_masters').delete().eq('id', id)
    if (expandedSkill === id) setExpandedSkill(null)
    await fetchAll()
  }

  // The programs a skill belongs to: its program column, or for skills saved before that
  // column existed, its assignments and its activities' tags.
  const skillPrograms = (skill) => skill.program ? [skill.program] : [...new Set([
    ...skillMaps.filter(m => m.skill_id === skill.id).map(m => m.program),
    ...(skill.skill_activities || []).map(a => a.program)
  ].filter(Boolean))]

  const openActivityModal = (skill, act) => {
    setEditingActivity(act)
    const progs = skillPrograms(skill)
    const firstMap = skillMaps.find(m => m.skill_id === skill.id)
    setActivityForm(act ? {
      name: act.name, description: act.description || '',
      program: act.program || (progs.length === 1 ? progs[0] : ''),
      term: act.term || '', month: act.month || ''
    } : {
      ...EMPTY_ACTIVITY_FORM,
      program: filterProgram !== 'All' ? filterProgram : progs.length === 1 ? progs[0] : '',
      term: filterTerm !== 'All' ? filterTerm : firstMap?.term || '',
      month: filterMonth !== 'All' ? filterMonth : firstMap?.month || ''
    })
    setShowActivityModal(skill.id)
  }

  const saveActivity = async (skillId) => {
    if (!activityForm.name.trim()) { alert('Please enter activity name'); return }
    const { program, term, month } = activityForm
    if (!program || !term || !month) { alert('Please choose program, term and month'); return }
    setSaving(true)
    const skill = skills.find(s => s.id === skillId)
    const actCount = skill?.skill_activities?.length || 0
    const fields = { name: activityForm.name, description: activityForm.description, program, term, month }
    const { error } = editingActivity
      ? await supabase.from('skill_activities').update(fields).eq('id', editingActivity.id)
      : await supabase.from('skill_activities').insert({ ...fields, skill_id: skillId, order_index: actCount })
    if (error) alert('Error: ' + error.message)
    // The skill must be assigned to this program/term/month for the activity to show up for grading.
    else if (!isAssigned(skillId, program, term, month)) {
      await supabase.from('skill_program_map').insert({ skill_id: skillId, program, term, month })
    }
    setShowActivityModal(null)
    setActivityForm(EMPTY_ACTIVITY_FORM)
    setEditingActivity(null)
    await fetchAll()
    setSaving(false)
  }

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return
    await supabase.from('skill_activities').delete().eq('id', id)
    await fetchAll()
  }

  const isAssigned = (skillId, program, term, month) => {
  return skillMaps.some(m =>
    m.skill_id === skillId &&
    m.program === program &&
    m.term === term &&
    m.month === month
  )
}

const toggleAssignment = async (skillId, program, term, month) => {
  const assigned = isAssigned(skillId, program, term, month)
  if (assigned) {
    await supabase.from('skill_program_map').delete()
      .eq('skill_id', skillId)
      .eq('program', program)
      .eq('term', term)
      .eq('month', month)
  } else {
    await supabase.from('skill_program_map').insert({
      skill_id: skillId, program, term, month
    })
  }
  await fetchAll()
}

// True when an assignment fits the program/term/month filters ('All' matches anything).
const matchesFilter = (program, term, month) =>
  (filterProgram === 'All' || program === filterProgram) &&
  (filterTerm === 'All' || term === filterTerm) &&
  (filterMonth === 'All' || month === filterMonth)

const filterActive = filterProgram !== 'All'
const visibleSkills = filterActive
  // The open skill stays visible so it doesn't vanish while you edit its assignments.
  ? skills.filter(s => s.id === expandedSkill ||
    (s.program === filterProgram && filterTerm === 'All') || skillMaps.some(m => m.skill_id === s.id && matchesFilter(m.program, m.term, m.month)))
  : skills

const selectProgram = (p) => { setFilterProgram(p); setFilterTerm('All'); setFilterMonth('All') }
const selectTerm = (t) => { setFilterTerm(t); setFilterMonth('All') }

const filterBtnStyle = (active) => ({
  padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
  border: `1px solid ${active ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
  background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
  color: active ? '#a78bfa' : 'rgba(255,255,255,0.45)'
})

// Program choices in the activity form: the open skill's own program, or every program if it has none yet.
const activitySkill = skills.find(s => s.id === showActivityModal)
const activityPrograms = activitySkill && skillPrograms(activitySkill).length ? skillPrograms(activitySkill) : programs

const getSkillSummary = (skillId) => {
  const maps = skillMaps.filter(m => m.skill_id === skillId)
  if (maps.length === 0) return null
  const grouped = {}
  maps.forEach(m => {
    const key = m.program
    if (!grouped[key]) grouped[key] = {}
    if (!grouped[key][m.term]) grouped[key][m.term] = []
    grouped[key][m.term].push(m.month)
  })
  return grouped
}

    const downloadTemplate = () => {
    const template = [
      TEMPLATE_HEADERS,
      ['Physical Development', 'Fine Motor Skills', 'Hand and finger coordination', 'Uses fingers to hold and control tools; Shows hand-eye coordination', 'Holds pencil correctly', 'Check grip position', 'LKG', 'Term 1', 'June'],
      ['Physical Development', 'Fine Motor Skills', '', '', 'Cuts with scissors', 'Straight line cutting', 'LKG', 'Term 1', 'June'],
      ['Physical Development', 'Gross Motor Skills', 'Body movement and balance', 'Moves with balance and control', 'Runs in straight line', '', 'LKG', 'Term 1', 'June'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(template)
    ws['!cols'] = [
      { wch: 28 }, { wch: 25 }, { wch: 30 }, { wch: 45 }, { wch: 30 }, { wch: 30 },
      { wch: 15 }, { wch: 10 }, { wch: 12 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Skills Template')
    XLSX.writeFile(wb, 'intelligen_skills_template.xlsx')
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const { rows: parsed, errors } = parseSkillSheet(XLSX.utils.sheet_to_json(ws, { header: 1 }), programs)
      console.log('[skills bulk upload] parsed rows', parsed.length, 'errors', errors)
      if (parsed.length === 0 && errors.length === 0) { alert('No data found in file!'); return }
      setBulkPreview(parsed)
      setBulkErrors(errors)
      setShowBulkModal(true)
    } catch (e) {
      alert('Error reading file: ' + e.message)
    }
    e.target.value = ''
  }

  const saveBulkUpload = async () => {
    if (!bulkPreview.length || bulkErrors.length) return
    setBulkSaving(true)
    try {
      const skillGroups = groupSkillRows(bulkPreview)
      console.log('[skills bulk upload] saving', skillGroups.length, 'skills', skillGroups.map(g => ({
        name: g.name, program: g.program, activities: g.activities.length,
        months: [...new Set(g.activities.map(a => `${a.term}: ${a.month}`))]
      })))

      let skillsCreated = 0, activitiesCreated = 0, assignmentsCreated = 0, outcomesCreated = 0
      const claimed = new Set() // existing skills already matched to a skill in this upload

      for (const skillData of skillGroups) {
        let skillId
        // Reuse a same-named skill that belongs only to this program, else an unassigned one.
        // Skills shared across programs are never reused, so their activities don't mix.
        const sameName = skills.filter(s => !claimed.has(s.id) && s.name.toLowerCase() === skillData.name.toLowerCase())
        const existing = sameName.find(s => {
          const progs = skillPrograms(s)
          return skillData.program ? progs.length === 1 && progs[0] === skillData.program : progs.length === 0
        }) || (skillData.program ? sameName.find(s => skillPrograms(s).length === 0) : undefined)
        if (existing) {
          skillId = existing.id
          claimed.add(skillId)
          const updates = {}
          if (skillData.devArea && skillData.devArea !== existing.development_area) updates.development_area = skillData.devArea
          if (skillData.program && !existing.program) updates.program = skillData.program
          if (Object.keys(updates).length) {
            const { error } = await supabase.from('skill_masters').update(updates).eq('id', skillId)
            if (error) throw error
          }
        } else {
          const { data: newSkill, error } = await supabase.from('skill_masters').insert({
            name: skillData.name, description: skillData.desc || null,
            development_area: skillData.devArea || null, program: skillData.program || null,
            academic_year: academicYear, order_index: skills.length + skillsCreated,
            school_id: schoolId
          }).select().single()
          if (error) throw error
          skillId = newSkill.id
          skillsCreated++
        }

        // Add outcomes the skill doesn't already have, after its existing ones.
        const existingOutcomes = sortedOutcomes(existing)
        const newOutcomes = skillData.outcomes.filter(o => !existingOutcomes.some(e => e.outcome.toLowerCase() === o.toLowerCase()))
        if (newOutcomes.length) {
          const { error } = await supabase.from('skill_learning_outcomes').insert(newOutcomes.map((outcome, i) => ({
            skill_id: skillId, outcome, order_index: existingOutcomes.length + i
          })))
          if (error) throw error
          outcomesCreated += newOutcomes.length
        }

        const existingActs = existing?.skill_activities || []
        const adopted = new Set()
        let orderIndex = existingActs.length
        for (const act of skillData.activities) {
          const tags = { program: act.program, term: act.term, month: act.month }
          // parseSkillSheet rejects such rows; this guards against ever saving an untagged activity.
          if (!tags.program || !tags.term || !tags.month) {
            throw new Error(`Row ${act.rowNum} "${act.name}" has no program/term/month (${JSON.stringify(tags)})`)
          }
          const sameActName = existingActs.filter(a => !adopted.has(a.id) && a.name.toLowerCase() === act.name.toLowerCase())
          if (sameActName.some(a => a.program === tags.program && a.term === tags.term && a.month === tags.month)) {
            console.log('[skills bulk upload] skip existing activity', skillData.name, act.name, tags)
            continue
          }
          // An activity saved before program/term/month tagging takes this row's tags instead of being duplicated.
          const untagged = sameActName.find(a => !a.program && !a.term && !a.month)
          const { data: saved, error } = untagged
            ? await supabase.from('skill_activities').update(tags).eq('id', untagged.id).select('id, name, program, term, month').single()
            : await supabase.from('skill_activities').insert({
              skill_id: skillId, name: act.name,
              description: act.description || null, order_index: orderIndex++, ...tags
            }).select('id, name, program, term, month').single()
          if (error) throw error
          console.log(`[skills bulk upload] ${untagged ? 'tagged' : 'inserted'} activity`, skillData.name, saved)
          // Fail loudly if the database didn't keep the tags we sent.
          if (saved.program !== tags.program || saved.term !== tags.term || saved.month !== tags.month) {
            throw new Error(`"${act.name}" was saved as ${JSON.stringify({ program: saved.program, term: saved.term, month: saved.month })} instead of ${JSON.stringify(tags)}`)
          }
          if (untagged) adopted.add(untagged.id)
          else activitiesCreated++
        }

        for (const assignment of skillData.assignments) {
          const alreadyAssigned = skillMaps.find(
            m => m.skill_id === skillId && m.program === assignment.program &&
              m.term === assignment.term && m.month === assignment.month
          )
          if (!alreadyAssigned) {
            await supabase.from('skill_program_map').insert({
              skill_id: skillId, program: assignment.program,
              term: assignment.term, month: assignment.month
            })
            assignmentsCreated++
          }
        }
      }

      setShowBulkModal(false)
      setBulkPreview([])
      setBulkErrors([])
      await fetchAll()
      alert(`✅ Bulk upload complete!\n\n→ ${skillsCreated} skills created\n→ ${outcomesCreated} learning outcomes created\n→ ${activitiesCreated} activities created\n→ ${assignmentsCreated} assignments created`)
    } catch (e) {
      alert('Error saving: ' + e.message)
    }
    setBulkSaving(false)
  }
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
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
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎯 Skills & Progress Setup</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Add skills (with development area &amp; learning outcomes) → Add activities → Assign to Program + Term</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input ref={bulkFileRef} type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} style={{ display: 'none' }} />
            <button onClick={downloadTemplate} className="btn-secondary">⬇️ Download Template</button>
            <button onClick={() => bulkFileRef.current?.click()} className="btn-secondary">📤 Bulk Upload</button>
            <button onClick={() => openSkillModal(null)} className="btn-primary">+ Add Skill</button>
          </div>
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

        {/* Program → Term → Month filter */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px 14px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', width: '64px' }}>Program:</span>
            {['All', ...programs].map(p => (
              <button key={p} onClick={() => selectProgram(p)} style={filterBtnStyle(filterProgram === p)}>{p}</button>
            ))}
          </div>
          {filterProgram !== 'All' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', width: '64px' }}>Term:</span>
              {['All', ...TERMS].map(t => (
                <button key={t} onClick={() => selectTerm(t)} style={filterBtnStyle(filterTerm === t)}>{t === 'All' ? 'All Terms' : t}</button>
              ))}
            </div>
          )}
          {filterProgram !== 'All' && filterTerm !== 'All' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', width: '64px' }}>Month:</span>
              {['All', ...TERM_MONTHS[filterTerm]].map(m => (
                <button key={m} onClick={() => setFilterMonth(m)} style={filterBtnStyle(filterMonth === m)}>{m === 'All' ? m : m.slice(0, 3)}</button>
              ))}
            </div>
          )}
          {filterActive && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              Showing {visibleSkills.length} of {skills.length} skills
            </div>
          )}
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
        ) : visibleSkills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              No skills assigned to {filterProgram}{filterTerm !== 'All' ? ` · ${filterTerm}` : ''}{filterMonth !== 'All' ? ` · ${filterMonth}` : ''}
            </div>
            <button onClick={() => selectProgram('All')} className="btn-secondary" style={{ marginTop: '8px' }}>Show all skills</button>
          </div>
        ) : visibleSkills.map(skill => {
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
                      Object.entries(summary).map(([prog, termMap]) => (
                        Object.entries(termMap).map(([term, allMonths]) => {
                          // With a filter active, show only the chips (and months) that match it.
                          const months = filterActive ? allMonths.filter(m => matchesFilter(prog, term, m)) : allMonths
                          if (months.length === 0) return null
                          const hit = filterActive
                          return (
                            <span key={`${prog}-${term}`} style={{
                              padding: '2px 8px', borderRadius: '20px', fontSize: '11px',
                              background: hit ? 'rgba(16,185,129,0.18)' : 'rgba(167,139,250,0.15)',
                              color: hit ? '#34d399' : '#a78bfa',
                              border: `1px solid ${hit ? 'rgba(16,185,129,0.4)' : 'rgba(167,139,250,0.2)'}`
                            }}>
                              {prog} · {term}: {months.map((m, i) => (
                                <span key={m} style={{ fontWeight: hit && filterMonth !== 'All' ? '800' : 'inherit' }}>
                                  {i > 0 ? ', ' : ''}{m}
                                </span>
                              ))}
                            </span>
                          )
                        })
                      ))
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '12px' }}>{skill.program ? `${skill.program} · ` : ''}⚠️ Not assigned yet</span>
                    )}
                  </div>
                  {skill.development_area && <div style={{ color: '#34d399', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>🌱 {skill.development_area}</div>}
                  {skill.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>{skill.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openSkillModal(skill)}
                    style={{ padding: '6px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                  <button onClick={() => deleteSkill(skill.id)}
                    style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  <span style={{ color: 'rgba(255,255,255,0.3)', padding: '6px 4px', fontSize: '12px' }}>{expandedSkill === skill.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedSkill === skill.id && (
                <div className="skill-body">
                  <div style={{ paddingTop: '16px' }}>
                    {/* Learning outcomes */}
                    {sortedOutcomes(skill).length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Learning Outcomes</div>
                        {sortedOutcomes(skill).map(o => (
                          <div key={o.id} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontStyle: 'italic', padding: '3px 0' }}>◦ {o.outcome}</div>
                        ))}
                      </div>
                    )}

                    {/* Activities */}
                    {(() => {
                    // With a filter active, show only that program/term/month's activities (untagged ones match any).
                    const acts = (skill.skill_activities || []).filter(a => !filterActive || (
                      (!a.program || a.program === filterProgram) &&
                      (filterTerm === 'All' || !a.term || a.term === filterTerm) &&
                      (filterMonth === 'All' || !a.month || a.month === filterMonth)))
                    return acts.length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '12px 0', textAlign: 'center' }}>No activities yet. Click "+ Add Activity" below.</div>
                    ) : (
                      <>
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Activities</div>
                        {acts.sort((a, b) => a.order_index - b.order_index).map(act => (
                          <div key={act.id} className="activity-row">
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>• {act.name}</div>
                              {act.description && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '2px', paddingLeft: '12px' }}>{act.description}</div>}
                              <div style={{ color: activityTag(act) ? '#a78bfa' : '#f59e0b', fontSize: '11px', marginTop: '3px', paddingLeft: '12px' }}>
                                {activityTag(act) || '⚠️ No program / term / month'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => openActivityModal(skill, act)}
                                style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                              <button onClick={() => deleteActivity(act.id)}
                                style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                    })()}

                    <button onClick={() => openActivityModal(skill, null)}
                      style={{ marginTop: '12px', padding: '10px 16px', background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
                      + Add Activity under "{skill.name}"
                    </button>

                    {/* Program + Term + Month Assignment Grid */}
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>
                        Assign to Program, Term & Month
                      </div>

                      {/* A skill belongs to one program; only unassigned skills offer every program. */}
                      {(skillPrograms(skill).length ? skillPrograms(skill) : programs).map(prog => (
                        <div key={prog} style={{ marginBottom: '20px' }}>
                          <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>
                            📚 {prog}
                          </div>
                          {TERMS.map(term => (
                            <div key={term} style={{ marginBottom: '10px', paddingLeft: '12px' }}>
                              <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                                {term}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {TERM_MONTHS[term].map(month => {
                                  const assigned = isAssigned(skill.id, prog, term, month)
                                  return (
                                    <button key={month}
                                      onClick={() => toggleAssignment(skill.id, prog, term, month)}
                                      style={{
                                        padding: '5px 12px',
                                        borderRadius: '20px',
                                        border: `1px solid ${assigned ? '#a78bfa' : 'rgba(255,255,255,0.12)'}`,
                                        background: assigned ? 'rgba(167,139,250,0.2)' : 'transparent',
                                        color: assigned ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        fontFamily: "'DM Sans', sans-serif"
                                      }}>
                                      {assigned ? '✓ ' : ''}{month}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
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
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Program *</label>
            <select value={skillForm.program} onChange={e => setSkillForm({ ...skillForm, program: e.target.value })} style={inputStyle}>
              <option value='' style={{ background: '#1e293b' }}>Select program</option>
              {programs.map(p => <option key={p} value={p} style={{ background: '#1e293b' }}>{p}</option>)}
            </select>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <input value={skillForm.description} onChange={e => setSkillForm({ ...skillForm, description: e.target.value })}
              placeholder='Brief description' style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Development Area (optional)</label>
            <input value={skillForm.development_area} onChange={e => setSkillForm({ ...skillForm, development_area: e.target.value })}
              placeholder='e.g. Personal & Social Development' style={inputStyle} list='development-areas' />
            <datalist id='development-areas'>
              {[...new Set(skills.map(s => s.development_area).filter(Boolean))].map(a => <option key={a} value={a} />)}
            </datalist>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Learning Outcomes (optional)</label>
            {skillForm.outcomes.map((outcome, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <input value={outcome} onChange={e => setOutcome(i, e.target.value)}
                  placeholder={`Outcome ${i + 1}`} style={inputStyle} />
                <button onClick={() => removeOutcome(i)} title='Remove outcome'
                  style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#f87171', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>Remove</button>
              </div>
            ))}
            <button onClick={addOutcome}
              style={{ padding: '8px 14px', background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', width: '100%', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }}>
              + Add Outcome
            </button>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowSkillModal(false); setEditingSkill(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveSkill} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingSkill ? 'Update' : 'Add Skill'}</button>
            </div>
          </div>
        </div>
      )}

            {/* Bulk Upload Preview Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>📤 Bulk Upload Preview</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px' }}>
              {bulkPreview.length} rows found. Review before saving.
            </p>

            {bulkErrors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#fca5a5' }}>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>⚠️ {bulkErrors.length} row(s) need fixing before import. Every activity needs a Program, Term and Month.</div>
                {bulkErrors.slice(0, 20).map(e => (
                  <div key={e.row}>Row {e.row}{e.name ? ` (${e.name})` : ''}: {e.message}</div>
                ))}
                {bulkErrors.length > 20 && <div>…and {bulkErrors.length - 20} more</div>}
              </div>
            )}

            {/* Preview table */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Area', 'Skill', 'Outcomes', 'Activity', 'Program', 'Term', 'Month'].map(h => (
                      <th key={h} style={{ padding: '8px', textAlign: 'left', color: '#38bdf8', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: bulkErrors.some(e => e.row === row.rowNum) ? 'rgba(239,68,68,0.1)' : 'transparent' }}>
                      <td style={{ padding: '6px 8px', color: '#34d399' }}>{row.devArea}</td>
                      <td style={{ padding: '6px 8px', color: row.skillName ? '#fff' : 'transparent' }}>{row.skillName || '↑ same'}</td>
                      <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{row.outcomes.join('; ')}</td>
                      <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.7)' }}>{row.actName}</td>
                      <td style={{ padding: '6px 8px', color: '#a78bfa' }}>{row.program}</td>
                      <td style={{ padding: '6px 8px', color: '#38bdf8' }}>{row.term}</td>
                      <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.5)' }}>{row.month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowBulkModal(false); setBulkPreview([]); setBulkErrors([]) }} className="btn-secondary">Cancel</button>
              <button onClick={saveBulkUpload} disabled={bulkSaving || bulkErrors.length > 0} className="btn-primary" style={bulkErrors.length ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
                {bulkSaving ? '⏳ Saving...' : `✅ Import ${bulkPreview.length} rows`}
              </button>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: 'program', label: 'Program *', options: activityPrograms },
                { key: 'term', label: 'Term *', options: TERMS },
                { key: 'month', label: 'Month *', options: TERM_MONTHS[activityForm.term] || [] },
              ].map(f => (
                <div key={f.key} style={{ flex: 1 }}>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                  <select value={activityForm[f.key]} disabled={f.key === 'month' && !activityForm.term}
                    onChange={e => setActivityForm({ ...activityForm, [f.key]: e.target.value, ...(f.key === 'term' ? { month: '' } : {}) })}
                    style={inputStyle}>
                    <option value='' style={{ background: '#1e293b' }}>Select</option>
                    {f.options.map(o => <option key={o} value={o} style={{ background: '#1e293b' }}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
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
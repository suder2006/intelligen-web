'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const PROGRAMS = ['Playgroup', 'Nursery', 'LKG', 'UKG']
const TERMS = ['Term 1', 'Term 2', 'Term 3']
// Same term/month split as the teacher web progress page, so both write the same rows.
const TERM_MONTHS = {
  'Term 1': ['June', 'July', 'August', 'September'],
  'Term 2': ['October', 'November', 'December', 'January'],
  'Term 3': ['February', 'March', 'April', 'May'],
}
const thisYear = new Date().getFullYear()
const CURRENT_AY = `${thisYear}-${thisYear + 1}`
const ACADEMIC_YEARS = [-1, 0, 1].map(o => `${thisYear + o}-${thisYear + o + 1}`)

// progress_ratings stores the full word; Excel uses the single letter.
const RATINGS = [
  { value: 'emerging', code: 'E', label: '🌱 Emerging', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  { value: 'developing', code: 'D', label: '🌿 Developing', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' },
  { value: 'achieved', code: 'A', label: '🌟 Achieved', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
]
const CODE_TO_RATING = Object.fromEntries(RATINGS.map(r => [r.code, r.value]))
const RATING_CONFLICT = 'student_id,activity_id,academic_year,term,month'

// One Excel column per activity, labelled "Skill - Activity".
const indicatorHeader = (skill, act) => `${skill.name} - ${act.name}`

export default function AdminProgressPage() {
  const { schoolId, profile } = useSchool()
  const [program, setProgram] = useState(PROGRAMS[0])
  const [academicYear, setAcademicYear] = useState(CURRENT_AY)
  const [term, setTerm] = useState(TERMS[0])
  const [month, setMonth] = useState(TERM_MONTHS[TERMS[0]][0])
  const [view, setView] = useState('students') // 'students' | 'bulk'

  const [skills, setSkills] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [ratings, setRatings] = useState({}) // activity_id -> rating
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null) // { saved, skipped, errors: [{ row, name, message }] }

  useEffect(() => { if (schoolId) fetchSkillsAndStudents() }, [schoolId, program, academicYear])
  useEffect(() => { if (selectedStudent) fetchRatings() }, [selectedStudent, academicYear, term, month])

  const indicators = skills.flatMap(skill => (skill.skill_activities || []).map(act => ({ skill, act, header: indicatorHeader(skill, act) })))

  const fetchSkillsAndStudents = async () => {
    setLoading(true)
    setSelectedStudent(null)
    setRatings({})
    setUploadResult(null)
    const { data: maps } = await supabase.from('skill_program_map').select('skill_id').eq('program', program)
    const skillIds = [...new Set(maps?.map(m => m.skill_id) || [])]
    const [skillsRes, studentsRes] = await Promise.all([
      skillIds.length
        ? supabase.from('skill_masters').select('*, skill_activities(*)')
          .eq('academic_year', academicYear).eq('school_id', schoolId).in('id', skillIds).order('order_index')
        : Promise.resolve({ data: [] }),
      supabase.from('students').select('*')
        .eq('status', 'active').eq('program', program).eq('school_id', schoolId).order('full_name')
    ])
    const sortedSkills = (skillsRes.data || []).map(s => ({
      ...s,
      skill_activities: [...(s.skill_activities || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    }))
    setSkills(sortedSkills)
    setStudents(studentsRes.data || [])
    setLoading(false)
  }

  const fetchRatings = async () => {
    const { data } = await supabase.from('progress_ratings').select('activity_id, rating')
      .eq('student_id', selectedStudent.id)
      .eq('academic_year', academicYear)
      .eq('term', term)
      .eq('month', month)
    const map = {}
    ;(data || []).forEach(r => { map[r.activity_id] = r.rating })
    setRatings(map)
  }

  const changeTerm = (t) => { setTerm(t); setMonth(TERM_MONTHS[t][0]) }

  const toggleRating = (activityId, value) => {
    setRatings(prev => ({ ...prev, [activityId]: prev[activityId] === value ? null : value }))
  }

  // Admin marks go into the same table as teacher marks, with the admin as teacher_id.
  const buildRow = (studentId, activityId, rating) => ({
    student_id: studentId,
    activity_id: activityId,
    teacher_id: profile.id,
    academic_year: academicYear,
    term,
    month,
    rating,
    updated_at: new Date().toISOString()
  })

  const saveRatings = async () => {
    const rows = Object.entries(ratings).filter(([, r]) => r).map(([activityId, r]) => buildRow(selectedStudent.id, activityId, r))
    if (!rows.length) { alert('Mark at least one indicator first'); return }
    setSaving(true)
    const { error } = await supabase.from('progress_ratings').upsert(rows, { onConflict: RATING_CONFLICT })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setSavedMsg(`✓ Saved ${rows.length} rating${rows.length === 1 ? '' : 's'}`)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  // ---------- Bulk upload ----------

  const downloadTemplate = () => {
    if (!indicators.length) { alert(`No skill indicators set up for ${program} in ${academicYear}`); return }
    const header = ['Student Name', 'Student ID', ...indicators.map(i => i.header)]
    const rows = students.map(s => [s.full_name, s.id, ...indicators.map(() => '')])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [{ wch: 25 }, { wch: 38 }, ...indicators.map(i => ({ wch: Math.min(Math.max(i.header.length, 12), 40) }))]
    const help = XLSX.utils.aoa_to_sheet([
      ['Program', program], ['Academic Year', academicYear], ['Term', term], ['Month', month], [],
      ['Valid grades'], ['E', 'Emerging'], ['D', 'Developing'], ['A', 'Achieved'], ['(empty)', 'Not assessed - skipped'],
      [], ['Do not change the Student ID column or the indicator headers.']
    ])
    help['!cols'] = [{ wch: 16 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Progress')
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')
    XLSX.writeFile(wb, `progress_${program}_${term.replace(' ', '')}_${month}_${academicYear}.xlsx`)
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const sheet = wb.Sheets['Progress'] || wb.Sheets[wb.SheetNames[0]]
      const [header = [], ...dataRows] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      const byHeader = Object.fromEntries(indicators.map(i => [i.header.trim().toLowerCase(), i]))
      const columns = header.slice(2).map(h => byHeader[String(h).trim().toLowerCase()] || null)
      const unknown = header.slice(2).filter((h, i) => String(h).trim() && !columns[i])
      if (!columns.some(Boolean)) throw new Error(`None of the indicator columns match ${program} skills for ${academicYear}. Download a fresh template.`)

      const studentById = Object.fromEntries(students.map(s => [String(s.id), s]))
      const studentByName = {}
      students.forEach(s => {
        const key = s.full_name?.trim().toLowerCase()
        studentByName[key] = studentByName[key] === undefined ? s : null // null = ambiguous name
      })

      const toSave = []
      const errors = unknown.map(h => ({ row: 1, name: 'Header', message: `Unknown indicator column "${h}" ignored` }))
      let skipped = 0

      dataRows.forEach((row, idx) => {
        const rowNum = idx + 2
        const name = String(row[0] ?? '').trim()
        const id = String(row[1] ?? '').trim()
        const grades = row.slice(2)
        if (!name && !id && grades.every(g => !String(g).trim())) return

        const student = id ? studentById[id] : studentByName[name.toLowerCase()]
        if (!student) {
          errors.push({ row: rowNum, name: name || id, message: id ? `Student ID not found in ${program}` : 'Student not found (add the Student ID)' })
          return
        }

        const rowSaves = []
        const rowErrors = []
        grades.forEach((g, ci) => {
          const col = columns[ci]
          const code = String(g).trim().toUpperCase()
          if (!col) return
          if (!code) { skipped++; return }
          if (!CODE_TO_RATING[code]) { rowErrors.push(`"${String(g).trim()}" in "${col.header}"`); return }
          rowSaves.push(buildRow(student.id, col.act.id, CODE_TO_RATING[code]))
        })
        if (rowErrors.length) {
          errors.push({ row: rowNum, name: student.full_name, message: `Invalid grade ${rowErrors.join(', ')} - use E, D or A. Row not saved.` })
          return
        }
        toSave.push(...rowSaves)
      })

      let saved = 0
      for (let i = 0; i < toSave.length; i += 500) {
        const chunk = toSave.slice(i, i + 500)
        const { error } = await supabase.from('progress_ratings').upsert(chunk, { onConflict: RATING_CONFLICT })
        if (error) errors.push({ row: '-', name: 'Database', message: error.message })
        else saved += chunk.length
      }
      setUploadResult({ saved, skipped, errors })
      if (selectedStudent) fetchRatings()
    } catch (e) {
      setUploadResult({ saved: 0, skipped: 0, errors: [{ row: '-', name: 'File', message: e.message }] })
    }
    setUploading(false)
  }

  // ---------- Render ----------

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: "'DM Sans', sans-serif"
  }
  const labelStyle = { color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }

  const ratedCount = Object.values(ratings).filter(Boolean).length

  const renderStudentView = () => (
    <div className="layout">
      <div>
        <div className="section-label" style={{ marginBottom: '12px' }}>Students · {students.length}</div>
        {students.length === 0 ? (
          <div className="card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No active students in {program}</div>
        ) : students.map(s => (
          <button key={s.id} onClick={() => setSelectedStudent(s)}
            className={selectedStudent?.id === s.id ? 'student student-active' : 'student'}>
            {s.full_name}
          </button>
        ))}
      </div>

      <div>
        {!selectedStudent ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
            Select a student to mark progress
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px' }}>{selectedStudent.full_name}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                  {term} · {month} · {academicYear} · {ratedCount}/{indicators.length} rated
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {savedMsg && <span style={{ color: '#10b981', fontSize: '13px' }}>{savedMsg}</span>}
                <button onClick={saveRatings} disabled={saving} className="btn-primary">{saving ? '⏳ Saving...' : '💾 Save'}</button>
              </div>
            </div>

            {skills.length === 0 && (
              <div className="card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                No skills mapped to {program} for {academicYear}. Set them up on the Skills page.
              </div>
            )}

            {skills.map(skill => (
              <div key={skill.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontWeight: '700', color: '#a78bfa' }}>{skill.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    {skill.skill_activities.filter(a => ratings[a.id]).length}/{skill.skill_activities.length} rated
                  </div>
                </div>
                {skill.skill_activities.map(act => (
                  <div key={act.id} className="indicator">
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '14px' }}>{act.name}</div>
                      {act.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {RATINGS.map(r => {
                        const on = ratings[act.id] === r.value
                        return (
                          <button key={r.value} onClick={() => toggleRating(act.id, r.value)} className="rating-btn"
                            style={on ? { background: r.bg, color: r.color, borderColor: r.border } : undefined}>
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )

  const renderBulkView = () => (
    <div style={{ maxWidth: '900px' }}>
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontWeight: '700', marginBottom: '6px' }}>Bulk upload · {program} · {term} · {month} · {academicYear}</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
          Download the template, fill in <b style={{ color: '#fff' }}>E</b> (Emerging), <b style={{ color: '#fff' }}>D</b> (Developing) or <b style={{ color: '#fff' }}>A</b> (Achieved)
          for each indicator, then upload it. Empty cells are skipped. Uploaded grades go to the term and month selected above
          and overwrite any existing grade for the same indicator.
        </p>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '16px' }}>
          {students.length} students · {indicators.length} indicators
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={downloadTemplate} className="btn-secondary">📥 Download Template</button>
          <label className="btn-primary" style={{ display: 'inline-block', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '⏳ Uploading...' : '📤 Upload Excel'}
            <input type="file" accept=".xlsx,.xls" hidden disabled={uploading || !indicators.length}
              onChange={e => { handleUpload(e.target.files[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {uploadResult && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: uploadResult.errors.length ? '16px' : 0 }}>
            <div><div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>{uploadResult.saved}</div><div style={labelStyle}>grades saved</div></div>
            <div><div style={{ fontSize: '24px', fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{uploadResult.skipped}</div><div style={labelStyle}>empty cells skipped</div></div>
            <div><div style={{ fontSize: '24px', fontWeight: '700', color: uploadResult.errors.length ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>{uploadResult.errors.length}</div><div style={labelStyle}>errors</div></div>
          </div>
          {uploadResult.errors.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="err-table">
                <thead><tr><th>Row</th><th>Student</th><th>Problem</th></tr></thead>
                <tbody>
                  {uploadResult.errors.map((e, i) => (
                    <tr key={i}><td>{e.row}</td><td>{e.name}</td><td style={{ color: '#fca5a5' }}>{e.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; min-width: 0; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 10px; }
        .btn-primary { background: linear-gradient(135deg, #a78bfa, #818cf8); border: none; border-radius: 10px; padding: 10px 20px; color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-primary:disabled { opacity: 0.6; cursor: default; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .tab { padding: 8px 16px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.07); }
        .tab-active { background: rgba(167,139,250,0.15); color: #a78bfa; border-color: rgba(167,139,250,0.3); }
        .section-label { color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .layout { display: grid; grid-template-columns: 260px 1fr; gap: 20px; align-items: start; }
        .student { display: block; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 6px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.07); }
        .student:hover { background: rgba(255,255,255,0.07); }
        .student-active { background: rgba(167,139,250,0.15); color: #a78bfa; border-color: rgba(167,139,250,0.3); font-weight: 600; }
        .indicator { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); }
        .rating-btn { padding: 7px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .err-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .err-table th { text-align: left; color: rgba(255,255,255,0.4); font-weight: 600; font-size: 12px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .err-table td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
        @media (max-width: 1024px) { .layout { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📊 Progress</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
            Mark student skill progress. Shared with the teacher progress screens.
          </p>
        </div>

        {/* Program tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {PROGRAMS.map(p => (
            <button key={p} onClick={() => setProgram(p)} className={program === p ? 'tab tab-active' : 'tab'}>{p}</button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Academic Year</label>
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} style={selectStyle}>
              {ACADEMIC_YEARS.map(y => <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Term</label>
            <select value={term} onChange={e => changeTerm(e.target.value)} style={selectStyle}>
              {TERMS.map(t => <option key={t} value={t} style={{ background: '#1e293b' }}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} style={selectStyle}>
              {TERM_MONTHS[term].map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button onClick={() => setView('students')} className={view === 'students' ? 'tab tab-active' : 'tab'}>👶 Student List</button>
            <button onClick={() => setView('bulk')} className={view === 'bulk' ? 'tab tab-active' : 'tab'}>📥 Bulk Upload</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : view === 'students' ? renderStudentView() : renderBulkView()}
      </div>
    </div>
  )
}

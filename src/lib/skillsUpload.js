// Parsing and grouping for the admin Skills bulk upload (Excel template).
import { TERMS, ACADEMIC_MONTHS, termOfMonth } from './progressTerms.js'

export const TEMPLATE_HEADERS = ['Development Area', 'Skill Name', 'Skill Description', 'Learning Outcome', 'Activity Name', 'Activity Description', 'Program', 'Term', 'Month']
// Column positions in templates downloaded before Development Area / Learning Outcome existed.
const LEGACY_COLUMNS = { 'skill name': 0, 'skill description': 1, 'activity name': 2, 'activity description': 3, 'program': 4, 'term': 5, 'month': 6 }

const normalizeHeader = (h) => (h ?? '').toString().replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
export const splitOutcomes = (text) => text.split(';').map(o => o.trim()).filter(Boolean)

// "term 1", "1", "T1" -> "Term 1"
const normalizeTerm = (v) => {
  const exact = TERMS.find(t => t.toLowerCase() === v.toLowerCase())
  if (exact) return exact
  const n = v.match(/^(?:term|t)?\s*(\d)$/i)?.[1]
  return n ? TERMS.find(t => t === `Term ${n}`) || '' : ''
}
// "june", "Jun", "JUNE " -> "June"
const normalizeMonth = (v) => v.length >= 3 ? ACADEMIC_MONTHS.find(m => m.toLowerCase().startsWith(v.toLowerCase().slice(0, 3))) || '' : ''
// Matches the school's program names regardless of case; with no list, keeps the cell as typed.
const normalizeProgram = (v, programs) => programs.length ? programs.find(p => p.toLowerCase() === v.toLowerCase()) || '' : v

// rows: sheet_to_json(ws, { header: 1 }). Returns the parsed rows plus one error per row
// that can't be saved with a program, term and month.
export function parseSkillSheet(rows, programs = []) {
  const header = (rows[0] || []).map(normalizeHeader)
  const isLegacy = !header.includes('development area') && !header.includes('learning outcome')
  const idx = Object.fromEntries(TEMPLATE_HEADERS.map(h => {
    const key = h.toLowerCase()
    return [h, isLegacy ? (LEGACY_COLUMNS[key] ?? -1) : header.indexOf(key)]
  }))
  const missingColumns = ['Skill Name', 'Activity Name', 'Program', 'Term', 'Month'].filter(h => idx[h] < 0)
  if (missingColumns.length) return { rows: [], errors: [{ row: 1, message: `Missing column(s): ${missingColumns.join(', ')}` }] }

  const cell = (row, name) => idx[name] < 0 ? '' : (row[idx[name]] ?? '').toString().trim()
  const parsed = [], errors = []
  rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2 // Excel row number
    const raw = { program: cell(row, 'Program'), term: cell(row, 'Term'), month: cell(row, 'Month') }
    const entry = {
      rowNum,
      devArea: cell(row, 'Development Area'),
      skillName: cell(row, 'Skill Name'),
      skillDesc: cell(row, 'Skill Description'),
      outcomes: splitOutcomes(cell(row, 'Learning Outcome')),
      actName: cell(row, 'Activity Name'),
      actDesc: cell(row, 'Activity Description'),
      program: normalizeProgram(raw.program, programs),
      term: normalizeTerm(raw.term),
      month: normalizeMonth(raw.month)
    }
    if (!entry.skillName && !entry.actName) return
    const problems = []
    if (!entry.skillName) problems.push('Skill Name is empty')
    if (!entry.program) problems.push(raw.program ? `Program "${raw.program}" isn't one of: ${programs.join(', ')}` : 'Program is empty')
    if (!entry.term) problems.push(raw.term ? `Term "${raw.term}" isn't Term 1, 2 or 3` : 'Term is empty')
    if (!entry.month) problems.push(raw.month ? `Month "${raw.month}" isn't a month name` : 'Month is empty')
    else if (entry.term && termOfMonth(entry.month) !== entry.term) problems.push(`${entry.month} isn't in ${entry.term}`)
    if (problems.length) errors.push({ row: rowNum, name: entry.actName || entry.skillName, message: problems.join('; ') })
    parsed.push(entry)
  })
  return { rows: parsed, errors }
}

// One skill per name + program: the same skill name in two programs is two separate skills.
// Within a skill, activities are kept per term + month, each carrying its program/term/month,
// and each learning outcome carries its program/term/month (outcomes change month to month).
export function groupSkillRows(parsed) {
  const skillMap = {}
  parsed.forEach(row => {
    if (!row.skillName) return
    const key = `${row.skillName.toLowerCase()}|${row.program}`
    if (!skillMap[key]) {
      skillMap[key] = { name: row.skillName, program: row.program, desc: row.skillDesc, devArea: '', outcomes: [], activities: [], assignments: [] }
    }
    const entry = skillMap[key]
    if (row.devArea && !entry.devArea) entry.devArea = row.devArea
    row.outcomes.forEach(o => {
      if (!entry.outcomes.some(e => e.outcome.toLowerCase() === o.toLowerCase() && e.term === row.term && e.month === row.month)) {
        entry.outcomes.push({ outcome: o, program: row.program, term: row.term, month: row.month })
      }
    })
    if (row.actName && !entry.activities.some(a =>
      a.name.toLowerCase() === row.actName.toLowerCase() && a.term === row.term && a.month === row.month
    )) {
      entry.activities.push({ name: row.actName, description: row.actDesc, program: row.program, term: row.term, month: row.month, rowNum: row.rowNum })
    }
    if (row.program && row.term && row.month &&
      !entry.assignments.some(a => a.term === row.term && a.month === row.month)) {
      entry.assignments.push({ program: row.program, term: row.term, month: row.month })
    }
  })
  return Object.values(skillMap)
}

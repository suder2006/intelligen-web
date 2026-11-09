// Reads the bulk growth upload sheet (rows from XLSX sheet_to_json with
// header: 1) into preview rows. The server re-checks everything on save.
import { MEASURE_FIELDS, validateMeasurement } from './growth'

export const TEMPLATE_HEADERS = ['student_name', ...MEASURE_FIELDS.map(f => f.key)]

// Ignore case, leading/trailing spaces and repeated spaces.
export const normalizeName = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const headerKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')

// Accepted header spellings (letters only, lower case) for each column.
const HEADER_ALIASES = {
  student_name: ['studentname', 'name', 'student'],
  height_cm: ['heightcm', 'height'],
  weight_kg: ['weightkg', 'weight'],
  head_circumference_cm: ['headcircumferencecm', 'headcircumference', 'headcm', 'head'],
  chest_circumference_cm: ['chestcircumferencecm', 'chestcircumference', 'chestcm', 'chest'],
}

// aoa: sheet rows (first row = headers).
// students: active students of the selected program (names are matched only here).
// existing: the school's growth records (rejected ones are ignored for duplicates).
// date: YYYY-MM-DD applied to every row.
// Returns { error } for an unreadable sheet, otherwise { valid, errors, blank }:
//   valid:  [{ row, student, record, duplicateOf }]  duplicateOf = existing record or null
//   errors: [{ row, label, error }]
//   blank:  number of rows with no measurements (ignored)
export function parseGrowthSheet(aoa, { students, existing, date, program }) {
  if (!Array.isArray(aoa) || aoa.length === 0) return { error: 'The sheet is empty.' }

  const headers = aoa[0].map(headerKey)
  const col = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = headers.findIndex(h => aliases.includes(h))
    if (i !== -1) col[field] = i
  }
  if (col.student_name === undefined) return { error: 'No student_name column found. Use the downloaded template.' }
  if (!MEASURE_FIELDS.some(f => col[f.key] !== undefined)) {
    return { error: 'No measurement columns found (height_cm, weight_kg, ...). Use the downloaded template.' }
  }

  const byName = new Map()
  for (const s of students) {
    const key = normalizeName(s.full_name)
    byName.set(key, [...(byName.get(key) || []), s])
  }
  const existingByStudent = new Map()
  for (const r of existing) {
    if (r.status === 'rejected' || r.measurement_date !== date) continue
    if (!existingByStudent.has(r.student_id)) existingByStudent.set(r.student_id, r)
  }

  const cell = (r, field) => (col[field] === undefined ? '' : r[col[field]])

  // Rows with at least one measurement; others are ignored.
  const filled = []
  let blank = 0
  aoa.slice(1).forEach((r, i) => {
    const values = Object.fromEntries(MEASURE_FIELDS.map(f => [f.key, cell(r, f.key)]))
    if (!Object.values(values).some(v => String(v ?? '').trim() !== '')) { blank++; return }
    const name = String(cell(r, 'student_name') ?? '').trim()
    filled.push({ row: i + 2, name, key: normalizeName(name), values }) // row 1 = headers
  })

  const rowsByName = new Map()
  for (const f of filled) if (f.key) rowsByName.set(f.key, [...(rowsByName.get(f.key) || []), f.row])

  const valid = []
  const errors = []
  for (const f of filled) {
    const label = f.name || '—'
    if (!f.key) { errors.push({ row: f.row, label, error: 'No student name' }); continue }
    const sameName = rowsByName.get(f.key)
    if (sameName.length > 1) {
      errors.push({ row: f.row, label, error: `Name appears more than once in the file (rows ${sameName.join(', ')})` })
      continue
    }
    const found = byName.get(f.key) || []
    if (found.length === 0) { errors.push({ row: f.row, label, error: `No active student named "${f.name}" in ${program}` }); continue }
    if (found.length > 1) {
      errors.push({ row: f.row, label, error: `${found.length} students in ${program} are named "${f.name}"; use Add Entry for them` })
      continue
    }
    const student = found[0]
    const { record, error } = validateMeasurement({ ...f.values, measurement_date: date }, { dateOfBirth: student.date_of_birth })
    if (error) { errors.push({ row: f.row, label: student.full_name, error }); continue }
    valid.push({ row: f.row, student, record, duplicateOf: existingByStudent.get(student.id) || null })
  }

  errors.sort((a, b) => a.row - b.row)
  return { valid, errors, blank }
}

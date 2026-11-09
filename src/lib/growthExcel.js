// Reads the bulk growth upload sheet (rows from XLSX sheet_to_json with
// header: 1) into preview rows. The server re-checks everything on save.
import { MEASURE_FIELDS, validateMeasurement } from './growth'

export const TEMPLATE_HEADERS = ['student_name', 'student_id', 'date', ...MEASURE_FIELDS.map(f => f.key)]

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const headerKey = (s) => norm(s).replace(/[^a-z]/g, '')

// Accepted header spellings (letters only, lower case) for each column.
const HEADER_ALIASES = {
  student_name: ['studentname', 'name', 'student'],
  student_id: ['studentid', 'id', 'admissionno', 'admissionnumber'],
  measurement_date: ['date', 'measurementdate', 'dateyyyymmdd'],
  height_cm: ['heightcm', 'height'],
  weight_kg: ['weightkg', 'weight'],
  head_circumference_cm: ['headcircumferencecm', 'headcircumference', 'headcm', 'head'],
  chest_circumference_cm: ['chestcircumferencecm', 'chestcircumference', 'chestcm', 'chest'],
}

const pad = (n) => String(n).padStart(2, '0')

// Excel serial number, YYYY-MM-DD, or DD/MM/YYYY (also with - or .) -> YYYY-MM-DD.
// Anything else is returned as typed so validation reports it.
export function parseSheetDate(value) {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date && !isNaN(value)) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const s = String(value).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`
  return s
}

// aoa: sheet rows (first row = headers). students: the school's active students.
// existing: the school's growth records (rejected ones are ignored for duplicates).
// Returns { error } for an unreadable sheet, otherwise { valid, errors, blank }:
//   valid:  [{ row, student, record, duplicateOf }]  duplicateOf = existing record or null
//   errors: [{ row, label, error }]
//   blank:  number of rows with nothing filled in (ignored)
export function parseGrowthSheet(aoa, students, existing) {
  if (!Array.isArray(aoa) || aoa.length === 0) return { error: 'The sheet is empty.' }

  const headers = aoa[0].map(headerKey)
  const col = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = headers.findIndex(h => aliases.includes(h))
    if (i !== -1) col[field] = i
  }
  if (col.student_name === undefined && col.student_id === undefined) {
    return { error: 'No student_name or student_id column found. Use the downloaded template.' }
  }
  if (col.measurement_date === undefined) return { error: 'No date column found. Use the downloaded template.' }
  if (!MEASURE_FIELDS.some(f => col[f.key] !== undefined)) {
    return { error: 'No measurement columns found (height_cm, weight_kg, ...). Use the downloaded template.' }
  }

  const byCode = new Map()
  const byName = new Map()
  for (const s of students) {
    if (s.student_id) byCode.set(norm(s.student_id), s)
    const key = norm(s.full_name)
    byName.set(key, [...(byName.get(key) || []), s])
  }
  const existingByKey = new Map()
  for (const r of existing) {
    if (r.status === 'rejected') continue
    const key = `${r.student_id}|${r.measurement_date}`
    if (!existingByKey.has(key)) existingByKey.set(key, r)
  }

  const cell = (r, field) => (col[field] === undefined ? '' : r[col[field]])
  const valid = []
  const errors = []
  const seen = new Map()
  let blank = 0

  aoa.slice(1).forEach((r, i) => {
    const row = i + 2 // Excel row number (row 1 = headers)
    const name = String(cell(r, 'student_name') ?? '').trim()
    const code = String(cell(r, 'student_id') ?? '').trim()
    const input = { measurement_date: parseSheetDate(cell(r, 'measurement_date')) }
    for (const f of MEASURE_FIELDS) input[f.key] = cell(r, f.key)

    const filled = [input.measurement_date, ...MEASURE_FIELDS.map(f => input[f.key])].some(v => String(v ?? '').trim() !== '')
    if (!filled) { blank++; return }
    const label = name || code || '—'

    let student
    if (code) {
      student = byCode.get(norm(code))
      if (!student) { errors.push({ row, label, error: `Unknown Student ID "${code}"` }); return }
    } else if (name) {
      const found = byName.get(norm(name)) || []
      if (found.length === 0) { errors.push({ row, label, error: `Unknown student "${name}"` }); return }
      if (found.length > 1) { errors.push({ row, label, error: `More than one student named "${name}"; add the Student ID` }); return }
      student = found[0]
    } else {
      errors.push({ row, label, error: 'No student name or Student ID' }); return
    }

    const { record, error } = validateMeasurement(input, { dateOfBirth: student.date_of_birth })
    if (error) { errors.push({ row, label: student.full_name, error }); return }

    const key = `${student.id}|${record.measurement_date}`
    if (seen.has(key)) { errors.push({ row, label: student.full_name, error: `Same student and date as row ${seen.get(key)}` }); return }
    seen.set(key, row)
    valid.push({ row, student, record, duplicateOf: existingByKey.get(key) || null })
  })

  return { valid, errors, blank }
}

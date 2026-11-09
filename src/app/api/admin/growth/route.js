import { NextResponse } from 'next/server'
import { authorizeAdmin, serviceSupabase } from '@/lib/adminAuth'
import { validateMeasurement } from '@/lib/growth'

// Missing edited_by / edited_at columns (migration not run yet).
const isMissingColumn = (error) => error && (error.code === 'PGRST204' || error.code === '42703')

const MAX_BULK_ROWS = 500
const DUPLICATE_ERROR = 'This student already has a pending or approved record on this date. Edit that record instead.'

// Update a record, recording who edited it when the audit columns exist.
async function updateRecord(supabase, id, fields, userId, now) {
  const run = (f) => supabase.from('physical_growth').update(f).eq('id', id).select('*').single()
  let { data, error } = await run({ ...fields, edited_by: userId, edited_at: now })
  if (isMissingColumn(error)) ({ data, error } = await run(fields))
  return { data, error }
}

// All admin writes to physical_growth. Admins of the records' school only
// (super admins: any school). Runs with the service role, so RLS can't block a
// write silently; every failure is returned as an error.
//
// POST { action: 'approve', ids: [...] }
//   Approves pending records. Returns { approved: n }.
// POST { action: 'edit', id, values: { measurement_date, height_cm, weight_kg,
//        head_circumference_cm, chest_circumference_cm }, approve?: boolean }
//   Updates the values and date, recomputes BMI and keeps the current status
//   (an approved record stays approved). approve: true also approves a pending record.
// POST { action: 'reject', id }
//   Rejects a pending record. 409 if it is no longer pending.
// POST { action: 'delete', id }
//   Permanently deletes a record (any status).
// POST { action: 'create', school_id, student_id, status: 'pending' | 'approved', values }
//   Adds one record measured by the admin. 409 if the student already has a
//   pending or approved record on that date.
// POST { action: 'bulk', school_id, status, duplicates: 'skip' | 'overwrite',
//        rows: [{ row, student_id, measurement_date, height_cm, ... }] }
//   Adds many records. A row whose student already has a pending or approved
//   record on that date is skipped, or overwrites that record's values
//   (approved records stay approved). Returns { saved, overwritten, skipped,
//   errors: [{ row, error }] }; rows with errors are not saved.
const ACTIONS = ['approve', 'edit', 'reject', 'delete', 'create', 'bulk']

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
    }
    if (action === 'create' || action === 'bulk') return await saveEntries(request, body)

    const ids = action === 'approve' ? body.ids : [body.id]
    if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => !id)) {
      return NextResponse.json({ error: 'No records given' }, { status: 400 })
    }

    const { data: rows, error: loadError } = await serviceSupabase().from('physical_growth')
      .select('id, school_id, status, students(date_of_birth)').in('id', ids)
    if (loadError) throw loadError
    if (!rows || rows.length !== new Set(ids).size) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    const schoolIds = [...new Set(rows.map(r => r.school_id))]
    if (schoolIds.length !== 1) return NextResponse.json({ error: 'Records belong to different schools' }, { status: 400 })

    const auth = await authorizeAdmin(request, schoolIds[0])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { supabase, user } = auth
    const now = new Date().toISOString()
    const approval = { status: 'approved', approved_by: user.id, approved_at: now }

    if (action === 'approve') {
      const { data, error } = await supabase.from('physical_growth')
        .update(approval).in('id', ids).eq('status', 'pending').select('id')
      if (error) throw error
      return NextResponse.json({ success: true, approved: data.length })
    }

    if (action === 'reject') {
      const { data, error } = await supabase.from('physical_growth')
        .update({ status: 'rejected' }).eq('id', ids[0]).eq('status', 'pending').select('id')
      if (error) throw error
      if (data.length === 0) return NextResponse.json({ error: 'Record is no longer pending' }, { status: 409 })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { data, error } = await supabase.from('physical_growth')
        .delete().eq('id', ids[0]).select('id')
      if (error) throw error
      if (data.length === 0) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    // Edit
    const { record, error: invalid } = validateMeasurement(body.values || {}, { dateOfBirth: rows[0].students?.date_of_birth })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    const update = { ...record }
    if (body.approve && rows[0].status === 'pending') Object.assign(update, approval)

    const { data, error } = await updateRecord(supabase, ids[0], update, user.id, now)
    if (error) throw error
    return NextResponse.json({ success: true, record: data })
  } catch (error) {
    console.error('Growth admin error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// create (one entry) and bulk (Excel upload)
async function saveEntries(request, body) {
  const single = body.action === 'create'
  const { school_id: schoolId, status } = body
  if (status !== 'pending' && status !== 'approved') {
    return NextResponse.json({ error: "status must be 'pending' or 'approved'" }, { status: 400 })
  }
  const duplicates = single ? 'reject' : body.duplicates
  if (!['reject', 'skip', 'overwrite'].includes(duplicates)) {
    return NextResponse.json({ error: "duplicates must be 'skip' or 'overwrite'" }, { status: 400 })
  }
  const entries = single
    ? [{ row: 1, student_id: body.student_id, ...(body.values || {}) }]
    : body.rows
  if (!Array.isArray(entries) || entries.length === 0) return NextResponse.json({ error: 'No rows given' }, { status: 400 })
  if (entries.length > MAX_BULK_ROWS) return NextResponse.json({ error: `At most ${MAX_BULK_ROWS} rows per upload` }, { status: 400 })

  const auth = await authorizeAdmin(request, schoolId)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase, user } = auth
  const now = new Date().toISOString()
  const approval = { approved_by: user.id, approved_at: now }

  const studentIds = [...new Set(entries.map(e => e.student_id).filter(Boolean))]
  let students = []
  if (studentIds.length) {
    const { data, error } = await supabase.from('students')
      .select('id, date_of_birth').eq('school_id', schoolId).in('id', studentIds)
    if (error) throw error
    students = data
  }
  const studentById = new Map(students.map(s => [s.id, s]))

  const errors = []
  const valid = []
  const seen = new Map()
  for (const e of entries) {
    const student = studentById.get(e.student_id)
    if (!student) { errors.push({ row: e.row, error: 'Student not found in this school' }); continue }
    const { record, error } = validateMeasurement(e, { dateOfBirth: student.date_of_birth })
    if (error) { errors.push({ row: e.row, error }); continue }
    const key = `${e.student_id}|${record.measurement_date}`
    if (seen.has(key)) { errors.push({ row: e.row, error: `Same student and date as row ${seen.get(key)}` }); continue }
    seen.set(key, e.row)
    valid.push({ row: e.row, key, studentId: e.student_id, record })
  }

  // Existing pending/approved records on the same student + date (rejected ones don't count)
  const existing = new Map()
  if (valid.length) {
    const { data, error } = await supabase.from('physical_growth')
      .select('id, student_id, measurement_date, status, created_at')
      .eq('school_id', schoolId).neq('status', 'rejected')
      .in('student_id', [...new Set(valid.map(v => v.studentId))])
      .in('measurement_date', [...new Set(valid.map(v => v.record.measurement_date))])
      .order('created_at', { ascending: false })
    if (error) throw error
    for (const r of data) {
      const key = `${r.student_id}|${r.measurement_date}`
      if (!existing.has(key)) existing.set(key, r)
    }
  }

  const toInsert = []
  const toOverwrite = []
  let skipped = 0
  for (const v of valid) {
    const match = existing.get(v.key)
    if (!match) toInsert.push(v)
    else if (duplicates === 'skip') skipped++
    else if (duplicates === 'overwrite') toOverwrite.push({ ...v, existing: match })
    else errors.push({ row: v.row, error: DUPLICATE_ERROR })
  }

  if (single && errors.length) {
    return NextResponse.json({ error: errors[0].error }, { status: errors[0].error === DUPLICATE_ERROR ? 409 : 400 })
  }

  let saved = 0
  if (toInsert.length) {
    const { data, error } = await supabase.from('physical_growth').insert(toInsert.map(v => ({
      ...v.record,
      student_id: v.studentId,
      school_id: schoolId,
      measured_by: user.id,
      status,
      ...(status === 'approved' ? approval : {}),
    }))).select('id')
    if (error) throw error
    saved = data.length
  }

  let overwritten = 0
  for (const v of toOverwrite) {
    const fields = { ...v.record }
    if (status === 'approved' && v.existing.status === 'pending') Object.assign(fields, { status: 'approved', ...approval })
    const { error } = await updateRecord(supabase, v.existing.id, fields, user.id, now)
    if (error) errors.push({ row: v.row, error: `Overwrite failed: ${error.message}` })
    else overwritten++
  }

  errors.sort((a, b) => a.row - b.row)
  return NextResponse.json({ success: true, saved, overwritten, skipped, errors })
}

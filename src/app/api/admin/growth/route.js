import { NextResponse } from 'next/server'
import { authorizeAdmin, serviceSupabase } from '@/lib/adminAuth'

// Same thresholds as the teacher entry screen and parent app.
const bmiCategory = (bmi) => {
  if (!bmi) return null
  if (bmi < 14) return 'Underweight'
  if (bmi < 18) return 'Normal'
  if (bmi < 20) return 'Overweight'
  return 'Obese'
}

const VALUE_FIELDS = ['height_cm', 'weight_kg', 'head_circumference_cm', 'chest_circumference_cm']

// Empty -> null, otherwise a positive number. Returns undefined when invalid.
const parseValue = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : undefined
}

// Missing edited_by / edited_at columns (migration not run yet).
const isMissingColumn = (error) => error && (error.code === 'PGRST204' || error.code === '42703')

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
// Admins of the records' school only (super admins: any school). Runs with the
// service role, so RLS on physical_growth can't block the update silently.
const ACTIONS = ['approve', 'edit', 'reject', 'delete']

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
    }
    const ids = action === 'approve' ? body.ids : [body.id]
    if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => !id)) {
      return NextResponse.json({ error: 'No records given' }, { status: 400 })
    }

    const { data: rows, error: loadError } = await serviceSupabase().from('physical_growth')
      .select('id, school_id, status').in('id', ids)
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
    const values = body.values || {}
    const update = {}
    for (const f of VALUE_FIELDS) {
      const n = parseValue(values[f])
      if (n === undefined) return NextResponse.json({ error: `Invalid value for ${f}` }, { status: 400 })
      update[f] = n
    }
    if (!update.height_cm && !update.weight_kg) {
      return NextResponse.json({ error: 'Enter at least height or weight' }, { status: 400 })
    }
    const date = values.measurement_date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || isNaN(new Date(date + 'T12:00:00'))) {
      return NextResponse.json({ error: 'Invalid measurement date' }, { status: 400 })
    }
    update.measurement_date = date

    const bmi = update.height_cm && update.weight_kg
      ? Number((update.weight_kg / ((update.height_cm / 100) ** 2)).toFixed(1))
      : null
    update.bmi = bmi
    update.bmi_category = bmiCategory(bmi)

    if (body.approve && rows[0].status === 'pending') Object.assign(update, approval)

    const run = (fields) => supabase.from('physical_growth').update(fields).eq('id', ids[0]).select('*').single()
    let { data, error } = await run({ ...update, edited_by: user.id, edited_at: now })
    if (isMissingColumn(error)) ({ data, error } = await run(update))
    if (error) throw error

    return NextResponse.json({ success: true, record: data })
  } catch (error) {
    console.error('Growth admin error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

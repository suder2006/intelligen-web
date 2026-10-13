export const dynamic = 'force-dynamic'
import { authorizeAdmin } from '@/lib/adminAuth'

const PROGRAM_ORDER = ['Playgroup', 'Nursery', 'LKG', 'UKG']
const programRank = (p) => { const i = PROGRAM_ORDER.indexOf(p); return i < 0 ? PROGRAM_ORDER.length : i }

// Age range per program, used by the Age Check on the progress pages. Lists every program in
// curriculum_masters plus any that only have a saved range; missing ranges come back as null.
export async function GET(request) {
  try {
    const schoolId = new URL(request.url).searchParams.get('school_id')
    const auth = await authorizeAdmin(request, schoolId)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase } = auth

    const [{ data: masters, error: mErr }, { data: settings, error: sErr }] = await Promise.all([
      supabase.from('curriculum_masters').select('value').eq('type', 'program').eq('school_id', schoolId),
      supabase.from('program_settings').select('program, min_age_months, max_age_months, updated_at')
        .eq('school_id', schoolId).order('updated_at', { ascending: true }),
    ])
    if (mErr || sErr) throw new Error((mErr || sErr).message)

    const byProgram = {}
    settings.forEach(s => { byProgram[s.program] = s }) // newest wins
    const names = [...new Set([...masters.map(m => m.value).filter(Boolean), ...settings.map(s => s.program)])]
      .sort((a, b) => programRank(a) - programRank(b) || a.localeCompare(b))

    return Response.json({
      programs: names.map(program => ({
        program,
        min_age_months: byProgram[program]?.min_age_months ?? null,
        max_age_months: byProgram[program]?.max_age_months ?? null,
      })),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// { school_id, settings: [{ program, min_age_months, max_age_months }] }
export async function POST(request) {
  try {
    const { school_id, settings } = await request.json()
    const auth = await authorizeAdmin(request, school_id)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase } = auth
    if (!Array.isArray(settings)) return Response.json({ error: 'settings must be a list' }, { status: 400 })

    // Rows left completely blank are skipped; half-filled or invalid ones are an error.
    const toSave = []
    for (const s of settings) {
      const blank = (v) => v === '' || v == null
      if (!s?.program) continue
      if (blank(s.min_age_months) && blank(s.max_age_months)) continue
      const min = Number(s.min_age_months)
      const max = Number(s.max_age_months)
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 240 || max <= min) {
        return Response.json({ error: `${s.program}: enter whole months, with max greater than min` }, { status: 400 })
      }
      toSave.push({ program: s.program, min_age_months: min, max_age_months: max })
    }

    const updated_at = new Date().toISOString()
    for (const s of toSave) {
      const { data: existing, error } = await supabase.from('program_settings').select('id')
        .eq('school_id', school_id).eq('program', s.program)
      if (error) throw new Error(error.message)
      const { error: writeError } = existing.length
        ? await supabase.from('program_settings').update({ ...s, updated_at }).in('id', existing.map(r => r.id))
        : await supabase.from('program_settings').insert({ ...s, school_id, updated_at })
      if (writeError) throw new Error(writeError.message)
    }
    return Response.json({ success: true, saved: toSave.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

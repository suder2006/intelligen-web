import { authorizeStaff } from '@/lib/adminAuth'

// GET handler for saved progress analyses (progress_insights, age_appropriate_insights):
//   ?school_id=..&id=..        → one analysis in full
//   ?school_id=..[&program=..] → recent analyses, with just the summary out of the data column
// Admins see every program; teachers/staff only the programs assigned to them, and never
// the AI insights, which are admin only.
export async function getAnalyses(request, { table, dataColumn, periodColumns }) {
  try {
    const params = new URL(request.url).searchParams
    const schoolId = params.get('school_id')
    const auth = await authorizeStaff(request, schoolId)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase, programs } = auth
    const isAdmin = !programs
    const allowed = (program) => isAdmin || programs.includes(program)

    const id = params.get('id')
    if (id) {
      const { data, error } = await supabase.from(table).select('*')
        .eq('id', id).eq('school_id', schoolId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data || !allowed(data.program)) return Response.json({ error: 'Analysis not found' }, { status: 404 })
      if (isAdmin) return Response.json(data)
      const { ai_insights, ai_recommendations, generated_at, ...analysis } = data
      return Response.json(analysis)
    }

    let query = supabase.from(table)
      .select(`id, program, academic_year, term, ${periodColumns}, created_at, generated_at, ai_insights, summary:${dataColumn}->summary`)
      .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(30)
    const program = params.get('program')
    if (program && !allowed(program)) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (program) query = query.eq('program', program)
    else if (!isAdmin) query = query.in('program', programs)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return Response.json({
      analyses: data.map(({ ai_insights, generated_at, ...a }) => (isAdmin ? { ...a, generated_at, has_insights: !!ai_insights } : a)),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

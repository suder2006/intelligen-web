export const dynamic = 'force-dynamic'
import { authorizeAdmin, authorizeStaff } from '@/lib/adminAuth'
import { ACADEMIC_MONTHS, termOfMonth } from '@/lib/progressTerms'

const LEVEL = { emerging: 0, developing: 1, achieved: 2 }
const PAGE = 1000 // PostgREST returns at most 1000 rows per request
const ID_CHUNK = 100 // keeps the student_id=in.(...) filter well under URL limits

// achieved→developing / developing→emerging = mild, achieved→emerging = severe;
// emerging→developing / developing→achieved = good, emerging→achieved = excellent.
function classify(from, to) {
  const diff = LEVEL[to] - LEVEL[from]
  if (diff === 0) return { type: 'stable', severity: 'stable' }
  if (diff < 0) return { type: 'regression', severity: diff === -1 ? 'mild' : 'severe' }
  return { type: 'improvement', severity: diff === 1 ? 'good' : 'excellent' }
}

// Every rating for these students in the given months, as { month: { studentId: { activityId: rating } } }.
async function fetchRatings(supabase, studentIds, academicYear, months) {
  const byMonth = Object.fromEntries(months.map(m => [m, {}]))
  for (let i = 0; i < studentIds.length; i += ID_CHUNK) {
    const ids = studentIds.slice(i, i + ID_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('progress_ratings')
        .select('student_id, activity_id, term, month, rating')
        .in('student_id', ids).eq('academic_year', academicYear).in('month', months)
        .order('id').range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      data.forEach(r => {
        // Rows always carry the term their month belongs to; ignore any that don't.
        if (!LEVEL.hasOwnProperty(r.rating) || r.term !== termOfMonth(r.month)) return
        ;(byMonth[r.month][r.student_id] ||= {})[r.activity_id] = r.rating
      })
      if (data.length < PAGE) break
    }
  }
  return byMonth
}

// Per student per activity rated in both months.
function compare(fromRatings, toRatings) {
  const out = []
  Object.entries(toRatings).forEach(([studentId, acts]) => {
    Object.entries(acts).forEach(([activityId, to]) => {
      const from = fromRatings[studentId]?.[activityId]
      if (from) out.push({ student_id: studentId, activity_id: activityId, from_rating: from, to_rating: to, ...classify(from, to) })
    })
  })
  return out
}

async function fetchActivities(supabase, activityIds) {
  const map = {}
  for (let i = 0; i < activityIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase.from('skill_activities')
      .select('id, name, skill_masters(name, development_area)')
      .in('id', activityIds.slice(i, i + ID_CHUNK))
    if (error) throw new Error(error.message)
    data.forEach(a => { map[a.id] = a })
  }
  return map
}

export async function POST(request) {
  try {
    const { school_id, program, academic_year, term, from_month, to_month } = await request.json()
    if (!program || !academic_year || !from_month || !to_month) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const auth = await authorizeAdmin(request, school_id)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase, user } = auth

    const fromIdx = ACADEMIC_MONTHS.indexOf(from_month)
    const toIdx = ACADEMIC_MONTHS.indexOf(to_month)
    if (fromIdx < 0 || toIdx < 0) return Response.json({ error: 'Unknown month' }, { status: 400 })
    if (toIdx <= fromIdx) return Response.json({ error: 'To month must come after From month' }, { status: 400 })
    // The period before from_month, for spotting regressions two periods running. None before June.
    const prevMonth = fromIdx > 0 ? ACADEMIC_MONTHS[fromIdx - 1] : null

    const { data: students, error: studentsError } = await supabase.from('students')
      .select('id, full_name').eq('school_id', school_id).eq('program', program).eq('status', 'active')
    if (studentsError) throw new Error(studentsError.message)
    const studentById = Object.fromEntries(students.map(s => [s.id, s]))

    const months = [from_month, to_month, ...(prevMonth ? [prevMonth] : [])]
    const ratings = await fetchRatings(supabase, students.map(s => s.id), academic_year, months)

    const current = compare(ratings[from_month], ratings[to_month])
    const previous = prevMonth ? compare(ratings[prevMonth], ratings[from_month]) : []

    // Students who also regressed from prevMonth to from_month, and on which activities.
    const prevRegressed = {}
    previous.filter(c => c.type === 'regression').forEach(c => {
      (prevRegressed[c.student_id] ||= new Set()).add(c.activity_id)
    })

    const activities = await fetchActivities(supabase, [...new Set(current.map(c => c.activity_id))])

    const typeOrder = { regression: 0, improvement: 1, stable: 2 }
    const rows = current.map(c => {
      const act = activities[c.activity_id]
      const consecutive = c.type === 'regression' && !!prevRegressed[c.student_id]
      return {
        ...c,
        student_name: studentById[c.student_id]?.full_name || 'Unknown',
        development_area: act?.skill_masters?.development_area?.trim() || '',
        skill_area: act?.skill_masters?.name || '',
        indicator: act?.name || '',
        consecutive,
        // The student regressed on this exact indicator last period too.
        same_indicator: consecutive && prevRegressed[c.student_id].has(c.activity_id),
      }
    }).sort((a, b) => typeOrder[a.type] - typeOrder[b.type]
      || a.student_name.localeCompare(b.student_name)
      || a.development_area.localeCompare(b.development_area)
      || a.skill_area.localeCompare(b.skill_area))

    // A student counts as regressed/improved if any indicator moved that way (a student can be both);
    // stable means every compared indicator stayed the same.
    const studentsWith = (type) => new Set(rows.filter(r => r.type === type).map(r => r.student_id))
    const regressed = studentsWith('regression')
    const improved = studentsWith('improvement')
    const compared = new Set(rows.map(r => r.student_id))
    const stable = [...compared].filter(id => !regressed.has(id) && !improved.has(id))

    const consecutive = [...regressed].filter(id => prevRegressed[id]).map(id => {
      const studentRows = rows.filter(r => r.student_id === id && r.type === 'regression')
      return {
        student_id: id,
        student_name: studentById[id]?.full_name || 'Unknown',
        skill_areas: [...new Set(studentRows.map(r => r.skill_area).filter(Boolean))],
        development_areas: [...new Set(studentRows.map(r => r.development_area).filter(Boolean))],
        regressions: studentRows.length,
        same_indicators: studentRows.filter(r => r.same_indicator).length,
      }
    }).sort((a, b) => a.student_name.localeCompare(b.student_name))

    const regression_data = {
      prev_month: prevMonth,
      summary: {
        students_compared: compared.size,
        regressed_students: regressed.size,
        improved_students: improved.size,
        stable_students: stable.length,
        consecutive_students: consecutive.length,
        regressions: rows.filter(r => r.type === 'regression').length,
        severe_regressions: rows.filter(r => r.severity === 'severe').length,
        improvements: rows.filter(r => r.type === 'improvement').length,
        stable: rows.filter(r => r.type === 'stable').length,
      },
      consecutive,
      rows,
    }

    const { data: saved, error: saveError } = await supabase.from('progress_insights').insert({
      school_id, program, academic_year,
      term: term || termOfMonth(to_month),
      from_month, to_month, regression_data,
      generated_by: user.id,
    }).select('id, created_at').single()
    if (saveError) throw new Error(saveError.message)

    return Response.json({
      id: saved.id, created_at: saved.created_at,
      school_id, program, academic_year, term: term || termOfMonth(to_month), from_month, to_month,
      regression_data, ai_insights: null, ai_recommendations: null,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// ?school_id=..&id=..  → one saved analysis in full
// ?school_id=..[&program=..] → recent analyses, without the bulky regression rows
// Admins see every program; teachers/staff only the programs assigned to them (read only),
// and never the AI insights, which are admin only.
export async function GET(request) {
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
      const { data, error } = await supabase.from('progress_insights').select('*')
        .eq('id', id).eq('school_id', schoolId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data || !allowed(data.program)) return Response.json({ error: 'Analysis not found' }, { status: 404 })
      if (isAdmin) return Response.json(data)
      const { ai_insights, ai_recommendations, generated_at, ...analysis } = data
      return Response.json(analysis)
    }

    let query = supabase.from('progress_insights')
      .select('id, program, academic_year, term, from_month, to_month, created_at, generated_at, ai_insights, summary:regression_data->summary')
      .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(30)
    const program = params.get('program')
    if (program && !allowed(program)) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (program) query = query.eq('program', program)
    else if (programs) query = query.in('program', programs)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return Response.json({
      analyses: data.map(({ ai_insights, generated_at, ...a }) => (isAdmin ? { ...a, generated_at, has_insights: !!ai_insights } : a)),
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

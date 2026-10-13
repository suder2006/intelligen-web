export const dynamic = 'force-dynamic'
import { authorizeAdmin } from '@/lib/adminAuth'
import { getAnalyses } from '@/lib/analysisGet'
import { ACADEMIC_MONTHS, termOfMonth } from '@/lib/progressTerms'
import { RATING_LEVEL as LEVEL, fetchRatings, fetchActivities, activityLabels } from '@/lib/progressData'

// achieved→developing / developing→emerging = mild, achieved→emerging = severe;
// emerging→developing / developing→achieved = good, emerging→achieved = excellent.
function classify(from, to) {
  const diff = LEVEL[to] - LEVEL[from]
  if (diff === 0) return { type: 'stable', severity: 'stable' }
  if (diff < 0) return { type: 'regression', severity: diff === -1 ? 'mild' : 'severe' }
  return { type: 'improvement', severity: diff === 1 ? 'good' : 'excellent' }
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
        ...activityLabels(act),
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

export const GET = (request) => getAnalyses(request, {
  table: 'progress_insights', dataColumn: 'regression_data', periodColumns: 'from_month, to_month',
})

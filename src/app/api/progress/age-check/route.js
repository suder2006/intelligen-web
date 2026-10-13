export const dynamic = 'force-dynamic'
import { authorizeAdmin } from '@/lib/adminAuth'
import { getAnalyses } from '@/lib/analysisGet'
import { ACADEMIC_MONTHS, termOfMonth } from '@/lib/progressTerms'
import { fetchRatings, fetchActivities, activityLabels } from '@/lib/progressData'

// Whole months between date_of_birth ('YYYY-MM-DD') and ref.
function ageInMonths(dob, ref) {
  const [y, m, d] = dob.split('-').map(Number)
  let months = (ref.getUTCFullYear() - y) * 12 + (ref.getUTCMonth() + 1 - m)
  if (ref.getUTCDate() < d) months--
  return months
}

export async function POST(request) {
  try {
    const { school_id, program, academic_year, term, month } = await request.json()
    if (!program || !academic_year || !month) return Response.json({ error: 'Missing required fields' }, { status: 400 })
    if (!ACADEMIC_MONTHS.includes(month) || !/^\d{4}-\d{4}$/.test(academic_year)) {
      return Response.json({ error: 'Unknown month or academic year' }, { status: 400 })
    }
    const auth = await authorizeAdmin(request, school_id)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase, user } = auth

    const { data: students, error: studentsError } = await supabase.from('students')
      .select('id, full_name, date_of_birth').eq('school_id', school_id).eq('program', program).eq('status', 'active')
      .order('full_name')
    if (studentsError) throw new Error(studentsError.message)

    const today = new Date() // age is shown for reference only; it doesn't affect flagging
    const ratings = (await fetchRatings(supabase, students.map(s => s.id), academic_year, [month]))[month]
    const activities = await fetchActivities(supabase, [...new Set(Object.values(ratings).flatMap(r => Object.keys(r)))])
    const indicator = (activityId) => ({ activity_id: activityId, ...activityLabels(activities[activityId]) })

    // Every month's indicators are expected to be Achieved by every child in the program.
    // high: any indicator still Emerging; medium: Developing but none Emerging; on_track: all Achieved.
    const results = students.map(s => {
      const studentRatings = Object.entries(ratings[s.id] || {})
      const emerging = studentRatings.filter(([, r]) => r === 'emerging').map(([id]) => indicator(id))
      const developing = studentRatings.filter(([, r]) => r === 'developing').map(([id]) => indicator(id))
      let status
      if (!studentRatings.length) status = 'not_assessed'
      else if (emerging.length) status = 'high'
      else if (developing.length) status = 'medium'
      else status = 'on_track'
      return {
        student_id: s.id,
        student_name: s.full_name,
        date_of_birth: s.date_of_birth,
        age_months: s.date_of_birth ? ageInMonths(s.date_of_birth, today) : null,
        status,
        rated: studentRatings.length,
        achieved: studentRatings.filter(([, r]) => r === 'achieved').length,
        emerging,
        developing,
      }
    })
    const unachieved = (r) => r.emerging.length + r.developing.length
    const byConcern = (a, b) => b.emerging.length - a.emerging.length || unachieved(b) - unachieved(a) || a.student_name.localeCompare(b.student_name)
    const ofStatus = (status) => results.filter(r => r.status === status)

    const analysis_data = {
      reference_date: today.toISOString().slice(0, 10),
      summary: {
        total_students: results.length,
        high_concern: ofStatus('high').length,
        medium_concern: ofStatus('medium').length,
        on_track: ofStatus('on_track').length,
        not_assessed: ofStatus('not_assessed').length,
      },
      high: ofStatus('high').sort(byConcern),
      medium: ofStatus('medium').sort(byConcern),
      on_track: ofStatus('on_track'),
      not_assessed: ofStatus('not_assessed'),
    }

    const row = { school_id, program, academic_year, term: term || termOfMonth(month), month, analysis_data, generated_by: user.id }
    const { data: saved, error: saveError } = await supabase.from('age_appropriate_insights')
      .insert(row).select('id, created_at').single()
    if (saveError) throw new Error(saveError.message)

    return Response.json({ ...row, id: saved.id, created_at: saved.created_at, ai_insights: null, ai_recommendations: null })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export const GET = (request) => getAnalyses(request, {
  table: 'age_appropriate_insights', dataColumn: 'analysis_data', periodColumns: 'month',
})

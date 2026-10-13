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

    const { data: settings, error: settingError } = await supabase.from('program_settings')
      .select('min_age_months, max_age_months').eq('school_id', school_id).eq('program', program)
      .order('updated_at', { ascending: false }).limit(1)
    if (settingError) throw new Error(settingError.message)
    const setting = settings[0]
    if (!setting || setting.min_age_months == null || setting.max_age_months == null) {
      return Response.json({ error: `No age range set for ${program}. Add it under Settings → Program Age Ranges.` }, { status: 400 })
    }
    const min = setting.min_age_months
    const max = setting.max_age_months
    const upperThreshold = min + (max - min) / 2

    const { data: students, error: studentsError } = await supabase.from('students')
      .select('id, full_name, date_of_birth').eq('school_id', school_id).eq('program', program).eq('status', 'active')
      .order('full_name')
    if (studentsError) throw new Error(studentsError.message)

    const ref = new Date() // ages are as of the day the check is run
    const ratings = (await fetchRatings(supabase, students.map(s => s.id), academic_year, [month]))[month]
    const activities = await fetchActivities(supabase, [...new Set(Object.values(ratings).flatMap(r => Object.keys(r)))])
    const indicator = (activityId) => ({ activity_id: activityId, ...activityLabels(activities[activityId]) })

    // high: older than the upper threshold with any Emerging indicator; medium: older, with Developing
    // but no Emerging. Everyone else assessed is on track (achieving, or not yet past the threshold).
    const results = students.map(s => {
      const studentRatings = Object.entries(ratings[s.id] || {})
      const emerging = studentRatings.filter(([, r]) => r === 'emerging').map(([id]) => indicator(id))
      const developing = studentRatings.filter(([, r]) => r === 'developing').map(([id]) => indicator(id))
      const age = s.date_of_birth ? ageInMonths(s.date_of_birth, ref) : null
      const aboveThreshold = age != null && age > upperThreshold
      let status
      if (age == null) status = 'missing_dob'
      else if (!studentRatings.length) status = 'not_assessed'
      else if (aboveThreshold && emerging.length) status = 'high'
      else if (aboveThreshold && developing.length) status = 'medium'
      else status = 'on_track'
      return {
        student_id: s.id,
        student_name: s.full_name,
        date_of_birth: s.date_of_birth,
        age_months: age,
        above_threshold: aboveThreshold,
        status,
        on_track_reason: status === 'on_track' ? (aboveThreshold ? 'achieving' : 'below_threshold') : null,
        rated: studentRatings.length,
        achieved: studentRatings.filter(([, r]) => r === 'achieved').length,
        emerging,
        developing,
      }
    })
    const byConcern = (key) => (a, b) => b[key].length - a[key].length || a.student_name.localeCompare(b.student_name)
    const ofStatus = (status) => results.filter(r => r.status === status)

    const analysis_data = {
      age_range: { min_age_months: min, max_age_months: max, upper_threshold: upperThreshold },
      reference_date: ref.toISOString().slice(0, 10),
      summary: {
        total_students: results.length,
        high_concern: ofStatus('high').length,
        medium_concern: ofStatus('medium').length,
        on_track: ofStatus('on_track').length,
        not_assessed: ofStatus('not_assessed').length,
        missing_dob: ofStatus('missing_dob').length,
      },
      high: ofStatus('high').sort(byConcern('emerging')),
      medium: ofStatus('medium').sort(byConcern('developing')),
      on_track: ofStatus('on_track'),
      not_assessed: ofStatus('not_assessed'),
      missing_dob: ofStatus('missing_dob'),
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

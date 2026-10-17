import { termOfMonth } from '@/lib/progressTerms'

// Server-side progress queries shared by the analysis routes (service-role client).
export const RATING_LEVEL = { emerging: 0, developing: 1, achieved: 2 }
const PAGE = 1000 // PostgREST returns at most 1000 rows per request
const ID_CHUNK = 100 // keeps id=in.(...) filters well under URL limits

// Every rating for these students in the given months, as { month: { studentId: { activityId: rating } } }.
export async function fetchRatings(supabase, studentIds, academicYear, months) {
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
        if (!RATING_LEVEL.hasOwnProperty(r.rating) || r.term !== termOfMonth(r.month)) return
        ;(byMonth[r.month][r.student_id] ||= {})[r.activity_id] = r.rating
      })
      if (data.length < PAGE) break
    }
  }
  return byMonth
}

// activity id -> { id, name, skill_masters: { name, development_area, program } }
export async function fetchActivities(supabase, activityIds) {
  const map = {}
  for (let i = 0; i < activityIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase.from('skill_activities')
      .select('id, name, skill_masters(name, development_area, program)')
      .in('id', activityIds.slice(i, i + ID_CHUNK))
    if (error) throw new Error(error.message)
    data.forEach(a => { map[a.id] = a })
  }
  return map
}

// The labels the analysis screens show for an indicator.
export const activityLabels = (act) => ({
  development_area: act?.skill_masters?.development_area?.trim() || '',
  skill_area: act?.skill_masters?.name || '',
  indicator: act?.name || '',
})

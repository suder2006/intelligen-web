// Shared rules for when student attendance may be marked.
// Keep in sync with intelligen-rn/src/lib/attendanceRules.js

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

// Today's date (YYYY-MM-DD) in IST — toISOString() alone gives the UTC date,
// which is still "yesterday" before 5:30 AM IST.
export const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0]

export const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// "Oct 12"
export const formatShortDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const isPastDate = (date) => date < todayIST()

const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay()

export const isWeekend = (date) => [0, 6].includes(dayOfWeek(date))

// Non-optional holidays covering `date` that apply to students.
export const fetchStudentHolidays = async (supabase, schoolId, date) => {
  const { data, error } = await supabase.from('holidays')
    .select('name, applies_to, programs, is_optional')
    .eq('school_id', schoolId)
    .lte('from_date', date)
    .or(`to_date.gte.${date},and(to_date.is.null,from_date.eq.${date})`)
    .in('applies_to', ['all', 'students_only', 'programs'])
  if (error) throw error
  return (data || []).filter(h => !h.is_optional)
}

const holidayForProgram = (holidays, program) =>
  holidays.find(h => h.applies_to !== 'programs' || (program && h.programs?.includes(program)))

// Reason attendance cannot be marked for a student in `program` on `date`, or null if allowed.
export const getBlockReason = (date, holidays, program) => {
  const label = formatShortDate(date)
  if (isWeekend(date)) {
    const day = dayOfWeek(date) === 0 ? 'Sunday' : 'Saturday'
    return `${label} is a ${day}. No school on weekends. Cannot mark attendance.`
  }
  const holiday = holidayForProgram(holidays, program)
  if (holiday) return `${label} is a school holiday (${holiday.name}). Cannot mark attendance.`
  return null
}

export const pastDateWarning = (date) =>
  `You are marking attendance for a past date (${formatShortDate(date)}). Are you sure?`

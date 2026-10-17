// Same term/month split as the teacher mobile app, so web and app read and write the same rows.
export const TERMS = ['Term 1', 'Term 2', 'Term 3']
export const TERM_MONTHS = {
  'Term 1': ['June', 'July', 'August'],
  'Term 2': ['September', 'October', 'November', 'December'],
  'Term 3': ['January', 'February', 'March'],
}
// Every month of the academic year, in order (June to March).
export const ACADEMIC_MONTHS = TERMS.flatMap(t => TERM_MONTHS[t])
export const termOfMonth = (month) => TERMS.find(t => TERM_MONTHS[t].includes(month)) || null

// True when a skill activity belongs to exactly this program/term/month.
// Activities with a null program, term or month never match.
export const activityMatches = (act, program, term, month) =>
  act.program === program &&
  act.term === term &&
  act.month === month

// Applies activityMatches to each skill's activities, dropping skills left with none.
export const filterSkillActivities = (skills, program, term, month) => skills
  .map(s => ({ ...s, skill_activities: (s.skill_activities || []).filter(a => activityMatches(a, program, term, month)) }))
  .filter((s, i) => s.skill_activities.length > 0 || !(skills[i].skill_activities || []).length)

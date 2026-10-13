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

// Physical growth helpers shared by the admin page (preview) and
// /api/admin/growth (authoritative). BMI matches the teacher app.

export const MEASURE_FIELDS = [
  { key: 'height_cm', label: 'Height', unit: 'cm', min: 40, max: 180 },
  { key: 'weight_kg', label: 'Weight', unit: 'kg', min: 2, max: 80 },
  { key: 'head_circumference_cm', label: 'Head', unit: 'cm', min: 30, max: 65 },
  { key: 'chest_circumference_cm', label: 'Chest', unit: 'cm', min: 30, max: 100 },
]

export const calculateBmi = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null
  return Number((weightKg / ((heightCm / 100) ** 2)).toFixed(1))
}

export const bmiCategory = (bmi) => {
  if (!bmi) return null
  if (bmi < 14) return 'Underweight'
  if (bmi < 18) return 'Normal'
  if (bmi < 20) return 'Overweight'
  return 'Obese'
}

export const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// Validates a date + measurements. Returns { error } or { record } where record
// holds measurement_date, the four values (number or null), bmi and bmi_category.
// dateOfBirth (YYYY-MM-DD) is optional; the date may not be before it.
export function validateMeasurement(input, { dateOfBirth } = {}) {
  const date = typeof input.measurement_date === 'string' ? input.measurement_date.trim() : ''
  if (!date) return { error: 'Missing date' }
  if (!isRealDate(date)) return { error: `Invalid date "${input.measurement_date}"` }
  // One day of slack for time zones between browser and server
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (date > (typeof window === 'undefined' ? tomorrow : todayLocal())) return { error: 'Date is in the future' }
  if (dateOfBirth && date < dateOfBirth) return { error: 'Date is before the date of birth' }

  const record = { measurement_date: date }
  for (const f of MEASURE_FIELDS) {
    const raw = input[f.key]
    if (raw === null || raw === undefined || String(raw).trim() === '') { record[f.key] = null; continue }
    const n = Number(String(raw).trim())
    if (!Number.isFinite(n)) return { error: `${f.label} is not a number ("${raw}")` }
    if (n < f.min || n > f.max) return { error: `${f.label} ${n} ${f.unit} is outside ${f.min}–${f.max} ${f.unit}` }
    record[f.key] = Math.round(n * 100) / 100
  }
  if (!record.height_cm && !record.weight_kg) return { error: 'Enter at least height or weight' }

  record.bmi = calculateBmi(record.weight_kg, record.height_cm)
  record.bmi_category = bmiCategory(record.bmi)
  return { record }
}

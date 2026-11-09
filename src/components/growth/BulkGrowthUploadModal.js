'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { MEASURE_FIELDS } from '@/lib/growth'
import { TEMPLATE_HEADERS, parseGrowthSheet } from '@/lib/growthExcel'
import { GrowthModal, BMI_COLORS, fieldLabelStyle } from './shared'

const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const show = (v) => (v === null || v === undefined || v === '' ? '—' : v)

// Excel template download, upload, preview and save through
// /api/admin/growth (action: bulk).
export default function BulkGrowthUploadModal({ students, programs, measurements, schoolId, growthApi, inputStyle, onClose, onSaved }) {
  const [program, setProgram] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState(null)
  const [readError, setReadError] = useState('')
  const [duplicates, setDuplicates] = useState('skip')
  const [status, setStatus] = useState('pending')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const downloadTemplate = () => {
    const list = students
      .filter(s => !program || s.program === program)
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...list.map(s => [s.full_name, s.student_id || ''])])
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 22 }, { wch: 23 }]
    const help = XLSX.utils.aoa_to_sheet([
      ['How to fill in the Growth sheet'],
      [''],
      ['date', 'Measurement date as YYYY-MM-DD (e.g. 2026-11-04) or DD/MM/YYYY. Required.'],
      ['height_cm', 'Height in centimetres, e.g. 92.5 (40–180)'],
      ['weight_kg', 'Weight in kilograms, e.g. 14.2 (2–80)'],
      ['head_circumference_cm', 'Head circumference in centimetres, e.g. 48.5 (30–65). Optional.'],
      ['chest_circumference_cm', 'Chest circumference in centimetres, e.g. 52 (30–100). Optional.'],
      [''],
      ['Enter at least height or weight. Rows left empty are ignored.'],
      ['Students are matched by student_id; if it is blank, by exact name.'],
      ['Do not change the column headers.'],
    ])
    help['!cols'] = [{ wch: 24 }, { wch: 70 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Growth')
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')
    const slug = (program || 'all').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
    XLSX.writeFile(wb, `growth_template_${slug}.xlsx`)
  }

  const readFile = async (file) => {
    setReadError('')
    setPreview(null)
    setSaveError('')
    if (!file) return
    setFileName(file.name)
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true })
      const parsed = parseGrowthSheet(aoa, students, measurements)
      if (parsed.error) { setReadError(parsed.error); return }
      if (parsed.valid.length === 0 && parsed.errors.length === 0) { setReadError('No filled-in rows found in the sheet.'); return }
      setPreview(parsed)
    } catch (e) {
      setReadError(`Could not read the file: ${e.message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const dupCount = preview ? preview.valid.filter(v => v.duplicateOf).length : 0
  const newCount = preview ? preview.valid.length - dupCount : 0
  const toSaveCount = newCount + (duplicates === 'overwrite' ? dupCount : 0)

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const rows = preview.valid.map(v => ({ row: v.row, student_id: v.student.id, ...v.record }))
      const res = await growthApi({ action: 'bulk', school_id: schoolId, status, duplicates, rows })
      setResult({ ...res, previewErrors: preview.errors })
      await onSaved()
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const th = { padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: '600', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }
  const td = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }
  const chip = (bg, color) => ({ padding: '4px 12px', background: bg, borderRadius: '20px', color, fontSize: '12px', fontWeight: '600' })

  // Result summary
  if (result) {
    const allErrors = [...result.previewErrors, ...result.errors].sort((a, b) => a.row - b.row)
    const rowLabel = Object.fromEntries((preview?.valid || []).map(v => [v.row, v.student.full_name]))
    return (
      <GrowthModal title="📤 Upload complete" onClose={onClose} maxWidth="560px">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={chip('rgba(16,185,129,0.15)', '#34d399')}>✅ {result.saved} saved as {status}</span>
          {result.overwritten > 0 && <span style={chip('rgba(56,189,248,0.15)', '#38bdf8')}>✏️ {result.overwritten} overwritten</span>}
          <span style={chip('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.6)')}>⏭️ {result.skipped} skipped</span>
          <span style={chip('rgba(239,68,68,0.15)', '#f87171')}>⚠️ {allErrors.length} errors</span>
        </div>
        {allErrors.length > 0 && (
          <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Row</th><th style={th}>Student</th><th style={th}>Not saved because</th></tr></thead>
              <tbody>
                {allErrors.map((e, i) => (
                  <tr key={i}>
                    <td style={{ ...td, color: '#94a3b8' }}>{e.row}</td>
                    <td style={{ ...td, color: '#fff' }}>{e.label || rowLabel[e.row] || '—'}</td>
                    <td style={{ ...td, color: '#f87171' }}>{e.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </GrowthModal>
    )
  }

  return (
    <GrowthModal title="📤 Bulk Upload (Excel)" onClose={onClose} busy={saving} maxWidth={preview ? '1000px' : '520px'}>
      {/* Step 1: template */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>1. Download the template</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={program} onChange={e => setProgram(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '180px' }}>
            <option value=''>All Programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn-edit" style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px', fontWeight: '600' }} onClick={downloadTemplate}>
            ⬇️ Download Template
          </button>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px' }}>
          Student names and IDs are filled in. Add the date, height_cm, weight_kg and optionally head and chest circumference.
        </div>
      </div>

      {/* Step 2: upload */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>2. Upload the filled-in file</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => readFile(e.target.files?.[0])} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={saving}>📤 Upload Excel</button>
          {fileName && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{fileName}</span>}
        </div>
        {readError && <div style={{ marginTop: '10px', color: '#f87171', fontSize: '13px' }}>{readError}</div>}
      </div>

      {/* Step 3: preview */}
      {preview && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>3. Check and save</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <span style={chip('rgba(16,185,129,0.15)', '#34d399')}>✅ {newCount} new</span>
            <span style={chip('rgba(245,158,11,0.15)', '#f59e0b')}>🔁 {dupCount} duplicates</span>
            <span style={chip('rgba(239,68,68,0.15)', '#f87171')}>⚠️ {preview.errors.length} errors (not saved)</span>
            {preview.blank > 0 && <span style={chip('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.5)')}>{preview.blank} empty rows ignored</span>}
          </div>

          {preview.valid.length > 0 && (
            <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Row', 'Student', 'Program', 'Date', ...MEASURE_FIELDS.map(f => `${f.label} (${f.unit})`), 'BMI', ''].map(h => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.map(v => {
                    const d = v.duplicateOf
                    return (
                      <tr key={v.row} style={d ? { background: 'rgba(245,158,11,0.05)' } : undefined}>
                        <td style={{ ...td, color: '#94a3b8' }}>{v.row}</td>
                        <td style={{ ...td, color: '#fff', fontWeight: '600' }}>{v.student.full_name}</td>
                        <td style={{ ...td, color: '#a78bfa' }}>{v.student.program || '—'}</td>
                        <td style={{ ...td, color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(v.record.measurement_date)}</td>
                        {MEASURE_FIELDS.map(f => (
                          <td key={f.key} style={td}>
                            <span style={{ color: '#fff' }}>{show(v.record[f.key])}</span>
                            {d && String(d[f.key] ?? '') !== String(v.record[f.key] ?? '') && (
                              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>was {show(d[f.key])}</div>
                            )}
                          </td>
                        ))}
                        <td style={{ ...td, color: BMI_COLORS[v.record.bmi_category] || '#94a3b8', fontWeight: '600' }}>{show(v.record.bmi)}</td>
                        <td style={td}>
                          {d ? (
                            <span style={{ ...chip('rgba(245,158,11,0.15)', '#f59e0b'), whiteSpace: 'nowrap' }}>
                              Duplicate · {d.status}
                            </span>
                          ) : (
                            <span style={chip('rgba(16,185,129,0.15)', '#34d399')}>New</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Row</th><th style={th}>Student</th><th style={th}>Error (row will not be saved)</th></tr></thead>
                <tbody>
                  {preview.errors.map(e => (
                    <tr key={e.row}>
                      <td style={{ ...td, color: '#94a3b8' }}>{e.row}</td>
                      <td style={{ ...td, color: '#fff' }}>{e.label}</td>
                      <td style={{ ...td, color: '#f87171' }}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {dupCount > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={fieldLabelStyle}>Duplicates (same student and date)</span>
                <select value={duplicates} onChange={e => setDuplicates(e.target.value)} style={inputStyle}>
                  <option value="skip">Skip them, keep existing records</option>
                  <option value="overwrite">Overwrite existing records&apos; values</option>
                </select>
              </label>
            )}
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={fieldLabelStyle}>Save new rows as</span>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
                <option value="pending">Pending</option>
                <option value="approved">Approved (parents see them now)</option>
              </select>
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving || toSaveCount === 0}>
                {saving ? '⏳ Saving...' : `💾 Save ${toSaveCount} row${toSaveCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
          {duplicates === 'overwrite' && dupCount > 0 && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '10px' }}>
              Overwritten records keep their status: approved stays approved (parents see the new values); pending ones are approved only if you save as Approved.
            </div>
          )}
          {saveError && <div style={{ marginTop: '12px', color: '#f87171', fontSize: '13px' }}>Save failed: {saveError}</div>}
        </div>
      )}
    </GrowthModal>
  )
}

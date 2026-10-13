'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { api, formatDate, parseAi, panelCss } from '@/lib/progressClient'
import { ACADEMIC_MONTHS, TERM_MONTHS } from '@/lib/progressTerms'

const RATING_LABEL = { emerging: '🌱 Emerging', developing: '🌿 Developing', achieved: '🌟 Achieved' }
const RATING_COLOR = { emerging: '#f59e0b', developing: '#38bdf8', achieved: '#10b981' }
const CHANGE_LABEL = {
  mild: '⬇️ Mild', severe: '⬇️⬇️ Severe', good: '⬆️ Good', excellent: '⬆️⬆️ Excellent', stable: '➡️ Stable',
}
const FILTERS = [['all', 'All'], ['regression', 'Regressions'], ['improvement', 'Improvements']]

// Default From/To: the first two months of the selected term.
const defaultMonths = (term) => TERM_MONTHS[term].slice(0, 2)

// isAdmin=false (teacher view): read only, with no Analyse and no AI insights at all; opens the latest
// saved analysis for the program. The API also leaves the AI fields out for non-admins.
export default function RegressionAnalysis({ schoolId, program, academicYear, term, selectStyle, labelStyle, isAdmin = false }) {
  const [fromMonth, setFromMonth] = useState(() => defaultMonths(term)[0])
  const [toMonth, setToMonth] = useState(() => defaultMonths(term)[1])
  const [analysis, setAnalysis] = useState(null) // a progress_insights row
  const [filter, setFilter] = useState('all')
  const [analysing, setAnalysing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => { const [f, t] = defaultMonths(term); setFromMonth(f); setToMonth(t) }, [term])
  useEffect(() => { setAnalysis(null); setError('') }, [program, academicYear])
  useEffect(() => { if (schoolId && program) fetchHistory() }, [schoolId, program])

  const fetchHistory = async () => {
    try {
      const { analyses } = await api(`/api/progress/regression?school_id=${schoolId}&program=${encodeURIComponent(program)}`)
      setHistory(analyses)
      if (!isAdmin && analyses.length) openAnalysis(analyses[0].id, false)
    } catch (e) {
      setHistory([])
    }
  }

  const runAnalysis = async () => {
    if (ACADEMIC_MONTHS.indexOf(toMonth) <= ACADEMIC_MONTHS.indexOf(fromMonth)) {
      setError('"To" month must come after "From" month.')
      return
    }
    setAnalysing(true)
    setError('')
    try {
      const row = await api('/api/progress/regression', {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolId, program, academic_year: academicYear, term, from_month: fromMonth, to_month: toMonth }),
      })
      setAnalysis(row)
      setFilter('all')
      fetchHistory()
    } catch (e) {
      setError(e.message)
    }
    setAnalysing(false)
  }

  const openAnalysis = async (id, scroll = true) => {
    setLoadingId(id)
    setError('')
    try {
      setAnalysis(await api(`/api/progress/regression?school_id=${schoolId}&id=${id}`))
      setFilter('all')
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e.message)
    }
    setLoadingId(null)
  }

  const generateInsights = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await api('/api/generate-progress-insights', {
        method: 'POST',
        body: JSON.stringify({
          insight_id: analysis.id, school_id: schoolId, program: analysis.program,
          from_month: analysis.from_month, to_month: analysis.to_month,
          regression_data: analysis.regression_data,
        }),
      })
      setAnalysis(a => ({
        ...a,
        ai_insights: JSON.stringify(res.ai_insights),
        ai_recommendations: JSON.stringify(res.ai_recommendations),
        generated_at: res.generated_at,
      }))
      fetchHistory()
    } catch (e) {
      setError('AI insights failed: ' + e.message)
    }
    setGenerating(false)
  }

  const data = analysis?.regression_data
  const rows = data?.rows || []
  const summary = data?.summary || {}
  const shownRows = filter === 'all' ? rows : rows.filter(r => r.type === filter)
  const insights = isAdmin ? parseAi(analysis?.ai_insights) : null
  const recs = isAdmin ? parseAi(analysis?.ai_recommendations) : null

  const exportExcel = () => {
    const a = analysis
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Program', a.program], ['Academic Year', a.academic_year], ['Term', a.term],
      ['From Month', a.from_month], ['To Month', a.to_month], ['Analysed On', formatDate(a.created_at)], [],
      ['Students compared', summary.students_compared], ['Students regressed', summary.regressed_students],
      ['Students improved', summary.improved_students], ['Students stable', summary.stable_students],
      ['Consecutive regressions (students)', summary.consecutive_students], [],
      ['Indicators regressed', summary.regressions], ['  of which severe', summary.severe_regressions],
      ['Indicators improved', summary.improvements], ['Indicators stable', summary.stable],
    ])
    summarySheet['!cols'] = [{ wch: 34 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const header = ['Student Name', 'Development Area', 'Skill Area', 'Indicator', `${a.from_month} Rating`, `${a.to_month} Rating`, 'Result', 'Change', 'Consecutive?', 'Same Indicator Last Period?']
    const comparison = XLSX.utils.aoa_to_sheet([header, ...rows.map(r => [
      r.student_name, r.development_area, r.skill_area, r.indicator, r.from_rating, r.to_rating,
      r.type, r.severity, r.consecutive ? 'Yes' : '', r.same_indicator ? 'Yes' : '',
    ])])
    comparison['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, comparison, 'Comparison')

    if (data.consecutive?.length) {
      const consec = XLSX.utils.aoa_to_sheet([
        ['Student Name', 'Development Areas', 'Skill Areas', 'Regressions This Period', 'Same Indicator Both Periods'],
        ...data.consecutive.map(c => [c.student_name, c.development_areas.join(', '), c.skill_areas.join(', '), c.regressions, c.same_indicators]),
      ])
      consec['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(wb, consec, 'Consecutive')
    }

    if (insights) {
      const lines = [['AI Insights', formatDate(a.generated_at)], [], ['Summary'], [insights.summary || '']]
      const section = (title, items) => { if (items?.length) lines.push([], [title], ...items.map(i => [i])) }
      section('Key Patterns', insights.key_patterns)
      section('Skills Needing Attention', insights.skills_needing_attention?.map(s => `${s.skill}: ${s.reason}`))
      section('Students Needing Support', insights.students_needing_support?.map(s => `${s.student}: ${s.concern} → ${s.action}`))
      section('Teacher Actions', recs?.teacher_actions)
      section('Parent Communication', recs?.parent_communication)
      const aiSheet = XLSX.utils.aoa_to_sheet(lines)
      aiSheet['!cols'] = [{ wch: 120 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, aiSheet, 'AI Insights')
    }

    XLSX.writeFile(wb, `regression_${a.program}_${a.from_month}-${a.to_month}_${a.academic_year}.xlsx`)
  }

  const statCard = (emoji, label, value, sub, color) => (
    <div className="card stat-card" style={{ borderColor: `${color}44` }}>
      <div style={{ fontSize: '20px' }}>{emoji}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{sub}</div>
    </div>
  )

  const aiList = (title, items, render = i => i) => items?.length > 0 && (
    <div style={{ marginTop: '14px' }}>
      <div className="ai-heading">{title}</div>
      <ul className="ai-list">{items.map((item, i) => <li key={i}>{render(item)}</li>)}</ul>
    </div>
  )

  return (
    <div className="regression">
      <style>{`
        ${panelCss('.regression')}
        .regression .consec-card { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); }
        .regression .consec-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid rgba(239,68,68,0.15); }
        .regression .cmp-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
        .regression .cmp-table th { text-align: left; color: rgba(255,255,255,0.4); font-weight: 600; font-size: 12px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
        .regression .cmp-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
        .regression .row-regression { background: rgba(239,68,68,0.08); }
        .regression .row-regression td:first-child { box-shadow: inset 3px 0 0 #ef4444; }
        .regression .row-improvement { background: rgba(16,185,129,0.07); }
        .regression .row-improvement td:first-child { box-shadow: inset 3px 0 0 #10b981; }
        .regression .row-stable { color: rgba(255,255,255,0.55); }
      `}</style>

      {/* From / To + Analyse */}
      {isAdmin && <div className="card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px' }}>
        <div>
          <label style={labelStyle}>From Month</label>
          <select value={fromMonth} onChange={e => setFromMonth(e.target.value)} style={selectStyle}>
            {ACADEMIC_MONTHS.slice(0, -1).map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>To Month</label>
          <select value={toMonth} onChange={e => setToMonth(e.target.value)} style={selectStyle}>
            {ACADEMIC_MONTHS.slice(1).map(m => <option key={m} value={m} style={{ background: '#1e293b' }}>{m}</option>)}
          </select>
        </div>
        <button onClick={runAnalysis} disabled={analysing} className="btn-primary">
          {analysing ? <><span className="spinner" />Analysing...</> : '🔍 Analyse'}
        </button>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', flexBasis: '100%' }}>
          Compares each student&apos;s ratings on every indicator marked in both months, for {program} · {academicYear}.
        </div>
      </div>}

      {error && <div className="card" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)', fontSize: '13px' }}>{error}</div>}

      {analysis && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '18px 0 10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>{analysis.program} · {analysis.from_month} → {analysis.to_month}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>
                {analysis.academic_year} · {analysis.term} · {summary.students_compared} students compared · analysed {formatDate(analysis.created_at)}
              </div>
            </div>
            <button onClick={exportExcel} className="btn-secondary" disabled={!rows.length}>📥 Export Excel</button>
          </div>

          {!rows.length ? (
            <div className="card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textAlign: 'center', padding: '30px' }}>
              No indicators were rated for the same student in both {analysis.from_month} and {analysis.to_month}.
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="stats">
                {statCard('🔴', 'Regressed', `${summary.regressed_students} students`, `${summary.regressions} indicators · ${summary.severe_regressions} severe`, '#ef4444')}
                {statCard('🟢', 'Improved', `${summary.improved_students} students`, `${summary.improvements} indicators`, '#10b981')}
                {statCard('➡️', 'Stable', `${summary.stable_students} students`, `${summary.stable} indicators unchanged`, 'rgba(255,255,255,0.7)')}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginBottom: '16px' }}>
                A student with both drops and gains counts in Regressed and Improved. Stable = no change on any indicator.
              </div>

              {/* Consecutive */}
              {data.consecutive?.length > 0 && (
                <div className="card consec-card">
                  <div style={{ fontWeight: 700, color: '#fca5a5' }}>⚠️ Consecutive Regressions · {data.consecutive.length}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '2px 0 6px' }}>
                    Also regressed from {data.prev_month} to {analysis.from_month}
                  </div>
                  {data.consecutive.map(c => (
                    <div key={c.student_id} className="consec-item">
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.student_name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginTop: '2px' }}>
                          {c.skill_areas.join(', ') || 'Unnamed skill'}
                          {c.same_indicators > 0 && ` · ${c.same_indicators} same indicator${c.same_indicators === 1 ? '' : 's'} dropped twice`}
                        </div>
                      </div>
                      <span className="badge badge-red">2nd month in a row!</span>
                    </div>
                  ))}
                </div>
              )}
              {!data.prev_month && (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginBottom: '10px' }}>
                  No month before {analysis.from_month} in this academic year, so consecutive regressions aren&apos;t checked.
                </div>
              )}

              {/* Table */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {FILTERS.map(([key, label]) => {
                    const n = key === 'all' ? rows.length : rows.filter(r => r.type === key).length
                    return <button key={key} onClick={() => setFilter(key)} className={filter === key ? 'tab tab-active' : 'tab'}>{label} · {n}</button>
                  })}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="cmp-table">
                    <thead>
                      <tr>
                        <th>Student Name</th><th>Development Area</th><th>Skill Area</th><th>Indicator</th>
                        <th>{analysis.from_month}</th><th>{analysis.to_month}</th><th>Change</th><th>Consecutive?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map(r => (
                        <tr key={`${r.student_id}-${r.activity_id}`} className={`row-${r.type}`}>
                          <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                          <td>{r.development_area || '—'}</td>
                          <td>{r.skill_area || '—'}</td>
                          <td>{r.indicator || '—'}</td>
                          <td style={{ color: RATING_COLOR[r.from_rating], whiteSpace: 'nowrap' }}>{RATING_LABEL[r.from_rating]}</td>
                          <td style={{ color: RATING_COLOR[r.to_rating], whiteSpace: 'nowrap' }}>{RATING_LABEL[r.to_rating]}</td>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{CHANGE_LABEL[r.severity]}</td>
                          <td>{r.consecutive ? <span className="badge badge-red">⚠️ {r.same_indicator ? 'Same indicator' : 'Yes'}</span> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shownRows.length && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>Nothing to show</div>}
                </div>
              </div>

              {/* AI insights: admin only */}
              {isAdmin && <div className="card ai-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>✨ AI Insights</div>
                    {insights && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>Generated {formatDate(analysis.generated_at)}</div>}
                  </div>
                  <button onClick={generateInsights} disabled={generating} className={insights ? 'btn-secondary' : 'btn-primary'}>
                    {generating ? <><span className="spinner" style={insights ? { borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' } : undefined} />Generating...</>
                      : insights ? '🔄 Regenerate' : '✨ Generate AI Insights'}
                  </button>
                </div>

                {!insights && !generating && (
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '10px' }}>
                    Get patterns, students to support, and action items for teachers and parents from this comparison.
                  </div>
                )}

                {insights && (
                  <div style={{ opacity: generating ? 0.5 : 1 }}>
                    {insights.summary && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.6, marginTop: '12px' }}>{insights.summary}</p>}
                    {aiList('🔎 Key Patterns', insights.key_patterns)}
                    {aiList('🎯 Skills Needing Attention', insights.skills_needing_attention, s => <><b>{s.skill}</b> — {s.reason}</>)}
                    {aiList('🆘 Students Needing Support', insights.students_needing_support, s => <><b>{s.student}</b>: {s.concern} <span style={{ color: '#a78bfa' }}>→ {s.action}</span></>)}
                    {aiList('✅ Action Items for Teachers', recs?.teacher_actions)}
                    {aiList('💬 Parent Communication', recs?.parent_communication)}
                  </div>
                )}
              </div>}
            </>
          )}
        </>
      )}

      {/* History */}
      <div style={{ marginTop: '24px' }}>
        <div className="section-label" style={{ marginBottom: '10px' }}>Previous analyses · {program}</div>
        {!history.length ? (
          <div className="card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No analyses yet for {program}.{!isAdmin && ' Your school admin runs these from the admin Progress page.'}
          </div>
        ) : history.map(h => (
          <button key={h.id} onClick={() => openAnalysis(h.id)} className={analysis?.id === h.id ? 'history-item history-active' : 'history-item'}>
            <span>
              <b style={{ color: '#fff' }}>{h.from_month} → {h.to_month}</b>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {h.program} · {h.academic_year} · {formatDate(h.created_at)}</span>
            </span>
            <span style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
              {loadingId === h.id && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</span>}
              {h.summary && <span style={{ color: '#fca5a5' }}>🔴 {h.summary.regressed_students}</span>}
              {h.summary && <span style={{ color: '#6ee7b7' }}>🟢 {h.summary.improved_students}</span>}
              {isAdmin && h.has_insights && <span style={{ color: '#a78bfa' }}>✨</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

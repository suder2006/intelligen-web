'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { api, formatDate, parseAi, panelCss } from '@/lib/progressClient'

// Age is shown for reference only; it plays no part in the flagging.
const ageLabel = (months) => months == null ? '' : `Age ${Math.floor(months / 12)}y ${months % 12}m`
// "July 2026" from the academic year: June–December fall in its first year, January–March in the next.
const monthLabel = (month, academicYear) =>
  `${month} ${parseInt(academicYear, 10) + (['January', 'February', 'March'].includes(month) ? 1 : 0)}`
const indicatorLabel = (i) => [i.development_area, i.skill_area, i.indicator].filter(Boolean).join(' › ') || 'Unnamed indicator'

const CONCERNS = {
  high: { title: '🔴 High Concern', sub: 'Indicators still Emerging — address immediately', badge: 'Needs immediate attention!', color: '#fca5a5', cls: 'concern-high' },
  medium: { title: '🟡 Medium Concern', sub: 'Indicators still Developing — monitor and support', badge: 'Monitor and support', color: '#fcd34d', cls: 'concern-medium' },
}
const RATING = {
  emerging: { label: '🌱 Emerging', color: '#fca5a5' },
  developing: { label: '🌿 Developing', color: '#fcd34d' },
}
// Every indicator a child hasn't achieved, Emerging first.
const unachieved = (child) => [
  ...child.emerging.map(i => ({ ...i, rating: 'emerging' })),
  ...child.developing.map(i => ({ ...i, rating: 'developing' })),
]

// isAdmin=false (teacher view): read only, with no Check button and no AI insights; opens the latest
// saved check for the program. The API also leaves the AI fields out for non-admins.
export default function AgeCheck({ schoolId, program, academicYear, term, month, isAdmin = false }) {
  const [loaded, setAnalysis] = useState(null) // an age_appropriate_insights row
  const [checking, setChecking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [loadingId, setLoadingId] = useState(null)
  // Only show a check for the program currently selected (switching program clears it).
  const analysis = loaded?.program === program ? loaded : null

  const openAnalysis = async (id, scroll = true) => {
    setLoadingId(id)
    setError('')
    try {
      setAnalysis(await api(`/api/progress/age-check?school_id=${schoolId}&id=${id}`))
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e.message)
    }
    setLoadingId(null)
  }

  const loadHistory = () => api(`/api/progress/age-check?school_id=${schoolId}&program=${encodeURIComponent(program)}`)
    .then(r => r.analyses).catch(() => [])

  const applyHistory = (analyses) => {
    setHistory(analyses)
    setError('')
    if (!isAdmin && analyses.length) openAnalysis(analyses[0].id, false)
  }

  const fetchHistory = async () => applyHistory(await loadHistory())

  useEffect(() => {
    if (!schoolId || !program) return
    let cancelled = false
    loadHistory().then(analyses => { if (!cancelled) applyHistory(analyses) })
    return () => { cancelled = true }
  }, [schoolId, program])

  const runCheck = async () => {
    setChecking(true)
    setError('')
    try {
      setAnalysis(await api('/api/progress/age-check', {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolId, program, academic_year: academicYear, term, month }),
      }))
      fetchHistory()
    } catch (e) {
      setError(e.message)
    }
    setChecking(false)
  }

  const generateInsights = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await api('/api/generate-age-insights', {
        method: 'POST',
        body: JSON.stringify({
          insight_id: analysis.id, school_id: schoolId, program: analysis.program, month: analysis.month,
          analysis_data: analysis.analysis_data,
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

  const data = analysis?.analysis_data
  const summary = data?.summary || {}
  const insights = isAdmin ? parseAi(analysis?.ai_insights) : null
  const recs = isAdmin ? parseAi(analysis?.ai_recommendations) : null
  const flagged = (data?.high?.length || 0) + (data?.medium?.length || 0)

  const exportExcel = () => {
    const a = analysis
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Program', a.program], ['Academic Year', a.academic_year], ['Term', a.term],
      ['Assessment Month', monthLabel(a.month, a.academic_year)], ['Checked On', formatDate(a.created_at)], [],
      ['High concern (Emerging)', summary.high_concern], ['Medium concern (Developing)', summary.medium_concern], ['On track (all Achieved)', summary.on_track],
      ['Not assessed this month', summary.not_assessed], ['Total students', summary.total_students],
    ])
    summarySheet['!cols'] = [{ wch: 26 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const flaggedRows = ['high', 'medium'].flatMap(level => (data[level] || []).flatMap(c =>
      unachieved(c).map(i => [c.student_name, a.program, a.month, level === 'high' ? 'High' : 'Medium',
        i.development_area, i.skill_area, i.indicator, i.rating === 'emerging' ? 'Emerging' : 'Developing'])))
    const flaggedSheet = XLSX.utils.aoa_to_sheet([
      ['Student Name', 'Program', 'Month', 'Concern', 'Development Area', 'Skill Area', 'Indicator', 'Rating'], ...flaggedRows,
    ])
    flaggedSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 30 }, { wch: 40 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, flaggedSheet, 'Flagged Indicators')

    const statusLabel = { high: 'High concern', medium: 'Medium concern', on_track: 'On track', not_assessed: 'Not assessed' }
    const allStudents = ['high', 'medium', 'on_track', 'not_assessed'].flatMap(k => data[k] || [])
    const studentsSheet = XLSX.utils.aoa_to_sheet([
      ['Student Name', 'Status', 'Indicators Rated', 'Achieved', 'Developing', 'Emerging', 'Age (reference)'],
      ...allStudents.map(s => [s.student_name, statusLabel[s.status], s.rated, s.achieved, s.developing.length, s.emerging.length,
        ageLabel(s.age_months).replace('Age ', '')]),
    ])
    studentsSheet['!cols'] = [{ wch: 24 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, studentsSheet, 'All Students')

    if (insights) {
      const lines = [['AI Insights', formatDate(a.generated_at)], [], ['Summary'], [insights.summary || '']]
      ;(recs?.children || []).forEach(c => {
        lines.push([], [`${c.student} (${c.concern} concern)`])
        const add = (title, items) => { if (items?.length) lines.push([`  ${title}`], ...items.map(i => [`    • ${i}`])) }
        add('Classroom strategies', c.classroom_strategies)
        add('Activities', c.activities)
        add('Parent involvement', c.parent_involvement)
        if (c.reassessment_timeline) lines.push([`  Reassessment: ${c.reassessment_timeline}`])
        if (c.specialist_referral) lines.push([`  Specialist referral: ${c.specialist_referral}`])
      })
      if (recs?.general_recommendations?.length) lines.push([], ['Class-wide Recommendations'], ...recs.general_recommendations.map(r => [`• ${r}`]))
      const aiSheet = XLSX.utils.aoa_to_sheet(lines)
      aiSheet['!cols'] = [{ wch: 120 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, aiSheet, 'AI Insights')
    }

    XLSX.writeFile(wb, `age_check_${a.program}_${a.month}_${a.academic_year}.xlsx`)
  }

  const statCard = (emoji, label, value, color) => (
    <div className="card stat-card" style={{ borderColor: `${color}44` }}>
      <div style={{ fontSize: '20px' }}>{emoji}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color, marginTop: '2px' }}>{value} <span style={{ fontSize: '14px', fontWeight: 600 }}>{value === 1 ? 'child' : 'children'}</span></div>
    </div>
  )

  const concernSection = (level) => {
    const c = CONCERNS[level]
    const children = data[level] || []
    if (!children.length) return null
    return (
      <div className={`card ${c.cls}`}>
        <div style={{ fontWeight: 700, color: c.color }}>{c.title} · {children.length}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '2px 0 6px' }}>{c.sub}</div>
        {children.map(child => (
          <div key={child.student_id} className="child">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{child.student_name}</span>
                {child.age_months != null && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}> · {ageLabel(child.age_months)}</span>}
              </div>
              <span className={`badge badge-${level}`}>{c.badge}</span>
            </div>
            <ul className="indicators">
              {unachieved(child).map(i => (
                <li key={i.activity_id}><span style={{ color: RATING[i.rating].color }}>{RATING[i.rating].label}</span> {indicatorLabel(i)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  const chipList = (title, children, color, describe) => children?.length > 0 && (
    <div className="card">
      <div style={{ fontWeight: 700, color, marginBottom: '8px' }}>{title} · {children.length}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {children.map(s => (
          <span key={s.student_id} className="chip">
            <b style={{ color: '#fff', fontWeight: 600 }}>{s.student_name}</b> · {describe(s)}
          </span>
        ))}
      </div>
    </div>
  )

  const aiList = (title, items) => items?.length > 0 && (
    <div style={{ marginTop: '8px' }}>
      <div className="ai-heading" style={{ fontSize: '12px', marginBottom: '2px' }}>{title}</div>
      <ul className="ai-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  )

  return (
    <div className="age-check">
      <style>{`
        ${panelCss('.age-check')}
        .age-check .concern-high { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); }
        .age-check .concern-medium { background: rgba(245,158,11,0.07); border-color: rgba(245,158,11,0.3); }
        .age-check .child { padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.07); }
        .age-check .indicators { padding-left: 18px; margin-top: 6px; font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.6; }
        .age-check .badge-high { background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.35); }
        .age-check .badge-medium { background: rgba(245,158,11,0.18); color: #fcd34d; border: 1px solid rgba(245,158,11,0.35); }
        .age-check .chip { padding: 5px 12px; border-radius: 20px; font-size: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
        .age-check .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .age-check .info-label { color: rgba(255,255,255,0.4); font-size: 12px; }
        .age-check .info-value { font-weight: 700; font-size: 15px; margin-top: 2px; }
        .age-check .ai-child { padding: 14px 0; border-top: 1px solid rgba(167,139,250,0.15); }
        @media (max-width: 640px) { .age-check .info { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {isAdmin && (
        <div className="card" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.5 }}>
            Flags every {program} child whose {month} indicators are still Emerging or Developing. All children are expected to achieve each month&apos;s indicators.
          </div>
          <button onClick={runCheck} disabled={checking} className="btn-primary">
            {checking ? <><span className="spinner" />Checking...</> : '🎯 Check Age Appropriateness'}
          </button>
        </div>
      )}

      {error && <div className="card" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)', fontSize: '13px' }}>{error}</div>}

      {analysis && data && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '18px 0 10px' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Checked {formatDate(analysis.created_at)}</div>
            <button onClick={exportExcel} className="btn-secondary">📥 Export Excel</button>
          </div>

          {/* Program info */}
          <div className="card info">
            <div><div className="info-label">Program</div><div className="info-value">{analysis.program}</div></div>
            <div><div className="info-label">Assessment Month</div><div className="info-value">{monthLabel(analysis.month, analysis.academic_year)}</div></div>
            <div><div className="info-label">Term</div><div className="info-value">{analysis.term}</div></div>
            <div><div className="info-label">Students</div><div className="info-value">{summary.total_students}</div></div>
          </div>

          <div className="stats">
            {statCard('🔴', 'High Concern', summary.high_concern, '#ef4444')}
            {statCard('🟡', 'Medium Concern', summary.medium_concern, '#f59e0b')}
            {statCard('🟢', 'On Track', summary.on_track, '#10b981')}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginBottom: '16px' }}>
            🔴 any indicator Emerging · 🟡 any Developing, none Emerging · 🟢 all Achieved
            {summary.not_assessed > 0 && ` · ${summary.not_assessed} not assessed in ${analysis.month}`}
          </div>

          {concernSection('high')}
          {concernSection('medium')}
          {flagged === 0 && (
            <div className="card" style={{ color: '#6ee7b7', fontSize: '13px' }}>✅ No children flagged for {analysis.month}.</div>
          )}
          {chipList('🟢 On Track', data.on_track, '#6ee7b7', s => `${s.achieved}/${s.rated} achieved`)}
          {chipList('⚪ Not Assessed', data.not_assessed, 'rgba(255,255,255,0.6)', s => `no ${analysis.month} ratings`)}

          {/* AI insights: admin only */}
          {isAdmin && flagged > 0 && (
            <div className="card ai-card" style={{ padding: '20px' }}>
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
                  Get classroom strategies, activities, parent suggestions and referral guidance for each flagged child.
                </div>
              )}

              {insights && (
                <div style={{ opacity: generating ? 0.5 : 1 }}>
                  {insights.summary && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: 1.6, margin: '12px 0' }}>{insights.summary}</p>}
                  {(recs?.children || []).map((c, i) => (
                    <div key={i} className="ai-child">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <b>{c.student}</b>
                        <span className={`badge badge-${c.concern === 'high' ? 'high' : 'medium'}`}>{c.concern === 'high' ? '🔴 High' : '🟡 Medium'}</span>
                      </div>
                      {aiList('🏫 Classroom strategies', c.classroom_strategies)}
                      {aiList('🧩 Activities to try now', c.activities)}
                      {aiList('👪 Parent involvement', c.parent_involvement)}
                      {c.reassessment_timeline && <div style={{ fontSize: '13px', marginTop: '8px', color: 'rgba(255,255,255,0.75)' }}>📅 <b>Reassess:</b> {c.reassessment_timeline}</div>}
                      {c.specialist_referral && <div style={{ fontSize: '13px', marginTop: '4px', color: 'rgba(255,255,255,0.75)' }}>🩺 <b>Specialist referral:</b> {c.specialist_referral}</div>}
                    </div>
                  ))}
                  {recs?.general_recommendations?.length > 0 && (
                    <div className="ai-child">
                      <div className="ai-heading">📋 Class-wide recommendations</div>
                      <ul className="ai-list">{recs.general_recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* History */}
      <div style={{ marginTop: '24px' }}>
        <div className="section-label" style={{ marginBottom: '10px' }}>Previous checks · {program}</div>
        {!history.length ? (
          <div className="card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No age checks yet for {program}.{!isAdmin && ' Your school admin runs these from the admin Progress page.'}
          </div>
        ) : history.map(h => (
          <button key={h.id} onClick={() => openAnalysis(h.id)} className={analysis?.id === h.id ? 'history-item history-active' : 'history-item'}>
            <span>
              <b style={{ color: '#fff' }}>{h.month}</b>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {h.program} · {h.academic_year} · {formatDate(h.created_at)}</span>
            </span>
            <span style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
              {loadingId === h.id && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Loading...</span>}
              {h.summary && <span style={{ color: '#fca5a5' }}>🔴 {h.summary.high_concern}</span>}
              {h.summary && <span style={{ color: '#fcd34d' }}>🟡 {h.summary.medium_concern}</span>}
              {isAdmin && h.has_insights && <span style={{ color: '#a78bfa' }}>✨</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

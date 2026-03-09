'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewsletterPage() {
  const router = useRouter()
  const [blocks, setBlocks] = useState([])
  const [selectedBlock, setSelectedBlock] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [curriculum, setCurriculum] = useState([])
  const [completions, setCompletions] = useState([])
  const [newsletters, setNewsletters] = useState([])
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('curriculum_blocks').select('*').order('start_date').then(({ data }) => setBlocks(data || []))
    fetchNewsletters()
  }, [])

  async function fetchNewsletters() {
    const { data } = await supabase.from('curriculum_newsletter').select('*').order('created_at', { ascending: false })
    setNewsletters(data || [])
  }

  async function loadCurriculum() {
    if (!selectedBlock || !weekStart) { alert('Please select block and week'); return }
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const { data: curr } = await supabase.from('curriculum').select('*').eq('block_id', selectedBlock).gte('assigned_date', weekStart).lte('assigned_date', weekEnd.toISOString().split('T')[0])
    const { data: comp } = await supabase.from('curriculum_completion').select('*')
    setCurriculum(curr || [])
    setCompletions(comp || [])
    generateContent(curr || [], comp || [])
  }

  function generateContent(curr, comp) {
    setGenerating(true)
    const completedIds = comp.map(c => c.curriculum_id)
    const completed = curr.filter(c => completedIds.includes(c.id))
    const special = curr.filter(c => c.special_event)
    let text = `🌟 WEEKLY HIGHLIGHTS — Week of ${weekStart}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    text += `Dear Parents,\n\nHere's a summary of what your little ones explored this week!\n\n`
    if (special.length > 0) {
      text += `⭐ SPECIAL EVENTS\n`
      special.forEach(s => { text += `• ${s.day}: ${s.planned_activity} (${s.program})\n` })
      text += '\n'
    }
    if (completed.length > 0) {
      text += `✅ ACTIVITIES COMPLETED (${completed.length}/${curr.length})\n`
      completed.forEach(c => { text += `• ${c.day} ${c.time_slot}: ${c.planned_activity} — ${c.activity_category}\n` })
      text += '\n'
    }
    const byProgram = curr.reduce((acc, c) => { if (!acc[c.program]) acc[c.program] = []; acc[c.program].push(c); return acc }, {})
    Object.entries(byProgram).forEach(([prog, items]) => {
      text += `📚 ${prog.toUpperCase()}\n`
      items.forEach(i => { text += `• ${i.day}: ${i.planned_activity || 'Activity planned'} (${i.time_slot})\n` })
      text += '\n'
    })
    text += `We look forward to another exciting week ahead!\n\nWarm regards,\nTime Kids Preschool Team 🎓`
    setContent(text)
    setGenerating(false)
  }

  async function saveAndSend() {
    if (!content) return
    setSaving(true)
    await supabase.from('curriculum_newsletter').insert({ block_id: selectedBlock, week_start: weekStart, content })
    // Send push to parents
    const { data: parents } = await supabase.from('profiles').select('push_token').eq('role', 'parent')
    const tokens = parents?.map(p => p.push_token).filter(Boolean)
    if (tokens?.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens.map(token => ({
          to: token,
          title: '📰 Weekly Newsletter Ready!',
          body: `This week's highlights are now available. Check the app!`,
          sound: 'default'
        })))
      })
    }
    alert('Newsletter saved and parents notified!')
    await fetchNewsletters()
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📰 Weekly Newsletter</h1>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Curriculum Block</label>
              <select value={selectedBlock} onChange={e => setSelectedBlock(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }}>
                <option value=''>-- Select Block --</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.academic_year})</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Week Starting</label>
              <input type='date' value={weekStart} onChange={e => setWeekStart(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
            <button onClick={loadCurriculum}
              style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              🔄 Generate
            </button>
          </div>
        </div>

        {content && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#f59e0b' }}>📝 Newsletter Preview</h3>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Edit before sending</span>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              style={{ width: '100%', height: '320px', padding: '16px', backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'monospace' }} />
            <button onClick={saveAndSend} disabled={saving}
              style={{ marginTop: '12px', width: '100%', padding: '14px', backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
              {saving ? 'Sending...' : '📤 Save & Notify Parents'}
            </button>
          </div>
        )}

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#94a3b8', marginBottom: '16px' }}>📚 Past Newsletters ({newsletters.length})</h3>
          {newsletters.length === 0 && <p style={{ color: '#475569' }}>No newsletters sent yet.</p>}
          {newsletters.map(n => (
            <div key={n.id} style={{ padding: '14px', backgroundColor: '#0f172a', borderRadius: '10px', marginBottom: '8px', border: '1px solid #334155', cursor: 'pointer' }}
              onClick={() => setContent(n.content)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Week of {n.week_start}</span>
                <span style={{ color: '#64748b', fontSize: '13px' }}>{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Click to view/edit</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
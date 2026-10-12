'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const PROGRAMS = ['Playgroup', 'Nursery', 'LKG', 'UKG']

const EMPTY_RHYME = {
  title: '', lyrics: '', audio_url: '', video_type: 'youtube', video_url: '',
  actions_text: '', program: PROGRAMS[0], order_index: 0, is_active: true
}

const pad = (n) => String(n).padStart(2, '0')
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Monday of the current week, as YYYY-MM-DD in local time.
function thisMonday() {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(d)
}

const formatDate = (str) => new Date(`${str}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// /api/upload rejects requests without the signed-in user's token.
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

// Accepts watch, youtu.be, shorts, embed and live URLs, or a bare 11-char ID.
function extractYouTubeId(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

// Uploads straight to R2 through a presigned URL, the same way albums uploads videos.
async function uploadToR2(file, folder) {
  const presignRes = await fetch(
    `/api/upload?folder=${encodeURIComponent(folder)}&contentType=${encodeURIComponent(file.type)}`,
    { headers: await authHeaders() }
  )
  const presignData = await presignRes.json()
  if (!presignRes.ok) throw new Error(presignData.error || 'Could not get upload URL')
  const r2Res = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  })
  if (!r2Res.ok) throw new Error(`R2 upload failed: ${r2Res.status}`)
  return presignData.publicUrl
}

// Returns the rows that need a new order_index after moving rows[index] by dir (-1/+1).
function reorderedRows(rows, index, dir) {
  const target = index + dir
  if (target < 0 || target >= rows.length) return []
  const next = [...rows]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next.map((row, i) => ({ ...row, order_index: i })).filter((row, i) => rows.find(r => r.id === row.id).order_index !== i)
}

export default function AdminRhymesPage() {
  const { schoolId } = useSchool()
  const [program, setProgram] = useState(PROGRAMS[0])
  const [rhymes, setRhymes] = useState([])
  const [loading, setLoading] = useState(true)

  const [openId, setOpenId] = useState(null) // rhyme id, or 'new'
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null) // 'video' | 'audio'

  const [assignments, setAssignments] = useState([])
  const [assignRhymeId, setAssignRhymeId] = useState('')
  const [assignDate, setAssignDate] = useState(thisMonday())
  const [assigning, setAssigning] = useState(false)

  useEffect(() => { if (schoolId) { fetchRhymes(); fetchAssignments() } }, [schoolId, program])

  const fetchRhymes = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rhymes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('program', program)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
    setRhymes(data || [])
    setLoading(false)
  }

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('rhyme_assignments')
      .select('*, rhymes(title), assigner:profiles!assigned_by(full_name)')
      .eq('school_id', schoolId)
      .eq('program', program)
      .eq('is_active', true)
      .order('week_start_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    setAssignments(data || [])
  }

  // ---------- Rhymes ----------

  const openRhyme = (rhyme) => {
    if (openId === rhyme.id) { closeRhyme(); return }
    setOpenId(rhyme.id)
    setForm({ ...EMPTY_RHYME, ...Object.fromEntries(Object.entries(rhyme).filter(([, v]) => v !== null)) })
  }

  const addRhyme = () => {
    setOpenId('new')
    setForm({ ...EMPTY_RHYME, program, order_index: rhymes.length })
  }

  const closeRhyme = () => { setOpenId(null); setForm(null) }

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const saveRhyme = async () => {
    if (!form.title.trim()) { alert('Title is required'); return }
    let videoUrl = form.video_url?.trim() || null
    if (videoUrl && form.video_type === 'youtube') {
      const id = extractYouTubeId(videoUrl)
      if (!id) { alert('Could not find a YouTube video ID in that URL'); return }
      videoUrl = `https://www.youtube.com/watch?v=${id}`
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      lyrics: form.lyrics || null,
      audio_url: form.audio_url || null,
      video_type: form.video_type,
      video_url: videoUrl,
      actions_text: form.actions_text || null,
      program: form.program,
      order_index: parseInt(form.order_index) || 0,
      is_active: form.is_active
    }
    const { error } = openId === 'new'
      ? await supabase.from('rhymes').insert({ ...payload, school_id: schoolId })
      : await supabase.from('rhymes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', openId)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    closeRhyme()
    await fetchRhymes()
  }

  const deleteRhyme = async (rhyme) => {
    if (!confirm(`Delete rhyme "${rhyme.title}"? It will also be removed from Rhyme of the Week and parents' favourites.`)) return
    const { error: assignError } = await supabase.from('rhyme_assignments').delete().eq('rhyme_id', rhyme.id)
    if (assignError) { alert('Error: ' + assignError.message); return }
    await supabase.from('rhyme_favourites').delete().eq('rhyme_id', rhyme.id)
    const { error } = await supabase.from('rhymes').delete().eq('id', rhyme.id)
    if (error) { alert('Error: ' + error.message); return }
    if (openId === rhyme.id) closeRhyme()
    await Promise.all([fetchRhymes(), fetchAssignments()])
  }

  const toggleRhyme = async (rhyme) => {
    const { error } = await supabase.from('rhymes').update({ is_active: !rhyme.is_active, updated_at: new Date().toISOString() }).eq('id', rhyme.id)
    if (error) { alert('Error: ' + error.message); return }
    setRhymes(prev => prev.map(r => r.id === rhyme.id ? { ...r, is_active: !r.is_active } : r))
    if (openId === rhyme.id) setField('is_active', !rhyme.is_active)
  }

  const moveRhyme = async (index, dir) => {
    const changed = reorderedRows(rhymes, index, dir)
    if (!changed.length) return
    await Promise.all(changed.map(r => supabase.from('rhymes').update({ order_index: r.order_index }).eq('id', r.id)))
    await fetchRhymes()
    if (form && openId !== 'new') {
      const moved = changed.find(r => r.id === openId)
      if (moved) setField('order_index', moved.order_index)
    }
  }

  const handleUpload = async (file, kind) => {
    if (!file) return
    setUploading(kind)
    try {
      const url = await uploadToR2(file, `rhymes/${form.program}/${kind}`)
      setField(kind === 'video' ? 'video_url' : 'audio_url', url)
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(null)
  }

  // ---------- Rhyme of the Week ----------

  const today = toDateStr(new Date())
  const current = assignments.find(a => a.week_start_date <= today)
  const upcoming = assignments.filter(a => a.week_start_date > today).reverse()

  const saveAssignment = async () => {
    if (!assignRhymeId) { alert('Select a rhyme'); return }
    if (!assignDate) { alert('Select the week start date'); return }
    setAssigning(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('rhyme_assignments').insert({
      school_id: schoolId,
      program,
      rhyme_id: assignRhymeId,
      week_start_date: assignDate,
      assigned_by: session?.user?.id,
      is_active: true
    })
    setAssigning(false)
    if (error) { alert('Error: ' + error.message); return }
    setAssignRhymeId('')
    await fetchAssignments()
  }

  const removeAssignment = async (a) => {
    if (!confirm(`Remove "${a.rhymes?.title}" for the week of ${formatDate(a.week_start_date)}?`)) return
    const { error } = await supabase.from('rhyme_assignments').delete().eq('id', a.id)
    if (error) { alert('Error: ' + error.message); return }
    await fetchAssignments()
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: '10px',
    resize: 'vertical'
  }
  const labelStyle = { color: 'rgba(255,255,255,0.4)', fontSize: '12px', display: 'block', marginBottom: '4px' }

  const ActiveBadge = ({ active, onClick }) => (
    <button onClick={onClick} title={active ? 'Click to disable' : 'Click to enable'}
      style={{
        padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
        fontFamily: "'DM Sans', sans-serif",
        background: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
        color: active ? '#10b981' : 'rgba(255,255,255,0.4)'
      }}>
      {active ? '● Active' : '○ Disabled'}
    </button>
  )

  const youtubeId = form?.video_type === 'youtube' ? extractYouTubeId(form.video_url) : null

  const renderEditor = () => (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <label style={labelStyle}>Title *</label>
      <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder='e.g. Twinkle Twinkle Little Star' style={inputStyle} />

      <label style={labelStyle}>Lyrics</label>
      <textarea value={form.lyrics} onChange={e => setField('lyrics', e.target.value)} rows={8}
        placeholder={'Twinkle, twinkle, little star,\nHow I wonder what you are...'} style={inputStyle} />

      <label style={labelStyle}>Actions (movement instructions)</label>
      <textarea value={form.actions_text} onChange={e => setField('actions_text', e.target.value)} rows={3}
        placeholder='e.g. Open and close your hands like twinkling stars' style={inputStyle} />

      <label style={labelStyle}>Audio</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <label className='btn-secondary' style={{ display: 'inline-block', opacity: uploading ? 0.5 : 1 }}>
          {uploading === 'audio' ? '⏳ Uploading audio...' : '🎵 Upload MP3/WAV'}
          <input type='file' accept='audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav' hidden disabled={!!uploading}
            onChange={e => { handleUpload(e.target.files[0], 'audio'); e.target.value = '' }} />
        </label>
        {form.audio_url && (
          <>
            <audio src={form.audio_url} controls style={{ height: '36px' }} />
            <button type='button' onClick={() => setField('audio_url', '')} className='btn-icon' title='Remove audio'>✕</button>
          </>
        )}
      </div>

      <label style={labelStyle}>Video</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {['youtube', 'r2'].map(type => (
          <button key={type} type='button'
            onClick={() => { if (type !== form.video_type) setForm(prev => ({ ...prev, video_type: type, video_url: '' })) }}
            className={form.video_type === type ? 'tab tab-active' : 'tab'}>
            {type === 'youtube' ? '▶️ YouTube' : '☁️ Upload (R2)'}
          </button>
        ))}
      </div>
      {form.video_type === 'youtube' ? (
        <>
          <input value={form.video_url} onChange={e => setField('video_url', e.target.value)} placeholder='https://youtube.com/watch?v=...' style={inputStyle} />
          {form.video_url && (
            <div style={{ fontSize: '12px', marginTop: '-4px', marginBottom: '10px', color: youtubeId ? '#10b981' : '#ef4444' }}>
              {youtubeId ? `✓ Video ID: ${youtubeId}` : '✗ No YouTube video ID found in this URL'}
            </div>
          )}
          {youtubeId && (
            <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt='' style={{ width: '200px', borderRadius: '8px', marginBottom: '10px', display: 'block' }} />
          )}
        </>
      ) : (
        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className='btn-secondary' style={{ display: 'inline-block', opacity: uploading ? 0.5 : 1 }}>
            {uploading === 'video' ? '⏳ Uploading video...' : '📤 Upload Video'}
            <input type='file' accept='video/*' hidden disabled={!!uploading}
              onChange={e => { handleUpload(e.target.files[0], 'video'); e.target.value = '' }} />
          </label>
          {form.video_url && (
            <>
              <video src={form.video_url} controls style={{ width: '100%', maxWidth: '360px', borderRadius: '8px' }} />
              <button type='button' onClick={() => setField('video_url', '')} className='btn-icon' title='Remove video'>✕</button>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Program</label>
          <select value={form.program} onChange={e => setField('program', e.target.value)} style={{ ...inputStyle, width: '140px' }}>
            {PROGRAMS.map(p => <option key={p} value={p} style={{ background: '#1e293b' }}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Order Index</label>
          <input type='number' value={form.order_index} onChange={e => setField('order_index', e.target.value)} style={{ ...inputStyle, width: '100px' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px', cursor: 'pointer' }}>
          <input type='checkbox' checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
          Active
        </label>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type='button' onClick={closeRhyme} className='btn-secondary'>Cancel</button>
        <button type='button' onClick={saveRhyme} disabled={saving || !!uploading} className='btn-primary'>
          {saving ? '⏳ Saving...' : '💾 Save'}
        </button>
      </div>
    </div>
  )

  const assignmentLine = (a) => (
    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
      Week of {formatDate(a.week_start_date)}{a.assigner?.full_name ? ` · by ${a.assigner.full_name}` : ''}
    </span>
  )

  const activeRhymes = rhymes.filter(r => r.is_active)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 10px; }
        .btn-primary { background: linear-gradient(135deg, #a78bfa, #818cf8); border: none; border-radius: 10px; padding: 10px 20px; color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-primary:disabled { opacity: 0.6; cursor: default; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-icon { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; width: 28px; height: 28px; color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .btn-icon:disabled { opacity: 0.25; cursor: default; }
        .btn-icon.danger { color: #ef4444; }
        .tab { padding: 8px 16px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.07); }
        .tab-active { background: rgba(167,139,250,0.15); color: #a78bfa; border-color: rgba(167,139,250,0.3); }
        .layout { display: grid; grid-template-columns: 1fr 360px; gap: 20px; align-items: start; }
        .section-label { color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .rotw { background: linear-gradient(135deg, rgba(167,139,250,0.18), rgba(59,130,246,0.14)); border: 1px solid rgba(167,139,250,0.3); border-radius: 16px; padding: 18px; }
        @media (max-width: 1024px) { .layout { grid-template-columns: 1fr; } .rotw-col { order: -1; } }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎵 Rhymes</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
            Nursery rhymes shown to parents, per program, with a Rhyme of the Week
          </p>
        </div>

        {/* Program tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {PROGRAMS.map(p => (
            <button key={p} onClick={() => { setProgram(p); closeRhyme(); setAssignRhymeId('') }}
              className={program === p ? 'tab tab-active' : 'tab'}>
              {p}
            </button>
          ))}
        </div>

        <div className="layout">
          {/* Rhymes list */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="section-label">Rhymes · {program}</div>
              <button onClick={addRhyme} disabled={openId === 'new'} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
                + Add Rhyme
              </button>
            </div>

            {openId === 'new' && (
              <div className="card" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
                <div style={{ fontWeight: '700', color: '#a78bfa' }}>New Rhyme</div>
                {renderEditor()}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
            ) : rhymes.length === 0 && openId !== 'new' ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎵</div>
                <div style={{ fontWeight: '600' }}>No rhymes for {program} yet</div>
              </div>
            ) : rhymes.map((rhyme, i) => {
              const open = openId === rhyme.id
              return (
                <div key={rhyme.id} className="card" style={{ opacity: rhyme.is_active || open ? 1 : 0.55, borderColor: open ? 'rgba(167,139,250,0.3)' : undefined }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div onClick={() => openRhyme(rhyme)} style={{ flex: 1, minWidth: '180px', cursor: 'pointer' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: open ? '#a78bfa' : '#fff' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '8px' }}>{i + 1}.</span>{rhyme.title}
                        {current?.rhyme_id === rhyme.id && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#a78bfa' }}>⭐ This week</span>}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {rhyme.audio_url && <span>🎵 Audio</span>}
                        {rhyme.video_url && <span>{rhyme.video_type === 'youtube' ? '▶️ YouTube' : '☁️ Video'}</span>}
                        {rhyme.lyrics && <span>📝 Lyrics</span>}
                        {rhyme.actions_text && <span>🙌 Actions</span>}
                      </div>
                    </div>
                    <ActiveBadge active={rhyme.is_active} onClick={() => toggleRhyme(rhyme)} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon" disabled={i === 0} onClick={() => moveRhyme(i, -1)} title="Move up">▲</button>
                      <button className="btn-icon" disabled={i === rhymes.length - 1} onClick={() => moveRhyme(i, 1)} title="Move down">▼</button>
                      <button className="btn-icon" onClick={() => openRhyme(rhyme)} title={open ? 'Close' : 'Edit'}>{open ? '✕' : '✏️'}</button>
                      <button className="btn-icon danger" onClick={() => deleteRhyme(rhyme)} title="Delete">🗑</button>
                    </div>
                  </div>
                  {open && renderEditor()}
                </div>
              )
            })}
          </div>

          {/* Rhyme of the Week */}
          <div className="rotw-col">
            <div className="section-label" style={{ marginBottom: '12px' }}>Rhyme of the Week · {program}</div>
            <div className="rotw">
              {current ? (
                <>
                  <div style={{ color: '#c4b5fd', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>⭐ CURRENT</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', margin: '6px 0 4px' }}>{current.rhymes?.title || 'Deleted rhyme'}</div>
                  {assignmentLine(current)}
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>No Rhyme of the Week set for {program}.</div>
              )}

              {upcoming.length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>UPCOMING</div>
                  {upcoming.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{a.rhymes?.title || 'Deleted rhyme'}</div>
                        {assignmentLine(a)}
                      </div>
                      <button className="btn-icon danger" onClick={() => removeAssignment(a)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <label style={labelStyle}>Rhyme</label>
                <select value={assignRhymeId} onChange={e => setAssignRhymeId(e.target.value)} style={inputStyle}>
                  <option value='' style={{ background: '#1e293b' }}>Select a rhyme…</option>
                  {activeRhymes.map(r => <option key={r.id} value={r.id} style={{ background: '#1e293b' }}>{r.title}</option>)}
                </select>
                <label style={labelStyle}>Week starting</label>
                <input type='date' value={assignDate} onChange={e => setAssignDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                <button onClick={saveAssignment} disabled={assigning || !assignRhymeId} className="btn-primary" style={{ width: '100%' }}>
                  {assigning ? '⏳ Saving...' : '⭐ Set Rhyme of the Week'}
                </button>
                {activeRhymes.length === 0 && !loading && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '8px' }}>Add an active rhyme first.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

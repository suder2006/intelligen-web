'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const PROGRAMS = ['Playgroup', 'Nursery', 'LKG', 'UKG']

const EMPTY_MODULE = { title: '', description: '', icon: '🔤', order_index: 0, is_active: true }
const EMPTY_LESSON = {
  title: '', description: '', video_type: 'youtube', video_url: '', audio_url: '', image_url: '',
  example_words: '[]', activity_text: '', parent_tip: '', order_index: 0, is_active: true
}

// /api/upload and /api/generate-phonics reject requests without the signed-in user's token.
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

function lessonToForm(lesson) {
  return {
    ...EMPTY_LESSON,
    ...Object.fromEntries(Object.entries(lesson).filter(([, v]) => v !== null)),
    example_words: JSON.stringify(lesson.example_words || [], null, 2)
  }
}

export default function AdminPhonicsPage() {
  const { schoolId } = useSchool()
  const [program, setProgram] = useState(PROGRAMS[0])
  const [modules, setModules] = useState([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [selectedModule, setSelectedModule] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loadingLessons, setLoadingLessons] = useState(false)

  const [moduleForm, setModuleForm] = useState(null) // null = modal closed
  const [savingModule, setSavingModule] = useState(false)

  const [openLessonId, setOpenLessonId] = useState(null) // lesson id, or 'new'
  const [lessonForm, setLessonForm] = useState(null)
  const [savingLesson, setSavingLesson] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(null) // 'video' | 'audio' | 'image'

  useEffect(() => { if (schoolId) fetchModules() }, [schoolId, program])
  useEffect(() => { if (selectedModule) fetchLessons(selectedModule.id); else setLessons([]) }, [selectedModule?.id])

  const fetchModules = async (keepSelectedId) => {
    setLoadingModules(true)
    const { data } = await supabase
      .from('phonics_modules')
      .select('*')
      .eq('school_id', schoolId)
      .eq('program', program)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
    setModules(data || [])
    setSelectedModule(data?.find(m => m.id === keepSelectedId) || null)
    setLoadingModules(false)
  }

  const fetchLessons = async (moduleId) => {
    setLoadingLessons(true)
    const { data } = await supabase
      .from('phonics_lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
    setLessons(data || [])
    setLoadingLessons(false)
  }

  // ---------- Modules ----------

  const saveModule = async () => {
    if (!moduleForm.title.trim()) { alert('Title is required'); return }
    setSavingModule(true)
    const payload = {
      title: moduleForm.title.trim(),
      description: moduleForm.description || null,
      icon: moduleForm.icon || null,
      order_index: parseInt(moduleForm.order_index) || 0,
      is_active: moduleForm.is_active
    }
    const { error } = moduleForm.id
      ? await supabase.from('phonics_modules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', moduleForm.id)
      : await supabase.from('phonics_modules').insert({ ...payload, school_id: schoolId, program })
    setSavingModule(false)
    if (error) { alert('Error: ' + error.message); return }
    setModuleForm(null)
    await fetchModules(moduleForm.id || selectedModule?.id)
  }

  const deleteModule = async (mod) => {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    const { error: lessonsError } = await supabase.from('phonics_lessons').delete().eq('module_id', mod.id)
    if (lessonsError) { alert('Error: ' + lessonsError.message); return }
    const { error } = await supabase.from('phonics_modules').delete().eq('id', mod.id)
    if (error) { alert('Error: ' + error.message); return }
    await fetchModules(selectedModule?.id === mod.id ? null : selectedModule?.id)
  }

  const toggleModule = async (mod) => {
    const { error } = await supabase.from('phonics_modules').update({ is_active: !mod.is_active, updated_at: new Date().toISOString() }).eq('id', mod.id)
    if (error) { alert('Error: ' + error.message); return }
    setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_active: !m.is_active } : m))
  }

  const moveModule = async (index, dir) => {
    const changed = reorderedRows(modules, index, dir)
    if (!changed.length) return
    await Promise.all(changed.map(m => supabase.from('phonics_modules').update({ order_index: m.order_index }).eq('id', m.id)))
    await fetchModules(selectedModule?.id)
  }

  // ---------- Lessons ----------

  const openLesson = (lesson) => {
    if (openLessonId === lesson.id) { setOpenLessonId(null); setLessonForm(null); return }
    setOpenLessonId(lesson.id)
    setLessonForm(lessonToForm(lesson))
  }

  const addLesson = () => {
    setOpenLessonId('new')
    setLessonForm({ ...EMPTY_LESSON, order_index: lessons.length })
  }

  const closeLesson = () => { setOpenLessonId(null); setLessonForm(null) }

  const setField = (field, value) => setLessonForm(prev => ({ ...prev, [field]: value }))

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) { alert('Title is required'); return }
    let exampleWords
    try {
      exampleWords = lessonForm.example_words.trim() ? JSON.parse(lessonForm.example_words) : []
    } catch {
      alert('Example words must be valid JSON, e.g. [{"word": "apple", "emoji": "🍎"}]')
      return
    }
    let videoUrl = lessonForm.video_url?.trim() || null
    if (videoUrl && lessonForm.video_type === 'youtube') {
      const id = extractYouTubeId(videoUrl)
      if (!id) { alert('Could not find a YouTube video ID in that URL'); return }
      videoUrl = `https://www.youtube.com/watch?v=${id}`
    }
    setSavingLesson(true)
    const payload = {
      title: lessonForm.title.trim(),
      description: lessonForm.description || null,
      video_type: lessonForm.video_type,
      video_url: videoUrl,
      audio_url: lessonForm.audio_url || null,
      image_url: lessonForm.image_url || null,
      example_words: exampleWords,
      activity_text: lessonForm.activity_text || null,
      parent_tip: lessonForm.parent_tip || null,
      order_index: parseInt(lessonForm.order_index) || 0,
      is_active: lessonForm.is_active
    }
    const { error } = openLessonId === 'new'
      ? await supabase.from('phonics_lessons').insert({ ...payload, module_id: selectedModule.id })
      : await supabase.from('phonics_lessons').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', openLessonId)
    setSavingLesson(false)
    if (error) { alert('Error: ' + error.message); return }
    closeLesson()
    await fetchLessons(selectedModule.id)
  }

  const deleteLesson = async (lesson) => {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    const { error } = await supabase.from('phonics_lessons').delete().eq('id', lesson.id)
    if (error) { alert('Error: ' + error.message); return }
    if (openLessonId === lesson.id) closeLesson()
    await fetchLessons(selectedModule.id)
  }

  const toggleLesson = async (lesson) => {
    const { error } = await supabase.from('phonics_lessons').update({ is_active: !lesson.is_active, updated_at: new Date().toISOString() }).eq('id', lesson.id)
    if (error) { alert('Error: ' + error.message); return }
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_active: !l.is_active } : l))
    if (openLessonId === lesson.id) setField('is_active', !lesson.is_active)
  }

  const moveLesson = async (index, dir) => {
    const changed = reorderedRows(lessons, index, dir)
    if (!changed.length) return
    await Promise.all(changed.map(l => supabase.from('phonics_lessons').update({ order_index: l.order_index }).eq('id', l.id)))
    await fetchLessons(selectedModule.id)
    if (lessonForm && openLessonId !== 'new') {
      const moved = changed.find(l => l.id === openLessonId)
      if (moved) setField('order_index', moved.order_index)
    }
  }

  const generateWithAI = async () => {
    if (!lessonForm.title.trim()) { alert('Enter a lesson title first so the AI knows what to write about'); return }
    const hasContent = lessonForm.activity_text || lessonForm.parent_tip || (lessonForm.example_words.trim() && lessonForm.example_words.trim() !== '[]')
    if (hasContent && !confirm('Replace the current activity, parent tip and example words with AI content?')) return
    setGenerating(true)
    try {
      const response = await fetch('/api/generate-phonics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          program,
          moduleTitle: selectedModule?.title,
          lessonTitle: lessonForm.title,
          lessonDescription: lessonForm.description
        })
      })
      const data = await response.json()
      if (!response.ok) {
        alert('Error: ' + data.error)
      } else {
        setLessonForm(prev => ({
          ...prev,
          activity_text: data.activity_text,
          parent_tip: data.parent_tip,
          example_words: JSON.stringify(data.example_words, null, 2)
        }))
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setGenerating(false)
  }

  const handleUpload = async (file, kind) => {
    if (!file) return
    const fieldByKind = { video: 'video_url', audio: 'audio_url', image: 'image_url' }
    setUploading(kind)
    try {
      const url = await uploadToR2(file, `phonics/${selectedModule.id}/${kind}`)
      setField(fieldByKind[kind], url)
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(null)
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

  const youtubeId = lessonForm?.video_type === 'youtube' ? extractYouTubeId(lessonForm.video_url) : null

  const renderLessonEditor = () => (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <label style={labelStyle}>Title *</label>
      <input value={lessonForm.title} onChange={e => setField('title', e.target.value)} placeholder='e.g. Letter A – /a/ sound' style={inputStyle} />

      <label style={labelStyle}>Description</label>
      <textarea value={lessonForm.description} onChange={e => setField('description', e.target.value)} rows={2} style={inputStyle} />

      <label style={labelStyle}>Video</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {['youtube', 'r2'].map(type => (
          <button key={type} type='button'
            onClick={() => { if (type !== lessonForm.video_type) setLessonForm(prev => ({ ...prev, video_type: type, video_url: '' })) }}
            className={lessonForm.video_type === type ? 'tab tab-active' : 'tab'}>
            {type === 'youtube' ? '▶️ YouTube' : '☁️ Upload (R2)'}
          </button>
        ))}
      </div>
      {lessonForm.video_type === 'youtube' ? (
        <>
          <input value={lessonForm.video_url} onChange={e => setField('video_url', e.target.value)} placeholder='https://youtube.com/watch?v=...' style={inputStyle} />
          {lessonForm.video_url && (
            <div style={{ fontSize: '12px', marginTop: '-4px', marginBottom: '10px', color: youtubeId ? '#10b981' : '#ef4444' }}>
              {youtubeId ? `✓ Video ID: ${youtubeId}` : '✗ No YouTube video ID found in this URL'}
            </div>
          )}
          {youtubeId && (
            <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} alt='' style={{ width: '200px', borderRadius: '8px', marginBottom: '10px', display: 'block' }} />
          )}
        </>
      ) : (
        <div style={{ marginBottom: '10px' }}>
          <label className='btn-secondary' style={{ display: 'inline-block', opacity: uploading ? 0.5 : 1 }}>
            {uploading === 'video' ? '⏳ Uploading video...' : '📤 Upload Video'}
            <input type='file' accept='video/*' hidden disabled={!!uploading}
              onChange={e => { handleUpload(e.target.files[0], 'video'); e.target.value = '' }} />
          </label>
          {lessonForm.video_url && (
            <video src={lessonForm.video_url} controls style={{ width: '100%', maxWidth: '360px', borderRadius: '8px', marginTop: '10px', display: 'block' }} />
          )}
        </div>
      )}

      <label style={labelStyle}>Audio</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <label className='btn-secondary' style={{ display: 'inline-block', opacity: uploading ? 0.5 : 1 }}>
          {uploading === 'audio' ? '⏳ Uploading audio...' : '🎵 Upload MP3/WAV'}
          <input type='file' accept='audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav' hidden disabled={!!uploading}
            onChange={e => { handleUpload(e.target.files[0], 'audio'); e.target.value = '' }} />
        </label>
        {lessonForm.audio_url && (
          <>
            <audio src={lessonForm.audio_url} controls style={{ height: '36px' }} />
            <button type='button' onClick={() => setField('audio_url', '')} className='btn-icon' title='Remove audio'>✕</button>
          </>
        )}
      </div>

      <label style={labelStyle}>Image URL</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <input value={lessonForm.image_url} onChange={e => setField('image_url', e.target.value)} placeholder='https://...' style={{ ...inputStyle, flex: 1 }} />
        <label className='btn-secondary' style={{ whiteSpace: 'nowrap', opacity: uploading ? 0.5 : 1 }}>
          {uploading === 'image' ? '⏳' : '🖼️ Upload'}
          <input type='file' accept='image/*' hidden disabled={!!uploading}
            onChange={e => { handleUpload(e.target.files[0], 'image'); e.target.value = '' }} />
        </label>
      </div>
      {lessonForm.image_url && (
        <img src={lessonForm.image_url} alt='' style={{ maxWidth: '160px', borderRadius: '8px', marginBottom: '10px', display: 'block' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 10px' }}>
        <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700' }}>Lesson Content</div>
        <button type='button' onClick={generateWithAI} disabled={generating} className='btn-ai'>
          {generating ? '⏳ Generating...' : '✨ Generate with AI'}
        </button>
      </div>

      <label style={labelStyle}>Example Words (JSON)</label>
      <textarea value={lessonForm.example_words} onChange={e => setField('example_words', e.target.value)} rows={5}
        placeholder='[{"word": "apple", "emoji": "🍎"}]' style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }} />

      <label style={labelStyle}>Activity</label>
      <textarea value={lessonForm.activity_text} onChange={e => setField('activity_text', e.target.value)} rows={4} style={inputStyle} />

      <label style={labelStyle}>Parent Tip</label>
      <textarea value={lessonForm.parent_tip} onChange={e => setField('parent_tip', e.target.value)} rows={3} style={inputStyle} />

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Order Index</label>
          <input type='number' value={lessonForm.order_index} onChange={e => setField('order_index', e.target.value)} style={{ ...inputStyle, width: '100px' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px', cursor: 'pointer' }}>
          <input type='checkbox' checked={lessonForm.is_active} onChange={e => setField('is_active', e.target.checked)} />
          Active
        </label>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type='button' onClick={closeLesson} className='btn-secondary'>Cancel</button>
        <button type='button' onClick={saveLesson} disabled={savingLesson || !!uploading} className='btn-primary'>
          {savingLesson ? '⏳ Saving...' : '💾 Save'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 10px; }
        .btn-primary { background: linear-gradient(135deg, #f59e0b, #fbbf24); border: none; border-radius: 10px; padding: 10px 20px; color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-primary:disabled, .btn-ai:disabled { opacity: 0.6; cursor: default; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-ai { background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.35); border-radius: 10px; padding: 8px 16px; color: #c084fc; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-icon { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; width: 28px; height: 28px; color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .btn-icon:disabled { opacity: 0.25; cursor: default; }
        .btn-icon.danger { color: #ef4444; }
        .tab { padding: 8px 16px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.07); }
        .tab-active { background: rgba(245,158,11,0.15); color: #f59e0b; border-color: rgba(245,158,11,0.3); }
        .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
        .section-label { color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; }
        @media (max-width: 1024px) { .layout { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🔤 Phonics</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
            Phonics modules and lessons shown to parents, per program
          </p>
        </div>

        {/* Program tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {PROGRAMS.map(p => (
            <button key={p} onClick={() => { setProgram(p); setSelectedModule(null); closeLesson() }}
              className={program === p ? 'tab tab-active' : 'tab'}>
              {p}
            </button>
          ))}
        </div>

        <div className="layout">
          {/* Modules */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="section-label">Modules · {program}</div>
              <button onClick={() => setModuleForm({ ...EMPTY_MODULE, order_index: modules.length })} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
                + Add Module
              </button>
            </div>

            {loadingModules ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
            ) : modules.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔤</div>
                <div style={{ fontWeight: '600' }}>No modules for {program} yet</div>
              </div>
            ) : modules.map((mod, i) => {
              const selected = selectedModule?.id === mod.id
              return (
                <div key={mod.id} className="card"
                  onClick={() => { if (!selected) { setSelectedModule(mod); closeLesson() } }}
                  style={{
                    cursor: 'pointer', opacity: mod.is_active ? 1 : 0.55,
                    background: selected ? 'rgba(245,158,11,0.1)' : undefined,
                    borderColor: selected ? 'rgba(245,158,11,0.3)' : undefined
                  }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '28px', lineHeight: '32px' }}>{mod.icon || '🔤'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: selected ? '#f59e0b' : '#fff' }}>{mod.title}</div>
                      {mod.description && (
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '3px', lineHeight: '18px' }}>{mod.description}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                    <ActiveBadge active={mod.is_active} onClick={() => toggleModule(mod)} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon" disabled={i === 0} onClick={() => moveModule(i, -1)} title="Move up">▲</button>
                      <button className="btn-icon" disabled={i === modules.length - 1} onClick={() => moveModule(i, 1)} title="Move down">▼</button>
                      <button className="btn-icon" onClick={() => setModuleForm({ ...EMPTY_MODULE, ...Object.fromEntries(Object.entries(mod).filter(([, v]) => v !== null)) })} title="Edit">✏️</button>
                      <button className="btn-icon danger" onClick={() => deleteModule(mod)} title="Delete">🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lessons */}
          <div>
            {!selectedModule ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>👈</div>
                <div style={{ fontWeight: '600' }}>Select a module to see its lessons</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="section-label">{selectedModule.icon} {selectedModule.title} · Lessons</div>
                  <button onClick={addLesson} disabled={openLessonId === 'new'} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
                    + Add Lesson
                  </button>
                </div>

                {openLessonId === 'new' && (
                  <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
                    <div style={{ fontWeight: '700', color: '#f59e0b' }}>New Lesson</div>
                    {renderLessonEditor()}
                  </div>
                )}

                {loadingLessons ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
                ) : lessons.length === 0 && openLessonId !== 'new' ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    No lessons in this module yet
                  </div>
                ) : lessons.map((lesson, i) => {
                  const open = openLessonId === lesson.id
                  return (
                    <div key={lesson.id} className="card" style={{ opacity: lesson.is_active || open ? 1 : 0.55, borderColor: open ? 'rgba(245,158,11,0.3)' : undefined }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div onClick={() => openLesson(lesson)} style={{ flex: 1, minWidth: '180px', cursor: 'pointer' }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: open ? '#f59e0b' : '#fff' }}>
                            <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '8px' }}>{i + 1}.</span>{lesson.title}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {lesson.video_url && <span>{lesson.video_type === 'youtube' ? '▶️ YouTube' : '☁️ Video'}</span>}
                            {lesson.audio_url && <span>🎵 Audio</span>}
                            {lesson.image_url && <span>🖼️ Image</span>}
                            {Array.isArray(lesson.example_words) && lesson.example_words.length > 0 && <span>🔡 {lesson.example_words.length} words</span>}
                            {lesson.activity_text && <span>🎨 Activity</span>}
                            {lesson.parent_tip && <span>💡 Tip</span>}
                          </div>
                        </div>
                        <ActiveBadge active={lesson.is_active} onClick={() => toggleLesson(lesson)} />
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-icon" disabled={i === 0} onClick={() => moveLesson(i, -1)} title="Move up">▲</button>
                          <button className="btn-icon" disabled={i === lessons.length - 1} onClick={() => moveLesson(i, 1)} title="Move down">▼</button>
                          <button className="btn-icon" onClick={() => openLesson(lesson)} title={open ? 'Close' : 'Edit'}>{open ? '✕' : '✏️'}</button>
                          <button className="btn-icon danger" onClick={() => deleteLesson(lesson)} title="Delete">🗑</button>
                        </div>
                      </div>
                      {open && renderLessonEditor()}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Module modal */}
      {moduleForm && (
        <div onClick={() => setModuleForm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
              {moduleForm.id ? 'Edit Module' : `New ${program} Module`}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Icon</label>
                <input value={moduleForm.icon} onChange={e => setModuleForm({ ...moduleForm, icon: e.target.value })}
                  style={{ ...inputStyle, width: '64px', textAlign: 'center', fontSize: '20px', padding: '6px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Title *</label>
                <input value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} placeholder='e.g. Letter Sounds A–E' style={inputStyle} autoFocus />
              </div>
            </div>
            <label style={labelStyle}>Description</label>
            <textarea value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} rows={3} style={inputStyle} />
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Order Index</label>
                <input type='number' value={moduleForm.order_index} onChange={e => setModuleForm({ ...moduleForm, order_index: e.target.value })} style={{ ...inputStyle, width: '100px' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px', cursor: 'pointer' }}>
                <input type='checkbox' checked={moduleForm.is_active} onChange={e => setModuleForm({ ...moduleForm, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button onClick={() => setModuleForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveModule} disabled={savingModule} className="btn-primary">
                {savingModule ? '⏳ Saving...' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

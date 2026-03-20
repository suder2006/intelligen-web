'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSchool } from '@/hooks/useSchool'

export default function ClassroomMomentsAdmin() {
  const router = useRouter()
  const { schoolId } = useSchool()
  const [moments, setMoments] = useState([])
  const [classes, setClasses] = useState([])
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [className, setClassName] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [filterDate, setFilterDate] = useState('')
  const [preview, setPreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileRef = useRef()

useEffect(() => {
    if (!schoolId) return
    fetchMoments()
    supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value').then(({ data }) => setClasses(data?.map(d => ({ id: d.id, name: d.value })) || []))
  }, [schoolId])

async function fetchMoments() {
    const { data } = await supabase.from('classroom_moments').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
    setMoments(data || [])
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto() {
    if (!selectedFile || !className) { alert('Please select a photo and class'); return }
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop()
      const path = `${className}/${selectedDate}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('classroom-moments').upload(path, selectedFile)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('classroom-moments').getPublicUrl(path)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      await supabase.from('classroom_moments').insert({
        class_name: className, caption, photo_url: publicUrl,
        storage_path: path, uploaded_by: user.id,
        uploaded_by_name: prof?.full_name || 'Admin',
        moment_date: selectedDate, school_id: schoolId
      })
      setCaption('')
      setPreview(null)
      setSelectedFile(null)
      fileRef.current.value = ''
      await fetchMoments()
      alert('Photo uploaded successfully!')
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(false)
  }

  async function deleteMoment(id, storagePath) {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('classroom-moments').remove([storagePath])
    await supabase.from('classroom_moments').delete().eq('id', id)
    fetchMoments()
  }

  const filtered = filterDate ? moments.filter(m => m.moment_date === filterDate) : moments
  const grouped = filtered.reduce((acc, m) => {
    const key = m.moment_date
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📸 Classroom Moments</h1>
        </div>

        {/* Upload Section */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', marginBottom: '24px' }}>
          <h3 style={{ color: '#38bdf8', marginBottom: '20px' }}>📤 Upload New Photo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Class *</label>
              <select value={className} onChange={e => setClassName(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }}>
                <option value=''>-- Select Class --</option>
                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Date</label>
              <input type='date' value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px' }}>Caption (optional)</label>
            <input placeholder='e.g. Finger painting activity today!' value={caption} onChange={e => setCaption(e.target.value)}
              style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <input ref={fileRef} type='file' accept='image/jpeg,image/png,image/webp' onChange={handleFileSelect}
              style={{ color: '#94a3b8', fontSize: '14px' }} />
          </div>
          {preview && (
            <div style={{ marginBottom: '16px' }}>
              <img src={preview} alt='Preview' style={{ maxHeight: '200px', borderRadius: '10px', border: '1px solid #334155' }} />
            </div>
          )}
          <button onClick={uploadPhoto} disabled={uploading}
            style={{ padding: '12px 28px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
            {uploading ? '⏳ Uploading...' : '📤 Upload Photo'}
          </button>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Filter by date:</span>
          <input type='date' value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '8px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
          {filterDate && <button onClick={() => setFilterDate('')} style={{ padding: '8px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Clear</button>}
        </div>

        {/* Photos Grid */}
        {Object.keys(grouped).length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
            <p>No photos yet. Upload your first classroom moment!</p>
          </div>
        )}
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#38bdf8' }}>📅 {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <span style={{ color: '#64748b', fontSize: '13px' }}>{items.length} photo{items.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {items.map(m => (
                <div key={m.id} style={{ backgroundColor: '#1e293b', borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155' }}>
                  <img src={m.photo_url} alt={m.caption} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                  <div style={{ padding: '12px' }}>
                    {m.caption && <p style={{ color: '#e2e8f0', fontSize: '13px', marginBottom: '6px' }}>{m.caption}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>📚 {m.class_name}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a href={m.photo_url} download target='_blank'
                          style={{ padding: '4px 10px', backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>⬇️</a>
                        <button onClick={() => deleteMoment(m.id, m.storage_path)}
                          style={{ padding: '4px 10px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>by {m.uploaded_by_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
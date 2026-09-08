'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

export default function AdminAlbumsPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [albums, setAlbums] = useState([])
  const [programs, setPrograms] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [albumMedia, setAlbumMedia] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [view, setView] = useState('albums')
  const fileRef = useRef()
  const videoRef = useRef()

  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    program: '',
    event_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { if (schoolId) fetchData() }, [schoolId])

  const fetchData = async () => {
    setLoading(true)
    const [albumsRes, progsRes] = await Promise.all([
      supabase.from('moment_albums')
        .select('*, profiles(full_name)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabase.from('curriculum_masters')
        .select('value').eq('type', 'program')
        .eq('school_id', schoolId).order('value')
    ])
    setAlbums(albumsRes.data || [])
    setPrograms(progsRes.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const fetchAlbumMedia = async (albumId) => {
    const { data } = await supabase.from('classroom_moments')
      .select('*')
      .eq('album_id', albumId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setAlbumMedia(data || [])
  }

  const selectAlbum = async (album) => {
    setSelectedAlbum(album)
    setView('media')
    await fetchAlbumMedia(album.id)
  }

  const createAlbum = async () => {
    if (!albumForm.title) { alert('Please enter album title'); return }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('moment_albums').insert({
        school_id: schoolId,
        title: albumForm.title,
        description: albumForm.description,
        program: albumForm.program || null,
        event_date: albumForm.event_date,
        created_by: user.id,
        is_permanent: true
      }).select().single()
      if (error) throw error
      setShowCreateModal(false)
      setAlbumForm({ title: '', description: '', program: '', event_date: new Date().toISOString().split('T')[0] })
      await fetchData()
      alert('✅ Album created!')
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

    const compressImage = async (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new window.Image()
      img.onload = () => {
        const maxWidth = 1200
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
          'image/jpeg',
          0.75
        )
      }
      img.src = URL.createObjectURL(file)
    })
  }

  // classroom_moments.photo_url is NOT NULL, so a video row still needs an image.
  // Grab a poster frame from the file so the row is valid and the video renders
  // as a real thumbnail in the album grid and the parent app.
  const captureVideoThumbnail = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const objectUrl = URL.createObjectURL(file)
      let settled = false
      const done = (result) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(objectUrl)
        resolve(result)
      }

      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, (video.duration || 2) / 2)
      }
      video.onseeked = () => {
        try {
          const maxWidth = 800
          const vw = video.videoWidth || maxWidth
          const vh = video.videoHeight || maxWidth
          const scale = Math.min(1, maxWidth / vw)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(vw * scale)
          canvas.height = Math.round(vh * scale)
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(
            (blob) => done(blob ? new File([blob], 'thumb.jpg', { type: 'image/jpeg' }) : null),
            'image/jpeg',
            0.7
          )
        } catch (e) {
          console.warn('Thumbnail capture failed:', e)
          done(null)
        }
      }
      // Codec the browser cannot decode (e.g. some .mov files) - fall back silently
      video.onerror = () => done(null)
      setTimeout(() => done(null), 15000)
      video.src = objectUrl
    })
  }

  const uploadVideoThumbnail = async (file, folder) => {
    try {
      const thumb = await captureVideoThumbnail(file)
      if (!thumb) return null
      const formData = new FormData()
      formData.append('file', thumb)
      formData.append('folder', `${folder}/thumbs`)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        console.warn('Thumbnail upload failed:', data.error)
        return null
      }
      return data.publicUrl
    } catch (e) {
      console.warn('Thumbnail upload failed:', e)
      return null
    }
  }

  const deleteFromR2 = (key) =>
    fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    })

  // R2 keys are the URL path, so a stored public URL maps straight back to its object
  const keyFromUrl = (url) => {
    if (!url) return null
    try {
      return decodeURIComponent(new URL(url).pathname).replace(/^\//, '')
    } catch {
      return null
    }
  }

  const uploadMedia = async (files, mediaType) => {
    if (!selectedAlbum) return
    setUploading(true)
    setUploadProgress(0)
    const total = files.length
    let completed = 0

    try {
      const { data: { user } } = await supabase.auth.getUser()

      for (const file of files) {
        let publicUrl, key, thumbnailUrl = null

        if (mediaType === 'video') {
          const presignRes = await fetch(
            `/api/upload?folder=albums/${selectedAlbum.id}&contentType=${file.type}`
          )
          const presignData = await presignRes.json()
          if (presignData.error) throw new Error(presignData.error)

          const r2Res = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          })
          console.log('R2 upload status:', r2Res.status, r2Res.ok)
          if (!r2Res.ok) {
            const detail = await r2Res.text().catch(() => '')
            throw new Error(`R2 upload failed: ${r2Res.status} ${detail}`)
          }

          publicUrl = presignData.publicUrl
          key = presignData.key
          thumbnailUrl = await uploadVideoThumbnail(file, `albums/${selectedAlbum.id}`)
        } else {
          const compressed = await compressImage(file)
          const formData = new FormData()
          formData.append('file', compressed)
          formData.append('folder', `albums/${selectedAlbum.id}`)

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })
          const data = await res.json()
          if (data.error) throw new Error(data.error)
          publicUrl = data.publicUrl
          key = data.key
        }

        const row = {
          school_id: schoolId,
          album_id: selectedAlbum.id,
          class_name: selectedAlbum.program || 'All',
          // photo_url is NOT NULL: videos fall back to the poster frame, then to
          // the video URL itself if the browser could not decode the file
          photo_url: mediaType === 'photo' ? publicUrl : (thumbnailUrl || publicUrl),
          video_url: mediaType === 'video' ? publicUrl : null,
          thumbnail_url: mediaType === 'video' ? thumbnailUrl : null,
          storage_path: key,
          media_type: mediaType,
          moment_date: selectedAlbum.event_date,
          uploaded_by: user.id,
          uploaded_by_name: 'Admin'
        }

        const { error: dbError } = await supabase.from('classroom_moments').insert(row)
        if (dbError) {
          console.error('classroom_moments insert failed', {
            row,
            message: dbError.message,
            code: dbError.code,
            details: dbError.details,
            hint: dbError.hint
          })
          throw new Error(
            `DB insert failed (${dbError.code || 'unknown'}): ${dbError.message}` +
            (dbError.details ? ` - ${dbError.details}` : '') +
            (dbError.hint ? ` (${dbError.hint})` : '')
          )
        }

        if (mediaType === 'photo' && !selectedAlbum.cover_url) {
          await supabase.from('moment_albums')
            .update({ cover_url: publicUrl })
            .eq('id', selectedAlbum.id)
          setSelectedAlbum(prev => ({ ...prev, cover_url: publicUrl }))
        }

        completed++
        setUploadProgress(Math.round((completed / total) * 100))
      }

      await fetchAlbumMedia(selectedAlbum.id)
      await fetchData()
      alert(`✅ ${completed} ${mediaType}(s) uploaded!`)
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setUploading(false)
    setUploadProgress(0)
    if (fileRef.current) fileRef.current.value = ''
    if (videoRef.current) videoRef.current.value = ''
  }

  const deleteMedia = async (media) => {
    if (!confirm('Delete this photo/video?')) return
    setDeleting(media.id)
    try {
      if (media.storage_path) {
        await deleteFromR2(media.storage_path)
      }
      const thumbKey = keyFromUrl(media.thumbnail_url)
      if (thumbKey) {
        await deleteFromR2(thumbKey).catch(e => console.log('R2 thumb delete error:', e))
      }
      await supabase.from('classroom_moments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', media.id)
      setAlbumMedia(prev => prev.filter(m => m.id !== media.id))
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setDeleting(null)
  }

  const deleteAlbum = async (album) => {
    if (!confirm(`Delete album "${album.title}" and all its content?`)) return
    try {
      // Get all media
      const { data: media } = await supabase.from('classroom_moments')
        .select('storage_path, thumbnail_url').eq('album_id', album.id)

      // Delete from R2 (media plus any video poster frames)
      if (media?.length > 0) {
        const keys = media.flatMap(m => [m.storage_path, keyFromUrl(m.thumbnail_url)]).filter(Boolean)
        await Promise.all(keys.map(key =>
          deleteFromR2(key).catch(e => console.log('R2 delete error:', e))
        ))
      }

      // Soft delete moments
      await supabase.from('classroom_moments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('album_id', album.id)

      // Delete album
      await supabase.from('moment_albums').delete().eq('id', album.id)

      if (selectedAlbum?.id === album.id) {
        setSelectedAlbum(null)
        setAlbumMedia([])
        setView('albums')
      }
      await fetchData()
      alert('✅ Album deleted!')
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  const setCover = async (media) => {
    if (media.media_type !== 'photo') { alert('Please select a photo as cover'); return }
    await supabase.from('moment_albums')
      .update({ cover_url: media.photo_url })
      .eq('id', selectedAlbum.id)
    setSelectedAlbum(prev => ({ ...prev, cover_url: media.photo_url }))
    alert('✅ Cover photo updated!')
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
    marginBottom: '12px'
  }

  const photos = albumMedia.filter(m => m.media_type === 'photo')
  const videos = albumMedia.filter(m => m.media_type === 'video')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn { border: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            {view === 'media' && selectedAlbum ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn"
                  onClick={() => { setView('albums'); setSelectedAlbum(null); setAlbumMedia([]) }}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                  ← Back
                </button>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '700' }}>🎞️ {selectedAlbum.title}</h1>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                    {selectedAlbum.program || 'All Programs'} · {selectedAlbum.event_date}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎞️ Photo Albums</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
                  Create and manage event albums for parents
                </p>
              </div>
            )}
          </div>

          {view === 'albums' && (
            <button className="btn"
              onClick={() => setShowCreateModal(true)}
              style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', padding: '10px 20px' }}>
              + Create Album
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : view === 'albums' ? (
          <>
            {/* Albums grid */}
            {albums.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎞️</div>
                <div style={{ fontWeight: '600', fontSize: '18px', marginBottom: '8px' }}>No albums yet</div>
                <div style={{ fontSize: '14px', marginBottom: '24px' }}>Create your first album to share event photos with parents</div>
                <button className="btn"
                  onClick={() => setShowCreateModal(true)}
                  style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', padding: '12px 24px', fontSize: '14px' }}>
                  + Create First Album
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {albums.map(album => {
                  return (
                    <div key={album.id}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => selectAlbum(album)}>

                      {/* Cover photo */}
                      <div style={{ height: '160px', background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                        {album.cover_url ? (
                          <img src={album.cover_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '48px' }}>🎞️</div>
                        )}
                        {album.program && (
                          <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(167,139,250,0.9)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                            {album.program}
                          </div>
                        )}
                        {!album.program && (
                          <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(56,189,248,0.9)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                            All Programs
                          </div>
                        )}
                      </div>

                      {/* Album info */}
                      <div style={{ padding: '14px' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{album.title}</div>
                        {album.description && (
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>{album.description}</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                            📅 {new Date(album.event_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <button className="btn"
                            onClick={e => { e.stopPropagation(); deleteAlbum(album) }}
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '4px 10px', fontSize: '12px' }}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* Album media view */
          <>
            {/* Upload section */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600', marginBottom: '14px' }}>📤 Upload to this album</div>

              {uploading && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Uploading...</span>
                    <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#10b981', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" multiple
                    onChange={e => uploadMedia(Array.from(e.target.files), 'photo')}
                    style={{ display: 'none' }} />
                  <button className="btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                    🖼️ Add Photos
                  </button>
                </div>
                <div>
                  <input ref={videoRef} type="file" accept="video/*"
                    onChange={e => uploadMedia(Array.from(e.target.files), 'video')}
                    style={{ display: 'none' }} />
                  <button className="btn"
                    onClick={() => videoRef.current?.click()}
                    disabled={uploading}
                    style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
                    🎥 Add Video
                  </button>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', alignSelf: 'center' }}>
                  📸 {photos.length} photos · 🎥 {videos.length} videos
                </div>
              </div>
            </div>

            {/* Media grid */}
            {albumMedia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
                <div>No photos or videos yet. Upload some!</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {albumMedia.map(media => (
                  <div key={media.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
                    {media.media_type === 'photo' ? (
                      <img src={media.photo_url} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '160px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                        {media.thumbnail_url && (
                          <img src={media.thumbnail_url} style={{ position: 'absolute', inset: 0, width: '100%', height: '160px', objectFit: 'cover' }} />
                        )}
                        <div style={{ position: 'relative', fontSize: '36px', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>🎥</div>
                        <a href={media.video_url} target="_blank" rel="noreferrer"
                          style={{ position: 'relative', color: '#38bdf8', fontSize: '11px', fontWeight: '600', background: 'rgba(0,0,0,0.55)', padding: '3px 10px', borderRadius: '20px' }}>▶ Preview</a>
                      </div>
                    )}

                    {/* Cover indicator */}
                    {selectedAlbum?.cover_url === media.photo_url && (
                      <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#10b981', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', color: '#fff' }}>
                        COVER
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ padding: '8px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {media.media_type === 'photo' && (
                        <button className="btn"
                          onClick={() => setCover(media)}
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 8px', fontSize: '11px' }}>
                          🖼️ Cover
                        </button>
                      )}
                      <button className="btn"
                        onClick={() => deleteMedia(media)}
                        disabled={deleting === media.id}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '4px 8px', fontSize: '11px' }}>
                        {deleting === media.id ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Album Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>🎞️ Create New Album</h2>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Album Title *</label>
            <input
              value={albumForm.title}
              onChange={e => setAlbumForm({ ...albumForm, title: e.target.value })}
              placeholder="e.g. Sports Day 2026"
              style={inputStyle}
            />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
            <textarea
              value={albumForm.description}
              onChange={e => setAlbumForm({ ...albumForm, description: e.target.value })}
              placeholder="Brief description of the event..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Program</label>
            <select
              value={albumForm.program}
              onChange={e => setAlbumForm({ ...albumForm, program: e.target.value })}
              style={inputStyle}>
              <option value="">All Programs</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Event Date</label>
            <input
              type="date"
              value={albumForm.event_date}
              onChange={e => setAlbumForm({ ...albumForm, event_date: e.target.value })}
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button className="btn"
                onClick={() => setShowCreateModal(false)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', padding: '12px' }}>
                Cancel
              </button>
              <button className="btn"
                onClick={createAlbum}
                style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #34d399)', color: '#fff', padding: '12px', fontSize: '14px' }}>
                ✅ Create Album
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
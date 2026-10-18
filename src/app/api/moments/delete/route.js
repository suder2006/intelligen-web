import { NextResponse } from 'next/server'
import { serviceSupabase } from '@/lib/adminAuth'
import { deleteFromR2 } from '@/lib/r2'

// Admins delete any moment in their school (super admins: any school);
// teachers and staff only the moments they uploaded. Everyone else gets 403.
const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']
const TEACHER_ROLES = ['teacher', 'staff']

// Older web teacher uploads live in Supabase Storage, not R2
const SUPABASE_STORAGE_PATH = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

// Every stored file for a moment: the photo or video, plus a video's cover
// image. Returns R2 keys and Supabase Storage objects separately.
function filesFor(moment) {
  const r2Keys = []
  const storage = []
  let inSupabaseStorage = false
  for (const url of [moment.photo_url, moment.video_url, moment.thumbnail_url]) {
    if (!url) continue
    let path
    try { path = decodeURIComponent(new URL(url).pathname) } catch { continue }
    const match = path.match(SUPABASE_STORAGE_PATH)
    if (match) {
      storage.push({ bucket: match[1], path: match[2] })
      inSupabaseStorage = true
    } else {
      r2Keys.push(path.replace(/^\//, ''))
    }
  }
  // storage_path is the R2 key for R2 uploads, but a bucket path for
  // Supabase Storage uploads, which the photo URL above already covers
  if (moment.storage_path && !inSupabaseStorage) r2Keys.push(moment.storage_path)
  return { r2Keys, storage }
}

// POST { moment_id } or { moment_ids: [...] }
// Permanently deletes the files from storage, then hard-deletes the rows.
// If any file delete fails, no rows are deleted (a retry is safe: deleting an
// already-removed file succeeds).
export async function POST(request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = serviceSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles')
      .select('role, school_id').eq('id', user.id).single()
    const isAdmin = ADMIN_ROLES.includes(profile?.role)
    if (!isAdmin && !TEACHER_ROLES.includes(profile?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const ids = [...new Set(Array.isArray(body.moment_ids) ? body.moment_ids : (body.moment_id ? [body.moment_id] : []))]
    if (ids.length === 0) return NextResponse.json({ error: 'moment_id is required' }, { status: 400 })

    const { data: moments, error: fetchError } = await supabase.from('classroom_moments')
      .select('id, school_id, album_id, uploaded_by, storage_path, photo_url, video_url, thumbnail_url')
      .in('id', ids)
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!moments?.length) return NextResponse.json({ error: 'Moment not found' }, { status: 404 })

    // Rows saved without a school_id fall back to their album's or uploader's school
    const albumSchool = {}
    const uploaderSchool = {}
    if (isAdmin && profile.role !== 'super_admin') {
      const noSchool = moments.filter(m => !m.school_id)
      const albumIds = [...new Set(noSchool.map(m => m.album_id).filter(Boolean))]
      const uploaderIds = [...new Set(noSchool.map(m => m.uploaded_by).filter(Boolean))]
      if (albumIds.length) {
        const { data } = await supabase.from('moment_albums').select('id, school_id').in('id', albumIds)
        for (const a of data || []) albumSchool[a.id] = a.school_id
      }
      if (uploaderIds.length) {
        const { data } = await supabase.from('profiles').select('id, school_id').in('id', uploaderIds)
        for (const p of data || []) uploaderSchool[p.id] = p.school_id
      }
    }
    const allowed = (m) => {
      if (profile.role === 'super_admin') return true
      if (!isAdmin) return m.uploaded_by === user.id
      const schoolId = m.school_id || albumSchool[m.album_id] || uploaderSchool[m.uploaded_by]
      return Boolean(schoolId) && schoolId === profile.school_id
    }
    if (!moments.every(allowed)) {
      return NextResponse.json({
        error: isAdmin ? 'You can only delete moments from your own school' : 'You can only delete photos you uploaded'
      }, { status: 403 })
    }

    const files = moments.map(filesFor)
    const r2Keys = [...new Set(files.flatMap(f => f.r2Keys))]
    const storageByBucket = {}
    for (const { bucket, path } of files.flatMap(f => f.storage)) {
      (storageByBucket[bucket] ||= []).push(path)
    }

    const results = await Promise.allSettled([
      ...r2Keys.map(key => deleteFromR2(key)),
      ...Object.entries(storageByBucket).map(async ([bucket, paths]) => {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        if (error) throw error
      })
    ])
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.error('Moments file delete errors:', failures.map(r => r.reason))
      return NextResponse.json({
        error: `Could not delete ${failures.length} file(s) from storage (${failures[0].reason?.message}). Nothing was removed from the database.`
      }, { status: 502 })
    }

    const { error: deleteError } = await supabase.from('classroom_moments')
      .delete().in('id', moments.map(m => m.id))
    if (deleteError) {
      return NextResponse.json({
        error: `Files were already permanently deleted from storage, but the database records could not be removed: ${deleteError.message}`,
        filesDeleted: true
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: moments.length })
  } catch (error) {
    console.error('Moments delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

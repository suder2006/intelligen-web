export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { serviceClient, serviceAccountEmail, parseServiceAccountKey } from '@/lib/googleDrive'

const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']

// school_integrations holds a private key, so the table is closed to the
// browser (RLS on, no policies) and this route is the only way in. Running with
// the service role means it has to check the caller itself.
async function authorize(request, schoolId) {
  if (!schoolId) return { error: 'school_id is required', status: 400 }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return { error: 'Not authenticated', status: 401 }

  const supabase = serviceClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Not authenticated', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return { error: 'Forbidden', status: 403 }
  }
  if (profile.role !== 'super_admin' && profile.school_id !== schoolId) {
    return { error: 'Forbidden', status: 403 }
  }

  return { supabase }
}

// Everything the settings page needs except the key itself: the client_email
// read out of the stored JSON stands in for it, so an admin can confirm which
// service account is configured without the key ever leaving the server.
function publicShape(row) {
  return {
    google_drive_enabled: !!row?.google_drive_enabled,
    google_drive_folder_id: row?.google_drive_folder_id || '',
    google_drive_connected: !!row?.google_drive_connected,
    google_drive_connected_at: row?.google_drive_connected_at || null,
    service_account_email: serviceAccountEmail(row?.google_service_account_key),
    has_key: !!row?.google_service_account_key
  }
}

export async function GET(request) {
  try {
    const schoolId = new URL(request.url).searchParams.get('school_id')
    const auth = await authorize(request, schoolId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await auth.supabase
      .from('school_integrations')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw error

    return NextResponse.json(publicShape(data))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const auth = await authorize(request, body.school_id)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: existing } = await auth.supabase
      .from('school_integrations')
      .select('*')
      .eq('school_id', body.school_id)
      .maybeSingle()

    const folderId = (body.google_drive_folder_id || '').trim() || null
    const row = {
      school_id: body.school_id,
      google_drive_enabled: !!body.google_drive_enabled,
      google_drive_folder_id: folderId
    }

    // Blank means "keep the saved key" — the form never receives the stored
    // value back, so an empty textarea must not wipe it.
    const key = (body.google_service_account_key || '').trim()
    if (key) {
      // Reject unusable JSON here rather than storing it and failing later on
      // the first upload.
      parseServiceAccountKey(key)
      row.google_service_account_key = key
    }

    // A new key or a different folder has not been verified yet, so the stored
    // status would be stale. Test Connection sets it again.
    const changed = (key && key !== existing?.google_service_account_key) ||
      folderId !== (existing?.google_drive_folder_id || null)
    if (changed || !existing) {
      row.google_drive_connected = false
      row.google_drive_connected_at = null
    }

    const { data, error } = await auth.supabase
      .from('school_integrations')
      .upsert(row, { onConflict: 'school_id' })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(publicShape(data))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

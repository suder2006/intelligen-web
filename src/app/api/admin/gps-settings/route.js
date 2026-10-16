export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { serviceClient, requireAdmin, getIntegration } from '@/lib/livepin'

// school_integrations is closed to the browser (RLS on, no policies), so this
// route is the only way the settings page reads or writes the Livepin
// credentials. The API key and secret key (stored in gps_password) are
// write-only: the page only learns whether each is saved, and whether the
// LIVEPIN_* env vars would be used when the school has none of its own.
function publicShape(row) {
  return {
    gps_enabled: row?.gps_enabled !== false,
    gps_camera_enabled: row?.gps_camera_enabled !== false,
    gps_provider: row?.gps_provider || '',
    gps_api_url: row?.gps_api_url || '',
    gps_connected: !!row?.gps_connected,
    gps_connected_at: row?.gps_connected_at || null,
    has_key: !!row?.gps_api_key,
    has_secret_key: !!row?.gps_password,
    env_configured: !!(process.env.LIVEPIN_API_KEY && process.env.LIVEPIN_SECRET_KEY)
  }
}

export async function GET(request) {
  try {
    const schoolId = new URL(request.url).searchParams.get('school_id')
    const supabase = serviceClient()
    const auth = await requireAdmin(supabase, request, schoolId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    return NextResponse.json(publicShape(await getIntegration(supabase, schoolId)))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = serviceClient()
    const auth = await requireAdmin(supabase, request, body.school_id)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const existing = await getIntegration(supabase, body.school_id)

    const apiUrl = (body.gps_api_url || '').trim().replace(/\/+$/, '') || null
    if (apiUrl && !/^https?:\/\//i.test(apiUrl)) {
      return NextResponse.json({ error: 'API URL must start with https://' }, { status: 400 })
    }

    const row = {
      school_id: body.school_id,
      gps_enabled: body.gps_enabled !== false,
      gps_camera_enabled: body.gps_camera_enabled !== false,
      gps_provider: (body.gps_provider || '').trim() || null,
      gps_api_url: apiUrl,
      updated_at: new Date().toISOString()
    }

    // Blank means "keep the saved value" — the form never receives the stored
    // secrets back, so an empty field must not wipe them.
    const apiKey = (body.gps_api_key || '').trim()
    // The Livepin secret key lives in the gps_password column.
    const secretKey = (body.gps_secret_key || '').trim()
    if (apiKey) row.gps_api_key = apiKey
    if (secretKey) row.gps_password = secretKey

    // Changed credentials have not been verified yet, so the stored status
    // would be stale. Test Connection sets it again.
    const changed = (apiKey && apiKey !== existing?.gps_api_key) ||
      (secretKey && secretKey !== existing?.gps_password) ||
      apiUrl !== (existing?.gps_api_url || null)
    if (changed || !existing) {
      row.gps_connected = false
      row.gps_connected_at = null
    }

    const { data, error } = await supabase
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

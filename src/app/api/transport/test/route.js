export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { serviceClient, requireAdmin, getIntegration, credentialsFrom, isConfigured, getToken } from '@/lib/livepin'

// Checks that the school's Livepin API key and secret key can log in.
//
// Body: { school_id, gps_api_url?, gps_api_key?, gps_password? (secret key) }.
// Anything left blank falls back to what is saved (then to the LIVEPIN_* env
// vars), so the button works both for credentials being typed in and for a
// configuration that is already stored.
// Only a test of exactly the saved configuration updates gps_connected.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const supabase = serviceClient()
    const auth = await requireAdmin(supabase, request, body.school_id)
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })

    const saved = await getIntegration(supabase, body.school_id)
    const savedCreds = credentialsFrom(saved)
    const creds = credentialsFrom({
      gps_api_url: (body.gps_api_url || '').trim() || saved?.gps_api_url,
      gps_api_key: (body.gps_api_key || '').trim() || saved?.gps_api_key,
      gps_password: body.gps_password || saved?.gps_password
    })
    const testingSavedConfig = !!saved &&
      creds.apiUrl === savedCreds.apiUrl && creds.apiKey === savedCreds.apiKey &&
      creds.apiSecret === savedCreds.apiSecret

    if (!isConfigured(creds)) {
      return NextResponse.json({ success: false, error: 'Enter the Livepin API key and secret key to test' })
    }

    const setStatus = (connected) => supabase
      .from('school_integrations')
      .update({ gps_connected: connected, gps_connected_at: connected ? new Date().toISOString() : null })
      .eq('school_id', body.school_id)

    let expiresAt
    try {
      ({ expiresAt } = await getToken(creds, { force: true }))
    } catch (e) {
      if (testingSavedConfig) await setStatus(false)
      return NextResponse.json({ success: false, saved: testingSavedConfig, error: e.message })
    }

    if (testingSavedConfig) await setStatus(true)
    return NextResponse.json({
      success: true,
      saved: testingSavedConfig,
      token_expires_at: new Date(expiresAt).toISOString()
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

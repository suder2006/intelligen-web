export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { serviceClient, requireAdmin, getIntegration, credentialsFrom, isConfigured, getToken } from '@/lib/livepin'

// Returns the school's Livepin JWT (cached server-side, refreshed when it
// expires). The token unlocks the whole fleet, so only the school's admins can
// fetch it — the parent app goes through /api/transport/location and /stream,
// which use the token without ever handing it out.
export async function GET(request) {
  try {
    const url = new URL(request.url)
    const schoolId = url.searchParams.get('school_id')
    const supabase = serviceClient()
    const auth = await requireAdmin(supabase, request, schoolId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const creds = credentialsFrom(await getIntegration(supabase, schoolId))
    if (!isConfigured(creds)) {
      return NextResponse.json({ error: 'GPS is not set up for this school' }, { status: 404 })
    }

    const { token, expiresAt } = await getToken(creds, {
      force: url.searchParams.get('refresh') === '1'
    })
    return NextResponse.json({ token, expires_at: new Date(expiresAt).toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

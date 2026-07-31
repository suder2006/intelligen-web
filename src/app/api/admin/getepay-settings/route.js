export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// GetePay credentials are readable/writable only through this route, so it must
// verify the caller itself — the service role bypasses RLS entirely.
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
  // A school admin may only touch their own school; super_admin is unrestricted.
  if (profile.role !== 'super_admin' && profile.school_id !== schoolId) {
    return { error: 'Forbidden', status: 403 }
  }

  return { supabase }
}

// Returns the non-secret fields plus whether a key/IV is on file. The key and IV
// themselves are never sent to the browser.
export async function GET(request) {
  try {
    const schoolId = new URL(request.url).searchParams.get('school_id')
    const auth = await authorize(request, schoolId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await auth.supabase
      .from('schools')
      .select('getepay_mid, getepay_terminal_id, getepay_url, getepay_key, getepay_iv')
      .eq('id', schoolId)
      .single()
    if (error) throw error

    return NextResponse.json({
      getepay_mid: data.getepay_mid || '',
      getepay_terminal_id: data.getepay_terminal_id || '',
      getepay_url: data.getepay_url || '',
      has_key: !!data.getepay_key,
      has_iv: !!data.getepay_iv,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const auth = await authorize(request, body.school_id)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const update = {
      getepay_mid: (body.getepay_mid || '').trim() || null,
      getepay_terminal_id: (body.getepay_terminal_id || '').trim() || null,
      getepay_url: (body.getepay_url || '').trim() || null,
    }
    // Blank means "leave the stored secret alone" — the form never receives the
    // current value, so an empty field must not wipe it.
    const key = (body.getepay_key || '').trim()
    const iv = (body.getepay_iv || '').trim()
    if (key) update.getepay_key = key
    if (iv) update.getepay_iv = iv

    const { error } = await auth.supabase
      .from('schools')
      .update(update)
      .eq('id', body.school_id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

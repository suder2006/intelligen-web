import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { driver_profile_id, route_id, school_id } = await request.json()
    if (!driver_profile_id) {
      return NextResponse.json({ error: 'driver_profile_id is required' }, { status: 400 })
    }

    // Use service role key (server side only) — RLS blocks updating
    // transport_routes.driver_profile_id from the client.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Remove this driver from any route they are currently assigned to
    let clearQuery = supabaseAdmin.from('transport_routes')
      .update({ driver_profile_id: null })
      .eq('driver_profile_id', driver_profile_id)
    if (school_id) clearQuery = clearQuery.eq('school_id', school_id)
    const { error: clearError } = await clearQuery
    if (clearError) throw clearError

    // Assign to the newly selected route (if any)
    if (route_id) {
      const { error: assignError } = await supabaseAdmin.from('transport_routes')
        .update({ driver_profile_id })
        .eq('id', route_id)
      if (assignError) throw assignError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

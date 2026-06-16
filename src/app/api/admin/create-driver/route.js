import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { email, password, full_name, phone, school_id } = await request.json()

    // Use service role key (server side only)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    if (authError) throw authError

    // Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      full_name,
      role: 'driver',
      school_id,
      phone: phone || null
    })
    if (profileError) throw profileError

    return NextResponse.json({ user_id: authData.user.id })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
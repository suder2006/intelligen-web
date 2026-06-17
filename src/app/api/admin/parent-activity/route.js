import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  const { school_id } = await req.json()
  try {
    // Get all parents for this school
    const { data: parents } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('school_id', school_id)
      .eq('role', 'parent')

    const parentIds = parents?.map(p => p.id) || []
    if (parentIds.length === 0) {
      return NextResponse.json({ total: 0, today: 0, week: 0, never: 0, pushEnabled: 0, parents: [] })
    }

    // Get auth users for last sign in (requires service role)
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const parentAuthUsers = authData?.users?.filter(u => parentIds.includes(u.id)) || []

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0)

    const loggedInToday = parentAuthUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= today).length
    const loggedInWeek = parentAuthUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= weekAgo).length
    const neverLoggedIn = parentAuthUsers.filter(u => !u.last_sign_in_at).length

    // Get push subscriptions count
    const { count: pushCount } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('user_id', parentIds)

    // Build parent details list
    const parentDetails = parents.map(p => {
      const authUser = parentAuthUsers.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email,
        last_sign_in_at: authUser?.last_sign_in_at,
        created_at: authUser?.created_at
      }
    }).sort((a, b) => {
      if (!a.last_sign_in_at) return 1
      if (!b.last_sign_in_at) return -1
      return new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at)
    })

    return NextResponse.json({
      total: parentIds.length,
      today: loggedInToday,
      week: loggedInWeek,
      never: neverLoggedIn,
      pushEnabled: pushCount || 0,
      parents: parentDetails
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
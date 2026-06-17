import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fetch ALL auth users by paging through the admin list.
// listUsers() only returns one page (default 50) at a time, so a single
// call silently drops every user past the first page — which made the
// parent list under-report (missing emails / last_sign_in / counts).
async function listAllAuthUsers() {
  const all = []
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    all.push(...users)
    if (users.length < perPage) break // last page reached
  }
  return all
}

export async function POST(req) {
  try {
    const { school_id } = await req.json()
    if (!school_id) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 })
    }

    // Get all parents for this school
    const { data: parents, error: parentsError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('school_id', school_id)
      .eq('role', 'parent')

    if (parentsError) throw parentsError

    const parentIds = parents?.map(p => p.id) || []
    if (parentIds.length === 0) {
      return NextResponse.json({ total: 0, today: 0, week: 0, never: 0, pushEnabled: 0, parents: [] })
    }
    const parentIdSet = new Set(parentIds)

    // Get auth users for last sign in (requires service role) — paginated
    const allAuthUsers = await listAllAuthUsers()
    const parentAuthUsers = allAuthUsers.filter(u => parentIdSet.has(u.id))

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0)

    const loggedInToday = parentAuthUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= today).length
    const loggedInWeek = parentAuthUsers.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= weekAgo).length
    // "Never" must count parents with no auth record at all, plus those that
    // exist but have never signed in.
    const neverLoggedIn = parentIds.filter(id => {
      const authUser = parentAuthUsers.find(u => u.id === id)
      return !authUser || !authUser.last_sign_in_at
    }).length

    // Get push subscriptions count (one row per subscribed parent)
    const { count: pushCount, error: pushError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('user_id', parentIds)

    if (pushError) throw pushError

    const pushUserIds = new Set()
    const { data: pushRows } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
      .in('user_id', parentIds)
    ;(pushRows || []).forEach(r => pushUserIds.add(r.user_id))

    // Build parent details list
    const parentDetails = parents.map(p => {
      const authUser = parentAuthUsers.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        created_at: authUser?.created_at || null,
        push_enabled: pushUserIds.has(p.id)
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
    console.error('parent-activity error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

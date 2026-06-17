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

    // Parents are linked to a school through their children, NOT through
    // profiles.school_id (which is null for almost all parents). So we must
    // resolve the parent set the same way the parent portal does:
    //   students (by school_id) -> parent_students -> profiles
    // We also union in any profiles that DO carry school_id + role=parent
    // (legacy / directly-assigned parents) so nobody is missed.
    const parentIdSet = new Set()

    // 1. Parents linked via their children
    const { data: schoolStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('school_id', school_id)
    if (studentsError) throw studentsError

    const studentIds = (schoolStudents || []).map(s => s.id)
    if (studentIds.length > 0) {
      const { data: links, error: linksError } = await supabaseAdmin
        .from('parent_students')
        .select('parent_id')
        .in('student_id', studentIds)
      if (linksError) throw linksError
      ;(links || []).forEach(l => l.parent_id && parentIdSet.add(l.parent_id))
    }

    // 2. Parents directly assigned to the school via profiles.school_id
    const { data: directParents, error: directError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('school_id', school_id)
      .eq('role', 'parent')
    if (directError) throw directError
    ;(directParents || []).forEach(p => parentIdSet.add(p.id))

    // 3. Load profile details, keeping only genuine parents
    const allParentIds = [...parentIdSet]
    let parents = []
    if (allParentIds.length > 0) {
      const { data: profs, error: profsError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, phone, role')
        .in('id', allParentIds)
        .eq('role', 'parent')
      if (profsError) throw profsError
      parents = profs || []
    }

    const parentIds = parents.map(p => p.id)
    parentIdSet.clear()
    parentIds.forEach(id => parentIdSet.add(id))

    if (parentIds.length === 0) {
      return NextResponse.json({ total: 0, today: 0, week: 0, never: 0, pushEnabled: 0, parents: [] })
    }

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

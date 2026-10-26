import { NextResponse } from 'next/server'
import { authorizeAdmin, serviceSupabase } from '@/lib/adminAuth'

const STAFF_ROLES = ['teacher', 'staff', 'center_head', 'school_admin', 'driver']
// Long enough to be permanent until an admin reactivates the account
const BAN_DURATION = '876000h'

// POST { user_id, action: 'deactivate' | 'activate' }
// Deactivate: saves the current role in previous_role, sets role = 'inactive'
// and bans the user in Supabase Auth. Activate: restores previous_role
// (falling back to 'teacher') and lifts the ban. Admins of the staff
// member's school only (super admins: any school).
export async function POST(request) {
  try {
    const { user_id, action } = await request.json().catch(() => ({}))
    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    if (action !== 'deactivate' && action !== 'activate') {
      return NextResponse.json({ error: "action must be 'deactivate' or 'activate'" }, { status: 400 })
    }

    const { data: target } = await serviceSupabase().from('profiles')
      .select('id, full_name, role, previous_role, school_id').eq('id', user_id).single()
    if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    const auth = await authorizeAdmin(request, target.school_id)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { supabase, user } = auth
    if (user.id === user_id) return NextResponse.json({ error: 'You cannot change your own status' }, { status: 400 })

    if (action === 'deactivate') {
      if (target.role === 'inactive') return NextResponse.json({ error: 'Already inactive' }, { status: 409 })
      if (!STAFF_ROLES.includes(target.role)) return NextResponse.json({ error: 'Only staff can be deactivated' }, { status: 400 })

      const { error: profileError } = await supabase.from('profiles')
        .update({ role: 'inactive', previous_role: target.role }).eq('id', user_id)
      if (profileError) throw profileError

      const { error: banError } = await supabase.auth.admin.updateUserById(user_id, { ban_duration: BAN_DURATION })
      if (banError) {
        await supabase.from('profiles').update({ role: target.role, previous_role: target.previous_role }).eq('id', user_id)
        throw banError
      }
    } else {
      if (target.role !== 'inactive') return NextResponse.json({ error: 'Already active' }, { status: 409 })
      const restoredRole = STAFF_ROLES.includes(target.previous_role) ? target.previous_role : 'teacher'

      const { error: unbanError } = await supabase.auth.admin.updateUserById(user_id, { ban_duration: 'none' })
      if (unbanError) throw unbanError

      const { error: profileError } = await supabase.from('profiles')
        .update({ role: restoredRole, previous_role: null }).eq('id', user_id)
      if (profileError) {
        await supabase.auth.admin.updateUserById(user_id, { ban_duration: BAN_DURATION })
        throw profileError
      }
    }

    return NextResponse.json({ success: true, full_name: target.full_name })
  } catch (error) {
    console.error('Staff status error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

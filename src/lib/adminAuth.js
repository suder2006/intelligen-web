import { createClient } from '@supabase/supabase-js'

const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']

export const serviceSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Routes that run with the service role skip RLS, so they check the caller
// themselves: a signed-in admin of the requested school (or a super admin).
export async function authorizeAdmin(request, schoolId) {
  if (!schoolId) return { error: 'school_id is required', status: 400 }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return { error: 'Not authenticated', status: 401 }

  const supabase = serviceSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Not authenticated', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role)) return { error: 'Forbidden', status: 403 }
  if (profile.role !== 'super_admin' && profile.school_id !== schoolId) return { error: 'Forbidden', status: 403 }

  return { supabase, user }
}

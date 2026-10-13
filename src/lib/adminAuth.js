import { createClient } from '@supabase/supabase-js'

const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']
const TEACHER_ROLES = ['teacher', 'staff']

export const serviceSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Routes that run with the service role skip RLS, so they check the caller
// themselves: a signed-in user of the requested school (super admins: any school)
// whose role is in `roles`.
async function authorize(request, schoolId, roles) {
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

  if (!profile || !roles.includes(profile.role)) return { error: 'Forbidden', status: 403 }
  if (profile.role !== 'super_admin' && profile.school_id !== schoolId) return { error: 'Forbidden', status: 403 }

  return { supabase, user, profile }
}

export const authorizeAdmin = (request, schoolId) => authorize(request, schoolId, ADMIN_ROLES)

// Admins, plus teachers/staff limited to the programs assigned to them in
// staff_programs. `programs` is null for admins (no limit).
export async function authorizeStaff(request, schoolId) {
  const auth = await authorize(request, schoolId, [...ADMIN_ROLES, ...TEACHER_ROLES])
  if (auth.error || ADMIN_ROLES.includes(auth.profile.role)) return { ...auth, programs: null }
  const { data, error } = await auth.supabase.from('staff_programs').select('program').eq('staff_id', auth.user.id)
  if (error) return { error: error.message, status: 500 }
  return { ...auth, programs: data.map(p => p.program) }
}

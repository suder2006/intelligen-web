export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  serviceClient,
  userFromRequest,
  getIntegration,
  credentialsFrom,
  isConfigured,
  parentVehicles,
  parentPreferences
} from '@/lib/livepin'

// What the parent app needs for the GPS Track / Live Camera tabs and the
// Transport Settings toggles. The school-level switches live in
// school_integrations, which the app cannot read directly.
//
// school_id comes from the parent's child, not the parent's profile (parents
// have no school_id), and must be the school of one of their children.
async function resolve(request, schoolId) {
  const supabase = serviceClient()
  const auth = await userFromRequest(supabase, request)
  if (auth.error) return auth
  if (!schoolId) return { error: 'school_id is required', status: 400 }

  const { data: links } = await supabase
    .from('parent_students').select('student_id').eq('parent_id', auth.user.id)
  const studentIds = (links || []).map(l => l.student_id)
  if (studentIds.length === 0) return { error: 'No children linked to this account', status: 403 }
  const { data: kids } = await supabase
    .from('students').select('id').in('id', studentIds).eq('school_id', schoolId)
  if (!kids?.length) return { error: 'Forbidden', status: 403 }

  return { supabase, user: auth.user }
}

async function shape(supabase, userId, schoolId) {
  const [integration, prefs, vehicles] = await Promise.all([
    getIntegration(supabase, schoolId),
    parentPreferences(supabase, userId),
    parentVehicles(supabase, userId, schoolId)
  ])
  const configured = isConfigured(credentialsFrom(integration))
  return {
    school: {
      configured,
      gps_enabled: configured && integration?.gps_enabled !== false,
      gps_camera_enabled: configured && integration?.gps_camera_enabled !== false,
      provider: integration?.gps_provider || null
    },
    preferences: prefs,
    vehicles
  }
}

export async function GET(request) {
  try {
    const schoolId = new URL(request.url).searchParams.get('school_id')
    const auth = await resolve(request, schoolId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json(await shape(auth.supabase, auth.user.id, schoolId))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await resolve(request, body.school_id)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { supabase, user } = auth

    const update = { updated_at: new Date().toISOString() }
    if (typeof body.transport_tracking_enabled === 'boolean') update.transport_tracking_enabled = body.transport_tracking_enabled
    if (typeof body.transport_camera_enabled === 'boolean') update.transport_camera_enabled = body.transport_camera_enabled

    // parent_preferences has no unique constraint on parent_id to upsert on,
    // so update the existing row or insert the first one.
    const { data: existing } = await supabase
      .from('parent_preferences').select('id').eq('parent_id', user.id).maybeSingle()
    const { error } = existing
      ? await supabase.from('parent_preferences').update(update).eq('id', existing.id)
      : await supabase.from('parent_preferences').insert({ parent_id: user.id, ...update })
    if (error) throw error

    return NextResponse.json(await shape(supabase, user.id, body.school_id))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

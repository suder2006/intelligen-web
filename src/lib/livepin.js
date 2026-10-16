// Server-side helpers for the per-school Livepin GPS & dashcam integration.
//
// Each school stores its own Livepin credentials in school_integrations. Like
// the Drive key, they are only ever read with the service role and never sent
// back to the browser or the app.
import { serviceClient } from '@/lib/googleDrive'

export { serviceClient }

export const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']

// Every Livepin endpoint the app calls lives here, so a path that differs for a
// school's Livepin account is a one-line fix. The dashcam path is from
// Livepin's docs; the auth and location paths follow the same API layout.
export const LIVEPIN_PATHS = {
  auth: '/api/auth/login',
  location: (vehicleId) => `/api/vehicles/${encodeURIComponent(vehicleId)}/location`,
  stream: (vehicleId) => `/api/vehicles/${encodeURIComponent(vehicleId)}/v2/get-dashcam-stream`
}

export const PLAYER_URL = 'https://livepin.in/player_v2.html'

const DEFAULT_API_URL = 'https://api.livepin.in'

// JWTs are cached per credential set for the life of the server instance and
// refreshed a minute before they expire (or on any 401).
const tokenCache = new Map()
const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000

export async function getIntegration(supabase, schoolId) {
  const { data, error } = await supabase
    .from('school_integrations')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function credentialsFrom(row) {
  return {
    apiUrl: (row?.gps_api_url || DEFAULT_API_URL).trim().replace(/\/+$/, ''),
    apiKey: row?.gps_api_key || '',
    username: row?.gps_username || '',
    password: row?.gps_password || ''
  }
}

function decodeJwtExp(token) {
  try {
    const part = token.split('.')[1]
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const exp = JSON.parse(json).exp
    return exp ? exp * 1000 : null
  } catch {
    return null
  }
}

function pickToken(json) {
  return json?.token || json?.access_token || json?.jwt || json?.accessToken ||
    json?.data?.token || json?.data?.access_token || json?.data?.jwt || null
}

function cacheKey(creds) {
  return `${creds.apiUrl}|${creds.username}|${creds.apiKey}`
}

export async function getToken(creds, { force = false } = {}) {
  if (!creds.username || !creds.password) {
    throw new Error('Livepin username and password are not set')
  }
  const key = cacheKey(creds)
  const cached = tokenCache.get(key)
  if (!force && cached && cached.expiresAt - 60_000 > Date.now()) return cached

  let res
  try {
    res = await fetch(`${creds.apiUrl}${LIVEPIN_PATHS.auth}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(creds.apiKey ? { 'x-api-key': creds.apiKey } : {})
      },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        ...(creds.apiKey ? { api_key: creds.apiKey } : {})
      }),
      cache: 'no-store'
    })
  } catch (e) {
    throw new Error(`Could not reach ${creds.apiUrl}: ${e.message}`)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    tokenCache.delete(key)
    throw new Error(`Livepin login failed (${res.status}): ${json?.message || json?.error || 'check username, password and API key'}`)
  }
  const token = pickToken(json)
  if (!token) throw new Error('Livepin login succeeded but returned no token')

  const entry = { token, expiresAt: decodeJwtExp(token) || Date.now() + DEFAULT_TOKEN_TTL_MS }
  tokenCache.set(key, entry)
  return entry
}

// Authenticated GET against Livepin. A 401 means the cached token was revoked
// or expired early, so it logs in again once before giving up.
export async function livepinGet(creds, path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { token } = await getToken(creds, { force: attempt > 0 })
    const res = await fetch(`${creds.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(creds.apiKey ? { 'x-api-key': creds.apiKey } : {})
      },
      cache: 'no-store'
    })
    if (res.status === 401 && attempt === 0) continue
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`Livepin request failed (${res.status}): ${json?.message || json?.error || res.statusText}`)
    }
    return json
  }
}

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

// Livepin wraps payloads differently per endpoint ({data}, {data: [..]},
// {vehicle: {..}}), so look one or two levels down for the record that has
// coordinates.
export function normalizeLocation(json) {
  const candidates = [json, json?.data, json?.data?.[0], json?.vehicle, json?.location,
    json?.data?.location, json?.data?.vehicle, json?.result]
  const rec = candidates.find(c => c && typeof c === 'object' && !Array.isArray(c) &&
    (c.lat ?? c.latitude ?? c.Lat) !== undefined) || {}
  const lat = num(rec.lat ?? rec.latitude ?? rec.Lat)
  const lng = num(rec.lng ?? rec.lon ?? rec.long ?? rec.longitude ?? rec.Lng)
  return {
    lat,
    lng,
    speed: num(rec.speed ?? rec.Speed) ?? 0,
    status: rec.status || rec.vehicle_status || rec.state || (rec.ignition !== undefined ? (rec.ignition ? 'Ignition on' : 'Ignition off') : null),
    address: rec.address || rec.location_name || rec.place || null,
    updated_at: rec.updated_at || rec.timestamp || rec.time || rec.gps_time || rec.last_updated || null
  }
}

// Collects every FLV URL in the response, wherever Livepin nests them
// (one per camera channel).
export function extractFlvUrls(json) {
  const urls = new Set()
  const walk = (v) => {
    if (typeof v === 'string') {
      if (/^https?:\/\//i.test(v) && /flv/i.test(v)) urls.add(v)
    } else if (Array.isArray(v)) {
      v.forEach(walk)
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk)
    }
  }
  walk(json)
  return [...urls]
}

// The player reads a comma-separated list from ?urls=. Only characters that
// would end the query value early are escaped, so the list stays in the plain
// format the player expects.
export function playerUrl(flvUrls) {
  const list = flvUrls.map(u => u.replace(/&/g, '%26').replace(/#/g, '%23').replace(/,/g, '%2C')).join(',')
  return `${PLAYER_URL}?urls=${list}`
}

export async function userFromRequest(supabase, request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token === 'undefined' || token === 'null') return { error: 'Not authenticated', status: 401 }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Not authenticated', status: 401 }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle()
  return { user, profile: profile || {} }
}

export async function requireAdmin(supabase, request, schoolId) {
  if (!schoolId) return { error: 'school_id is required', status: 400 }
  const auth = await userFromRequest(supabase, request)
  if (auth.error) return auth
  const { profile } = auth
  if (!ADMIN_ROLES.includes(profile.role)) return { error: 'Forbidden', status: 403 }
  if (profile.role !== 'super_admin' && profile.school_id !== schoolId) return { error: 'Forbidden', status: 403 }
  return auth
}

// Vehicles (by Livepin id) on the routes a parent's children are assigned to,
// with the route and child names the app shows next to each one.
export async function parentVehicles(supabase, parentId, schoolId) {
  const { data: links } = await supabase
    .from('parent_students').select('student_id').eq('parent_id', parentId)
  const studentIds = (links || []).map(l => l.student_id)
  if (studentIds.length === 0) return []

  const { data: students } = await supabase
    .from('students').select('id, full_name, school_id').in('id', studentIds)
  const inSchool = (students || []).filter(s => s.school_id === schoolId)
  if (inSchool.length === 0) return []

  const { data: assignments } = await supabase
    .from('transport_assignments')
    .select('student_id, morning_route_id, afternoon_route_id')
    .in('student_id', inSchool.map(s => s.id))
    .eq('status', 'active')
  const routeIds = [...new Set((assignments || []).flatMap(a => [a.morning_route_id, a.afternoon_route_id]).filter(Boolean))]
  if (routeIds.length === 0) return []

  const { data: routes } = await supabase
    .from('transport_routes')
    .select('id, name, route_type, gps_vehicle_id')
    .in('id', routeIds)
    .eq('school_id', schoolId)

  const byVehicle = new Map()
  for (const r of routes || []) {
    const vid = (r.gps_vehicle_id || '').trim()
    if (!vid) continue
    const children = (assignments || [])
      .filter(a => a.morning_route_id === r.id || a.afternoon_route_id === r.id)
      .map(a => inSchool.find(s => s.id === a.student_id)?.full_name)
      .filter(Boolean)
    const entry = byVehicle.get(vid) || { vehicle_id: vid, routes: [], children: [] }
    entry.routes.push({ id: r.id, name: r.name, route_type: r.route_type })
    entry.children = [...new Set([...entry.children, ...children])]
    byVehicle.set(vid, entry)
  }
  return [...byVehicle.values()]
}

export async function parentPreferences(supabase, parentId) {
  const { data } = await supabase
    .from('parent_preferences')
    .select('transport_tracking_enabled, transport_camera_enabled')
    .eq('parent_id', parentId)
    .maybeSingle()
  // No row yet means the column defaults (both on).
  return {
    transport_tracking_enabled: data ? data.transport_tracking_enabled !== false : true,
    transport_camera_enabled: data ? data.transport_camera_enabled !== false : true
  }
}

// Decides whether the caller may see a vehicle's GPS or camera feed.
// Staff of the school can see any vehicle; a parent only sees vehicles on
// their own children's routes, and only while both the school and the parent
// have the feature switched on.
export async function authorizeVehicleAccess(supabase, request, schoolId, vehicleId, feature) {
  if (!schoolId || !vehicleId) return { error: 'school_id and vehicle_id are required', status: 400 }
  const auth = await userFromRequest(supabase, request)
  if (auth.error) return auth

  const integration = await getIntegration(supabase, schoolId)
  if (!integration?.gps_username) return { error: 'GPS is not set up for this school', status: 404 }

  const { profile, user } = auth
  if (profile.role === 'super_admin') return { integration }

  if (profile.role === 'parent' || !profile.school_id) {
    const schoolFlag = feature === 'camera' ? integration.gps_camera_enabled : integration.gps_enabled
    if (schoolFlag === false) {
      return { error: feature === 'camera' ? 'Live camera not available' : 'GPS tracking not available', status: 403 }
    }
    const prefs = await parentPreferences(supabase, user.id)
    const parentFlag = feature === 'camera' ? prefs.transport_camera_enabled : prefs.transport_tracking_enabled
    if (!parentFlag) {
      return { error: feature === 'camera' ? 'Live camera is turned off in your settings' : 'Live bus tracking is turned off in your settings', status: 403 }
    }
    const vehicles = await parentVehicles(supabase, user.id, schoolId)
    if (!vehicles.some(v => v.vehicle_id === String(vehicleId).trim())) {
      return { error: 'This vehicle is not on your child\'s route', status: 403 }
    }
    return { integration }
  }

  if (profile.school_id !== schoolId) return { error: 'Forbidden', status: 403 }
  return { integration }
}

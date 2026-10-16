// Server-side helpers for the Livepin GPS & dashcam integration.
//
// Credentials come from the environment:
//   LIVEPIN_API_URL     e.g. https://api.livepin.in
//   LIVEPIN_API_KEY
//   LIVEPIN_SECRET_KEY
// A school can override them with its own key and secret in
// school_integrations (gps_api_url, gps_api_key, gps_password), saved from
// Settings → GPS & Camera Setup. Either way they are only ever read with the
// service role and never sent back to the browser or the app.
import { serviceClient } from '@/lib/googleDrive'

export { serviceClient }

export const ADMIN_ROLES = ['school_admin', 'center_head', 'super_admin']

// Every Livepin endpoint the app calls.
export const LIVEPIN_PATHS = {
  auth: '/api/user/login-with-api-key',
  searchByNo: (vehicleNo) => `/api/vehicles/search-by-no?vehicle_no=${encodeURIComponent(vehicleNo)}`,
  location: (vehicleId) => `/api/vehicles/${encodeURIComponent(vehicleId)}/location`,
  stream: (vehicleId) => `/api/vehicles/${encodeURIComponent(vehicleId)}/v2/get-dashcam-stream`
}

export const PLAYER_URL = 'https://livepin.in/player_v2.html'

const DEFAULT_API_URL = 'https://api.livepin.in'

// Seconds a JWT is requested for. Cached tokens are refreshed a minute before
// they expire (or on any 401).
const TOKEN_EXPIRY_S = 3600
const tokenCache = new Map()

// vehicle_no → Livepin's internal vehicle id. Vehicle numbers do not move
// between ids, so an hour is plenty; a 404 on lookup is never cached.
const vehicleIdCache = new Map()
const VEHICLE_ID_TTL_MS = 60 * 60 * 1000

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
    apiUrl: (row?.gps_api_url || process.env.LIVEPIN_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, ''),
    apiKey: (row?.gps_api_key || process.env.LIVEPIN_API_KEY || '').trim(),
    apiSecret: row?.gps_password || process.env.LIVEPIN_SECRET_KEY || ''
  }
}

export const isConfigured = (creds) => !!(creds.apiKey && creds.apiSecret)

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

function cacheKey(creds) {
  return `${creds.apiUrl}|${creds.apiKey}`
}

export async function getToken(creds, { force = false } = {}) {
  if (!isConfigured(creds)) {
    throw new Error('Livepin API key and secret key are not set')
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
        'x-api-key': creds.apiKey
      },
      body: JSON.stringify({
        api_key: creds.apiKey,
        api_secret: creds.apiSecret,
        expiry: TOKEN_EXPIRY_S
      }),
      cache: 'no-store'
    })
  } catch (e) {
    throw new Error(`Could not reach ${creds.apiUrl}: ${e.message}`)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    tokenCache.delete(key)
    throw new Error(`Livepin login failed (${res.status}): ${json?.message || json?.error || 'check the API key and secret key'}`)
  }
  const token = json?.jwt
  if (!token) throw new Error('Livepin login succeeded but returned no jwt')

  const entry = { token, expiresAt: decodeJwtExp(token) || Date.now() + TOKEN_EXPIRY_S * 1000 }
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
        'x-api-key': creds.apiKey,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    })
    if (res.status === 401 && attempt === 0) continue
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(`Livepin request failed (${res.status}): ${json?.message || json?.error || res.statusText}`)
      err.status = res.status
      throw err
    }
    return json
  }
}

// The search response's shape is not pinned down beyond "returns the internal
// vehicle id", so accept the id at the top level, under data, or as the first
// match of a list.
function pickVehicleId(json) {
  const candidates = [json, json?.data, json?.vehicle, json?.data?.vehicle,
    Array.isArray(json) ? json[0] : null, Array.isArray(json?.data) ? json.data[0] : null,
    Array.isArray(json?.vehicles) ? json.vehicles[0] : null]
  for (const c of candidates) {
    if (c === null || c === undefined) continue
    if (typeof c === 'string' || typeof c === 'number') return String(c)
    const id = c.vehicle_id ?? c.vehicleId ?? c.id ?? c._id
    if (id !== undefined && id !== null && id !== '') return String(id)
  }
  return null
}

// transport_routes.gps_vehicle_id holds the registration number (e.g.
// TN23DP8800); Livepin's location and stream endpoints need its internal id.
export async function resolveVehicleId(creds, vehicleNo) {
  const no = String(vehicleNo || '').trim().toUpperCase()
  if (!no) throw new Error('Vehicle number is required')
  const key = `${cacheKey(creds)}|${no}`
  const cached = vehicleIdCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.id

  let json
  try {
    json = await livepinGet(creds, LIVEPIN_PATHS.searchByNo(no))
  } catch (e) {
    if (e.status === 404) throw new Error(`Vehicle ${no} was not found in Livepin`)
    throw e
  }
  const id = pickVehicleId(json)
  if (!id) throw new Error(`Vehicle ${no} was not found in Livepin`)
  vehicleIdCache.set(key, { id, expiresAt: Date.now() + VEHICLE_ID_TTL_MS })
  return id
}

// Step 1–3 of every vehicle call: look up the internal id by number, then hit
// the endpoint. If the cached id has gone stale (404), look it up once more.
async function vehicleGet(creds, vehicleNo, pathFor) {
  const no = String(vehicleNo || '').trim().toUpperCase()
  const id = await resolveVehicleId(creds, no)
  try {
    return await livepinGet(creds, pathFor(id))
  } catch (e) {
    if (e.status !== 404) throw e
    vehicleIdCache.delete(`${cacheKey(creds)}|${no}`)
    const freshId = await resolveVehicleId(creds, no)
    if (freshId === id) throw e
    return livepinGet(creds, pathFor(freshId))
  }
}

export const getVehicleLocation = (creds, vehicleNo) => vehicleGet(creds, vehicleNo, LIVEPIN_PATHS.location)
export const getVehicleStream = (creds, vehicleNo) => vehicleGet(creds, vehicleNo, LIVEPIN_PATHS.stream)

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

// Livepin wraps payloads differently per endpoint ({data}, {data: [..]},
// {location_data: {..}}), and some fields are objects rather than values —
// location_data / status can be a set of device flags (positioning, running,
// position_encrypted, load, oil_line_connected, ...). Everything returned
// from here is a plain string, number, boolean or null, so the apps never
// render a raw object.
const LAT_KEYS = ['lat', 'latitude', 'Lat', 'Latitude']
const LNG_KEYS = ['lng', 'lon', 'long', 'longitude', 'Lng', 'Longitude']

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const first = (obj, keys) => {
  for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null) return obj[k]
  return undefined
}
const text = (v) => {
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}
const bool = (v) => {
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1' || v === 'true') return true
  if (v === 0 || v === '0' || v === 'false') return false
  return null
}

// Breadth-first search (a few levels deep) for the record holding coordinates.
function findLocationRecord(json) {
  const queue = [json?.location_data, json?.data?.location_data, json]
  const seen = new Set()
  for (let i = 0; i < queue.length && i < 200; i++) {
    const node = Array.isArray(queue[i]) ? queue[i][0] : queue[i]
    if (!isObj(node) || seen.has(node)) continue
    seen.add(node)
    if (num(first(node, LAT_KEYS)) !== null && num(first(node, LNG_KEYS)) !== null) return node
    for (const v of Object.values(node)) if (v && typeof v === 'object') queue.push(v)
  }
  return {}
}

// Status may be a word ("Running", "Idle") or a flags object; read the
// running / ignition flags out of whichever objects carry them.
function statusText(rec, json, speed) {
  const direct = text(first(rec, ['status', 'vehicle_status', 'state', 'status_text']))
  if (direct) return direct
  const flagSources = [rec.status, rec.location_data, json?.location_data, json?.data?.location_data,
    rec.vehicle_status, rec].filter(isObj)
  for (const f of flagSources) {
    const running = bool(f.running)
    if (running === true) return 'Running'
    const ignition = bool(f.ignition ?? f.acc ?? f.acc_on)
    if (ignition !== null) return ignition ? (speed > 0 ? 'Running' : 'Ignition on') : 'Ignition off'
    if (running === false) return speed > 0 ? 'Running' : 'Stopped'
  }
  return null
}

function timeText(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v < 1e12 ? v * 1000 : v) // seconds or milliseconds
    return isNaN(d) ? null : d.toISOString()
  }
  const s = text(v)
  if (!s) return null
  const d = new Date(/^\d+$/.test(s) ? Number(s) * (s.length <= 10 ? 1000 : 1) : s)
  return isNaN(d) ? null : d.toISOString()
}

export function normalizeLocation(json) {
  const rec = findLocationRecord(json)
  const speed = num(first(rec, ['speed', 'Speed', 'gps_speed'])) ?? 0
  return {
    lat: num(first(rec, LAT_KEYS)),
    lng: num(first(rec, LNG_KEYS)),
    speed,
    status: statusText(rec, json, speed),
    address: text(first(rec, ['address', 'location_name', 'place', 'formatted_address'])),
    updated_at: timeText(first(rec, ['updated_at', 'timestamp', 'time', 'gps_time', 'last_updated', 'device_time']))
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
  const creds = credentialsFrom(integration)
  if (!isConfigured(creds)) return { error: 'GPS is not set up for this school', status: 404 }

  const { profile, user } = auth
  if (profile.role === 'super_admin') return { integration, creds }

  if (profile.role === 'parent' || !profile.school_id) {
    const schoolFlag = feature === 'camera' ? integration?.gps_camera_enabled : integration?.gps_enabled
    if (schoolFlag === false) {
      return { error: feature === 'camera' ? 'Live camera not available' : 'GPS tracking not available', status: 403 }
    }
    const prefs = await parentPreferences(supabase, user.id)
    const parentFlag = feature === 'camera' ? prefs.transport_camera_enabled : prefs.transport_tracking_enabled
    if (!parentFlag) {
      return { error: feature === 'camera' ? 'Live camera is turned off in your settings' : 'Live bus tracking is turned off in your settings', status: 403 }
    }
    const vehicles = await parentVehicles(supabase, user.id, schoolId)
    const wanted = String(vehicleId).trim().toUpperCase()
    if (!vehicles.some(v => v.vehicle_id.toUpperCase() === wanted)) {
      return { error: 'This vehicle is not on your child\'s route', status: 403 }
    }
    return { integration, creds }
  }

  if (profile.school_id !== schoolId) return { error: 'Forbidden', status: 403 }
  return { integration, creds }
}

// Server-side helpers for the per-school Google Drive integration.
//
// Each school stores its own service account JSON in school_integrations and
// shares a Drive folder with that service account. The key is a private
// credential: it is only ever read with the service role and must never be sent
// back to the browser.
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Schools share a folder they already own with the service account. The
// narrower drive.file scope only covers files the app itself created, so it
// cannot see that folder — the full drive scope is required.
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive']

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// Turns pasted JSON into usable credentials, with messages an admin can act on.
export function parseServiceAccountKey(raw) {
  const text = (raw || '').trim()
  if (!text) throw new Error('Paste the service account JSON first')

  let credentials
  try {
    credentials = JSON.parse(text)
  } catch {
    throw new Error('That is not valid JSON. Paste the whole downloaded key file, including the { }.')
  }
  if (credentials.type !== 'service_account') {
    throw new Error('This JSON is not a service account key (expected "type": "service_account")')
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('The JSON is missing client_email or private_key')
  }
  // Keys pasted through a form sometimes arrive with the newlines still
  // backslash-escaped, which makes the signature fail with a vague error.
  if (credentials.private_key.includes('\\n')) {
    credentials = { ...credentials, private_key: credentials.private_key.replace(/\\n/g, '\n') }
  }
  return credentials
}

// Reads client_email out of a stored key without exposing the key itself.
export function serviceAccountEmail(raw) {
  try {
    return JSON.parse((raw || '').trim()).client_email || ''
  } catch {
    return ''
  }
}

export function authFromCredentials(credentials) {
  return new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPES })
}

export function driveFromCredentials(credentials) {
  return google.drive({ version: 'v3', auth: authFromCredentials(credentials) })
}

// Reads a JWT's claims without verifying the signature. Only used to log the
// token's shape and to tell "expired" apart from "rejected" — getUser below is
// what actually validates it.
function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Resolves the caller's school from their Supabase access token. Returns
// { error, stage, status } instead of throwing so routes can pass it straight
// through. A 401 here is nearly always the token never arriving or arriving
// expired rather than anything server-side, so each stage is logged and named:
// the stage in the response says exactly how far the request got.
export async function schoolFromToken(supabase, request, tag = 'drive-auth') {
  const rawHeader = request.headers.get('authorization') || ''
  const token = rawHeader.replace(/^Bearer\s+/i, '').trim()

  console.log(`[${tag}] 1/4 authorization header:`, rawHeader
    ? `present, ${rawHeader.length} chars, starts "${rawHeader.slice(0, 12)}..."`
    : 'MISSING — the client sent no Authorization header')

  if (!rawHeader) {
    return { error: 'Not authenticated: no Authorization header was sent', stage: 'no-header', status: 401 }
  }
  // "Bearer undefined" is what a caller sends when session?.access_token was
  // undefined — a signed-out or not-yet-restored client, not a bad key.
  if (!token || token === 'undefined' || token === 'null') {
    return {
      error: `Not authenticated: Authorization header was "${rawHeader.slice(0, 24)}" — the client had no access token`,
      stage: 'empty-token',
      status: 401
    }
  }

  const claims = decodeJwtPayload(token)
  const secondsLeft = claims?.exp ? Math.round((claims.exp * 1000 - Date.now()) / 1000) : null
  console.log(`[${tag}] 2/4 token:`, claims
    ? `sub=${claims.sub} role=${claims.role} iss=${claims.iss} expires_in=${secondsLeft}s`
    : `NOT a decodable JWT (length ${token.length}, starts "${token.slice(0, 8)}")`)

  if (secondsLeft !== null && secondsLeft <= 0) {
    return {
      error: `Not authenticated: the access token expired ${Math.abs(Math.round(secondsLeft / 60))} minute(s) ago. Refresh the session before uploading.`,
      stage: 'expired-token',
      status: 401
    }
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    console.log(`[${tag}] 2/4 getUser REJECTED the token:`, error?.message || 'no user returned')
    return {
      error: `Not authenticated: Supabase rejected the token (${error?.message || 'no user returned'})`,
      stage: 'token-rejected',
      status: 401
    }
  }
  console.log(`[${tag}] 3/4 token verified, user id:`, user.id)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.log(`[${tag}] 3/4 profile lookup FAILED:`, profileError?.message || 'no row for this user')
    return { error: 'No profile found for this account', stage: 'no-profile', status: 403 }
  }
  console.log(`[${tag}] 4/4 profile: role=${profile.role} school_id=${profile.school_id}`)

  if (!profile.school_id) {
    return { error: 'No school linked to this account', stage: 'no-school', status: 403 }
  }
  return { user, profile, schoolId: profile.school_id }
}

export async function getIntegration(supabase, schoolId) {
  const { data, error } = await supabase
    .from('school_integrations')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Marks the outcome of the most recent real connection check.
export async function setConnectionStatus(supabase, schoolId, connected) {
  await supabase
    .from('school_integrations')
    .update({
      google_drive_connected: connected,
      google_drive_connected_at: connected ? new Date().toISOString() : null
    })
    .eq('school_id', schoolId)
}

// Drive query strings are single-quoted, so a folder named "Kid's Art" would
// otherwise break the query.
export const escapeDriveQuery = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

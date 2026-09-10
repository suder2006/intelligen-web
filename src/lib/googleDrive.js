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

export function driveFromCredentials(credentials) {
  const auth = new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPES })
  return google.drive({ version: 'v3', auth })
}

// Resolves the caller's school from their Supabase access token. Returns
// { error, status } instead of throwing so routes can pass it straight through.
export async function schoolFromToken(supabase, request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return { error: 'Not authenticated', status: 401 }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Not authenticated', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) return { error: 'No school linked to this account', status: 403 }
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

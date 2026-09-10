export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  serviceClient,
  schoolFromToken,
  getIntegration,
  parseServiceAccountKey,
  driveFromCredentials,
  setConnectionStatus
} from '@/lib/googleDrive'

// Checks that a school's service account can actually reach its Drive folder.
//
// Body: { serviceAccountKey?, folderId? }. Anything left out falls back to what
// the school has saved, so the button works both for credentials being typed in
// and for a configuration that is already stored. Only a test of the saved
// configuration updates the stored connection status — testing a key that has
// not been saved yet says nothing about what the uploader will use.
export async function POST(request) {
  try {
    const supabase = serviceClient()
    const auth = await schoolFromToken(supabase, request, 'drive-test')
    if (auth.error) {
      console.log('[drive-test] REJECTED at stage:', auth.stage, '-', auth.error)
      return NextResponse.json({ success: false, error: auth.error, stage: auth.stage }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const saved = await getIntegration(supabase, auth.schoolId)

    const rawKey = (body.serviceAccountKey || '').trim() || saved?.google_service_account_key || ''
    const folderId = (body.folderId || '').trim() || saved?.google_drive_folder_id || ''
    // Only a test of exactly what is stored says anything about what the
    // uploader will do, so only that outcome is written back as the status.
    const testingSavedConfig = !!saved &&
      rawKey === saved.google_service_account_key &&
      folderId === (saved.google_drive_folder_id || '')

    if (!rawKey) {
      return NextResponse.json({ success: false, error: 'No service account key saved for this school' })
    }
    if (!folderId) {
      return NextResponse.json({ success: false, error: 'Enter the Drive folder ID to test' })
    }

    let folderName
    try {
      const credentials = parseServiceAccountKey(rawKey)
      const drive = driveFromCredentials(credentials)
      const folder = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType',
        supportsAllDrives: true
      })
      if (folder.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('That ID points to a file, not a folder')
      }
      folderName = folder.data.name
    } catch (e) {
      if (testingSavedConfig) await setConnectionStatus(supabase, auth.schoolId, false)
      return NextResponse.json({ success: false, error: describeDriveError(e) })
    }

    if (testingSavedConfig) await setConnectionStatus(supabase, auth.schoolId, true)

    return NextResponse.json({ success: true, folderName })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// Google's raw errors ("File not found: 1a2b3c") do not tell an admin what to
// fix, and the usual cause is simply that the folder was never shared.
function describeDriveError(e) {
  const status = e?.code || e?.response?.status
  const message = e?.errors?.[0]?.message || e?.message || 'Connection failed'
  if (status === 404) {
    return 'Folder not found. Check the folder ID, and share the folder with the service account email above (Editor access).'
  }
  if (status === 403) {
    return `Access denied by Google: ${message}. Share the folder with the service account email, and make sure the Drive API is enabled for the project.`
  }
  if (/invalid_grant|DECODER|PEM/i.test(message)) {
    return 'Google rejected the key. Re-download the service account JSON and paste it again.'
  }
  return message
}

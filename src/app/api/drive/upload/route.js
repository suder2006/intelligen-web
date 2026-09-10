export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import {
  serviceClient,
  schoolFromToken,
  getIntegration,
  parseServiceAccountKey,
  driveFromCredentials,
  escapeDriveQuery
} from '@/lib/googleDrive'

const getOrCreateFolder = async (drive, parentId, folderName) => {
  const res = await drive.files.list({
    q: `name='${escapeDriveQuery(folderName)}' and '${escapeDriveQuery(parentId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })
  if (res.data.files.length > 0) return res.data.files[0].id
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id',
    supportsAllDrives: true
  })
  return folder.data.id
}

// Uploads into the school's own Drive. Credentials come from the school's
// school_integrations row (configured in Admin > Settings), never from platform
// env vars, so one school's files can never land in another's Drive.
export async function POST(request) {
  try {
    console.log('[drive-upload] request from', request.headers.get('origin') || 'no origin', '->', request.url)
    // A missing service role key makes every token look invalid, so say so
    // outright rather than letting it surface as a confusing 401.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[drive-upload] SUPABASE_SERVICE_ROLE_KEY is not set in this environment')
      return NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing', stage: 'no-service-key' },
        { status: 500 }
      )
    }
    const supabase = serviceClient()

    // The token identifies the school, so it is required — without it there is
    // no way to know whose Drive to upload to.
    const auth = await schoolFromToken(supabase, request, 'drive-upload')
    if (auth.error) {
      console.log('[drive-upload] REJECTED at stage:', auth.stage, '-', auth.error)
      return NextResponse.json({ error: auth.error, stage: auth.stage }, { status: auth.status })
    }

    const integration = await getIntegration(supabase, auth.schoolId)
    console.log('[drive-upload] integration for school', auth.schoolId, ':', integration
      ? `enabled=${integration.google_drive_enabled} has_key=${!!integration.google_service_account_key} folder=${integration.google_drive_folder_id}`
      : 'NO ROW in school_integrations')

    if (!integration?.google_drive_enabled) {
      return NextResponse.json(
        { error: 'Google Drive is not enabled for this school' },
        { status: 400 }
      )
    }
    if (!integration.google_service_account_key || !integration.google_drive_folder_id) {
      return NextResponse.json(
        { error: 'Google Drive is not fully configured. Add the service account key and folder ID in Settings.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const program = formData.get('program') || 'General'
    const month = formData.get('month') ||
      new Date().toLocaleString('en-IN', { month: 'long' })
    const year = formData.get('year') ||
      new Date().getFullYear().toString()

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const credentials = parseServiceAccountKey(integration.google_service_account_key)
    const drive = driveFromCredentials(credentials)
    const rootFolderId = integration.google_drive_folder_id
    console.log('[drive-upload] uploading', file.name, `(${file.size} bytes)`,
      'as', credentials.client_email, 'into folder', rootFolderId)

    // Create folder structure
    const ayFolder = await getOrCreateFolder(
      drive, rootFolderId,
      `${year}-${parseInt(year) + 1}`
    )
    const programFolder = await getOrCreateFolder(
      drive, ayFolder, program
    )
    const monthFolder = await getOrCreateFolder(
      drive, programFolder,
      `${month} ${year}`
    )

    // Upload file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const stream = Readable.from(buffer)

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [monthFolder]
      },
      media: {
        mimeType: file.type,
        body: stream
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    })

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.data.id,
      fileName: uploadedFile.data.name,
      viewLink: uploadedFile.data.webViewLink
    })
  } catch (error) {
    console.error('Drive upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

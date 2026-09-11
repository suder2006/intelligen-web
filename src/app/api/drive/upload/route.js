export const dynamic = 'force-dynamic'
// A photo still streams through this function, so give it more than the
// default timeout to reach Drive on a slow phone connection.
export const maxDuration = 60
import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import {
  serviceClient,
  schoolFromToken,
  getIntegration,
  parseServiceAccountKey,
  driveFromCredentials,
  authFromCredentials,
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

// Everything the two handlers share: the caller's school, that school's Drive
// credentials, and the academic-year/program/month folders the file belongs in.
// Returns { response } when the request should be answered straight away, so a
// caller can hand that back untouched.
async function resolveTarget(request, fields, tag) {
  // A missing service role key makes every token look invalid, so say so
  // outright rather than letting it surface as a confusing 401.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`[${tag}] SUPABASE_SERVICE_ROLE_KEY is not set in this environment`)
    return {
      response: NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing', stage: 'no-service-key' },
        { status: 500 }
      )
    }
  }
  const supabase = serviceClient()

  // The token identifies the school, so it is required — without it there is
  // no way to know whose Drive to upload to.
  const auth = await schoolFromToken(supabase, request, tag)
  if (auth.error) {
    console.log(`[${tag}] REJECTED at stage:`, auth.stage, '-', auth.error)
    return { response: NextResponse.json({ error: auth.error, stage: auth.stage }, { status: auth.status }) }
  }

  const integration = await getIntegration(supabase, auth.schoolId)
  console.log(`[${tag}] integration for school`, auth.schoolId, ':', integration
    ? `enabled=${integration.google_drive_enabled} has_key=${!!integration.google_service_account_key} folder=${integration.google_drive_folder_id}`
    : 'NO ROW in school_integrations')

  if (!integration?.google_drive_enabled) {
    return {
      response: NextResponse.json(
        { error: 'Google Drive is not enabled for this school' },
        { status: 400 }
      )
    }
  }
  if (!integration.google_service_account_key || !integration.google_drive_folder_id) {
    return {
      response: NextResponse.json(
        { error: 'Google Drive is not fully configured. Add the service account key and folder ID in Settings.' },
        { status: 400 }
      )
    }
  }

  const program = fields.program || 'General'
  const month = fields.month || new Date().toLocaleString('en-IN', { month: 'long' })
  const year = fields.year || new Date().getFullYear().toString()

  const credentials = parseServiceAccountKey(integration.google_service_account_key)
  const drive = driveFromCredentials(credentials)
  const rootFolderId = integration.google_drive_folder_id

  const academicYear = `${year}-${parseInt(year) + 1}`
  const ayFolder = await getOrCreateFolder(drive, rootFolderId, academicYear)
  const programFolder = await getOrCreateFolder(drive, ayFolder, program)
  const monthFolder = await getOrCreateFolder(drive, programFolder, `${month} ${year}`)

  return {
    drive,
    credentials,
    folderId: monthFolder,
    folderPath: `${academicYear}/${program}/${month} ${year}`
  }
}

// Opens a Drive resumable upload session and hands back only its URL.
//
// A video is far larger than the 4.5 MB of request body a serverless function
// is allowed to receive, so its bytes must never pass through here — the caller
// PUTs the file straight to the URL this returns. The service account key stays
// on the server, and the session URL Google mints is single-use and short-lived.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = (searchParams.get('fileName') || '').trim()
    const mimeType = (searchParams.get('mimeType') || '').trim() || 'application/octet-stream'
    console.log('[drive-session] request for', fileName || '(no fileName)', 'type', mimeType)

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }

    const target = await resolveTarget(request, {
      program: searchParams.get('program'),
      month: searchParams.get('month'),
      year: searchParams.get('year')
    }, 'drive-session')
    if (target.response) return target.response

    // googleapis would upload the bytes itself, which is the one thing that
    // has to be avoided here, so the session is opened against the REST
    // endpoint directly and only the URL Google returns is passed on.
    const accessToken = await authFromCredentials(target.credentials).getAccessToken()
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType
        },
        body: JSON.stringify({ name: fileName, parents: [target.folderId] })
      }
    )

    // Google answers with an empty body; the session lives in the Location header.
    const sessionUrl = res.headers.get('location')
    if (!res.ok || !sessionUrl) {
      const detail = await res.text().catch(() => '')
      console.error('[drive-session] Google refused the session:', res.status, detail.slice(0, 300))
      return NextResponse.json(
        {
          error: `Google would not start the upload (HTTP ${res.status}). Check that the folder is shared with the service account.`,
          stage: 'session-refused'
        },
        { status: 502 }
      )
    }

    console.log('[drive-session] session opened for', fileName, 'in', target.folderPath)
    return NextResponse.json({ sessionUrl, folderPath: target.folderPath })
  } catch (error) {
    console.error('Drive session error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Uploads into the school's own Drive. Credentials come from the school's
// school_integrations row (configured in Admin > Settings), never from platform
// env vars, so one school's files can never land in another's Drive.
//
// Photos only: they sit well under the request body limit. Videos use the GET
// above and never send their bytes through this function.
export async function POST(request) {
  try {
    console.log('[drive-upload] request from', request.headers.get('origin') || 'no origin', '->', request.url)

    const formData = await request.formData()
    const file = formData.get('file')

    const target = await resolveTarget(request, {
      program: formData.get('program'),
      month: formData.get('month'),
      year: formData.get('year')
    }, 'drive-upload')
    if (target.response) return target.response

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('[drive-upload] uploading', file.name, `(${file.size} bytes)`,
      'as', target.credentials.client_email, 'into', target.folderPath)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const stream = Readable.from(buffer)

    const uploadedFile = await target.drive.files.create({
      requestBody: {
        name: file.name,
        parents: [target.folderId]
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

import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const getAuth = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  })
}

const getOrCreateFolder = async (drive, parentId, folderName) => {
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  })
  if (res.data.files.length > 0) return res.data.files[0].id
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  })
  return folder.data.id
}

export async function POST(request) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
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

    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

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
      fields: 'id, name, webViewLink'
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
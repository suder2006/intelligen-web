import { NextResponse } from 'next/server'
import { getPresignedUploadUrl } from '@/lib/r2'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Verify user is authenticated
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileName, contentType, folder } = await request.json()

    if (!fileName || !contentType || !folder) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create unique key
    const ext = fileName.split('.').pop()
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

    // Get presigned URL
    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType)

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
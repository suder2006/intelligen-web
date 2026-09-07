import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL

// Generate presigned URL for direct upload
export async function getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  const url = await getSignedUrl(R2, command, { expiresIn })
  return { uploadUrl: url, publicUrl: `${PUBLIC_URL}/${key}` }
}

// Delete file from R2
export async function deleteFromR2(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  await R2.send(command)
}

// Get public URL for a key
export function getPublicUrl(key) {
  return `${PUBLIC_URL}/${key}`
}
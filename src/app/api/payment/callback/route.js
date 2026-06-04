export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const params = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      params.append(key, value)
    }
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?${params.toString()}`
    )
  } catch (e) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=error`
    )
  }
}
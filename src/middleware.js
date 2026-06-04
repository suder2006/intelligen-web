import { NextResponse } from 'next/server'

export async function middleware(request) {
  if (request.nextUrl.pathname === '/payment/success' && request.method === 'POST') {
    const formData = await request.formData()
    const params = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      params.append(key, value)
    }
    return NextResponse.redirect(
      new URL(`/payment/success?${params.toString()}`, request.url)
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/payment/success'
}
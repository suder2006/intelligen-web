import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Only handle POST to /payment/success
  // Skip if it's already a GET (has query params from our redirect)
  if (request.nextUrl.pathname === '/payment/success' && 
      request.method === 'POST') {
    try {
      const formData = await request.formData()
      const params = new URLSearchParams()
      for (const [key, value] of formData.entries()) {
        params.append(key, value)
      }
      const url = new URL(request.url)
      url.search = params.toString()
      // Force GET redirect
      return new NextResponse(null, {
        status: 303,
        headers: {
          Location: `${process.env.NEXT_PUBLIC_APP_URL}/payment/result?${params.toString()}`
        }
      })
    } catch (e) {
      return new NextResponse(null, {
        status: 303,
        headers: {
          Location: `${process.env.NEXT_PUBLIC_APP_URL}/payment/result?status=error`
        }
      })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/payment/success'
}
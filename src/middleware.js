import { NextResponse } from 'next/server'

export async function middleware(request) {
  if (request.nextUrl.pathname === '/payment/success' && 
      request.method === 'POST') {
    try {
      const formData = await request.formData()
      const params = new URLSearchParams()
      for (const [key, value] of formData.entries()) {
        params.append(key, value)
      }
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
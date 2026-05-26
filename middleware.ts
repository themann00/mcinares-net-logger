import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'net_session'
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const isApi = request.nextUrl.pathname.startsWith('/api') && !request.nextUrl.pathname.startsWith('/api/auth')
  const isProtected = request.nextUrl.pathname.startsWith('/net') || request.nextUrl.pathname.startsWith('/roster') || isApi

  if (!isProtected) return NextResponse.next()

  if (!token) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    if (isApi) return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/net/:path*', '/roster', '/api/:path*'],
}

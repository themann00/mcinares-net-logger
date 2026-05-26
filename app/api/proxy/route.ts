import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !url.startsWith('https://www.mcinares.org/')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })

    const data = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'application/octet-stream'

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

/**
 * Address / cross-street → coordinates via OpenStreetMap Nominatim
 * (free, no key; usage policy allows light interactive use with an
 * identifying User-Agent, max 1 req/sec). Results are biased toward
 * Marion County but not restricted to it.
 */

// left,top,right,bottom around Marion County, IN
const MARION_VIEWBOX = '-86.45,39.99,-85.85,39.58'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  // Bare street/intersection queries resolve better with the city attached.
  const query = /indianapolis|indiana|,/i.test(q) ? q : `${q}, Indianapolis, IN`

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '3',
      countrycodes: 'us',
      viewbox: MARION_VIEWBOX,
    }).toString()

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'mcinares-net-logger/1.0 (Marion County ARES siren tracking)',
      'Accept-Language': 'en-US',
    },
    // Nominatim results for the same query rarely change; cache for a day.
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `geocoder returned ${res.status}` }, { status: 502 })
  }

  const results = await res.json() as { lat: string; lon: string; display_name: string }[]
  return NextResponse.json(
    results.map(r => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      label: r.display_name,
    }))
  )
}

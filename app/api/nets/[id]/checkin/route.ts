import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveStation, buildCheckinContent } from '@/lib/station'
import type { StationType, Quadrant } from '@/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const {
    callsign,
    first_name,
    last_name,
    station_type,
    location,
    quadrant,
    has_traffic,
    has_announcements,
    report,
    checked_in_at,
    manual_prefix,
  } = body as {
    callsign: string
    first_name?: string
    last_name?: string
    station_type?: StationType
    location?: string
    quadrant?: Quadrant
    has_traffic?: boolean
    has_announcements?: boolean
    report?: string
    checked_in_at?: string
    manual_prefix?: string
  }

  if (!callsign) {
    return NextResponse.json({ error: 'callsign is required' }, { status: 400 })
  }

  const cs = callsign.toUpperCase().trim()
  const db = getSupabase()
  const timestamp = checked_in_at || new Date().toISOString()

  let station
  try {
    station = await resolveStation(db, cs, { netId: id, firstName: first_name, lastName: last_name })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'station resolve failed' }, { status: 500 })
  }

  // Per-net facts only; identity (callsign, names) lives on the roster.
  // callsign here is a write-time snapshot for fallback display; the
  // authoritative value is the roster row referenced by station_id.
  const metadata = {
    callsign: station.callsign,
    callsign_as_typed: cs,
    station_type: station_type || null,
    location: location || null,
    quadrant: quadrant || null,
    has_traffic: has_traffic || false,
    has_announcements: has_announcements || false,
  }

  const { data: logEntry, error } = await db.from('mcinares_log_entries').insert({
    net_id: id,
    station_id: station.id,
    entry_type: 'checkin',
    content: `${manual_prefix || ''}${buildCheckinContent(station.callsign, metadata)}`,
    timestamp,
    metadata,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (report?.trim()) {
    await db.from('mcinares_log_entries').insert({
      net_id: id,
      station_id: station.id,
      entry_type: 'report',
      content: `${station.callsign}: ${report.trim()}`,
      metadata: { callsign: station.callsign, callsign_as_typed: cs },
    })
  }

  return NextResponse.json(logEntry, { status: 201 })
}

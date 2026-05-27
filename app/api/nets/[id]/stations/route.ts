import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { StationType, Quadrant } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await getSupabase()
    .from('mcinares_stations')
    .select('*')
    .eq('net_id', id)
    .order('checked_in_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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

  const insertData: Record<string, unknown> = {
    net_id: id,
    callsign: callsign.toUpperCase().trim(),
    first_name: first_name || null,
    last_name: last_name || null,
    station_type: station_type || null,
    location: location || null,
    quadrant: quadrant || null,
    has_traffic: has_traffic || false,
    has_announcements: has_announcements || false,
  }
  if (checked_in_at) insertData.checked_in_at = checked_in_at

  const { data: station, error: stationError } = await getSupabase()
    .from('mcinares_stations')
    .insert(insertData)
    .select()
    .single()

  if (stationError) return NextResponse.json({ error: stationError.message }, { status: 500 })

  await getSupabase()
    .from('mcinares_roster')
    .upsert(
      {
        callsign: station.callsign,
        first_name: first_name || null,
        last_name: last_name || null,
      },
      { onConflict: 'callsign', ignoreDuplicates: false }
    )

  // Build check-in log content
  const parts: string[] = [`${station.callsign} checked in`]
  if (station_type) parts.push(`(${station_type})`)
  if (location) parts.push(`@ ${location}`)
  if (quadrant) parts.push(`[${quadrant}]`)
  if (has_traffic) parts.push('— has traffic')
  if (has_announcements) parts.push('— has announcement')

  const logEntry: Record<string, unknown> = {
    net_id: id,
    station_id: station.id,
    entry_type: 'checkin',
    content: `${manual_prefix || ''}${parts.join(' ')}`,
  }
  if (checked_in_at) logEntry.timestamp = checked_in_at

  await getSupabase().from('mcinares_log_entries').insert(logEntry)

  // If a report was provided at check-in, log it too
  if (report?.trim()) {
    await getSupabase().from('mcinares_log_entries').insert({
      net_id: id,
      station_id: station.id,
      entry_type: 'report',
      content: `${station.callsign}: ${report.trim()}`,
    })
  }

  return NextResponse.json(station, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { station_id, station_type, location, log_reason, ...rest } = body

  if (!station_id) {
    return NextResponse.json({ error: 'station_id required' }, { status: 400 })
  }

  const { data: station, error } = await getSupabase()
    .from('mcinares_stations')
    .update({ station_type, location, ...rest })
    .eq('id', station_id)
    .eq('net_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reason: string = log_reason || 'circle_back'

  if (reason === 'moved') {
    const parts: string[] = []
    if (location) parts.push(location)
    if (rest.quadrant) parts.push(`[${rest.quadrant}]`)
    await getSupabase().from('mcinares_log_entries').insert({
      net_id: id,
      station_id,
      entry_type: 'station_moved',
      content: `${station.callsign} moved${parts.length ? ' to ' + parts.join(' ') : ''}`,
    })
  }

  return NextResponse.json(station)
}

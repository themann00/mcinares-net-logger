import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
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

  const parts: string[] = [`${cs} checked in`]
  if (station_type) parts.push(`(${station_type})`)
  if (location) parts.push(`@ ${location}`)
  if (quadrant) parts.push(`[${quadrant}]`)
  if (has_traffic) parts.push('— has traffic')
  if (has_announcements) parts.push('— has announcement')

  const metadata = {
    callsign: cs,
    first_name: first_name || null,
    last_name: last_name || null,
    station_type: station_type || null,
    location: location || null,
    quadrant: quadrant || null,
    has_traffic: has_traffic || false,
    has_announcements: has_announcements || false,
  }

  const { data: logEntry, error } = await db.from('mcinares_log_entries').insert({
    net_id: id,
    entry_type: 'checkin',
    content: `${manual_prefix || ''}${parts.join(' ')}`,
    timestamp,
    metadata,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: existing } = await db
    .from('mcinares_roster')
    .select('first_name, last_name')
    .eq('callsign', cs)
    .maybeSingle()

  if (!existing) {
    await db.from('mcinares_roster').insert({
      callsign: cs,
      first_name: first_name || null,
      last_name: last_name || null,
    })
  } else {
    const update: Record<string, unknown> = {}
    if (first_name && !existing.first_name) update.first_name = first_name
    if (last_name && !existing.last_name) update.last_name = last_name
    if (Object.keys(update).length > 0) {
      await db.from('mcinares_roster').update(update).eq('callsign', cs)
    }
  }

  if (report?.trim()) {
    await db.from('mcinares_log_entries').insert({
      net_id: id,
      entry_type: 'report',
      content: `${cs}: ${report.trim()}`,
      metadata: { callsign: cs },
    })
  }

  return NextResponse.json(logEntry, { status: 201 })
}

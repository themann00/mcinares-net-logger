import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveStation } from '@/lib/station'
import type { LogEntryType } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .select('*, station:mcinares_roster(id, callsign, first_name, last_name)')
    .eq('net_id', id)
    .order('timestamp', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { entry_type, content, timestamp, metadata, station_id, callsign } = body as {
    entry_type: LogEntryType
    content: string
    timestamp?: string
    metadata?: Record<string, unknown>
    station_id?: string
    callsign?: string
  }

  if (!entry_type || !content) {
    return NextResponse.json({ error: 'entry_type and content are required' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = { net_id: id, entry_type, content }
  if (timestamp) insertData.timestamp = timestamp
  if (metadata) insertData.metadata = metadata

  // Station reference: direct UUID, or resolve a callsign (creating the
  // roster entry if new, stamped with this net).
  if (station_id) {
    insertData.station_id = station_id
  } else if (callsign?.trim()) {
    try {
      const station = await resolveStation(getSupabase(), callsign, { netId: id })
      insertData.station_id = station.id
      insertData.metadata = {
        ...(metadata || {}),
        callsign: station.callsign,
        callsign_as_typed: callsign.toUpperCase().trim(),
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'station resolve failed' }, { status: 500 })
    }
  }

  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { entry_id, content, metadata, station_id } = await request.json() as {
    entry_id: string
    content?: string
    metadata?: Record<string, unknown>
    station_id?: string
  }

  if (!entry_id) {
    return NextResponse.json({ error: 'entry_id is required' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (content !== undefined) update.content = content.trim()
  if (station_id !== undefined) update.station_id = station_id

  // Merge metadata keys into the existing object so partial updates
  // (e.g. just location) don't clobber the rest.
  if (metadata !== undefined) {
    const { data: existing } = await getSupabase()
      .from('mcinares_log_entries')
      .select('metadata')
      .eq('id', entry_id)
      .eq('net_id', id)
      .single()
    update.metadata = { ...((existing?.metadata as Record<string, unknown> | null) || {}), ...metadata }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .update(update)
    .eq('id', entry_id)
    .eq('net_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { entry_id } = await request.json() as { entry_id: string }

  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

  const { error } = await getSupabase()
    .from('mcinares_log_entries')
    .delete()
    .eq('id', entry_id)
    .eq('net_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

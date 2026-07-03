import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveStation } from '@/lib/station'
import { normalizeSirenId } from '@/lib/sirenLocations'
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
  const { entry_id, content, metadata, station_id, timestamp, entry_type } = await request.json() as {
    entry_id: string
    content?: string
    metadata?: Record<string, unknown>
    station_id?: string
    timestamp?: string
    entry_type?: LogEntryType
  }

  if (!entry_id) {
    return NextResponse.json({ error: 'entry_id is required' }, { status: 400 })
  }

  const db = getSupabase()
  const update: Record<string, unknown> = {}
  if (content !== undefined) update.content = content.trim()
  if (station_id !== undefined) update.station_id = station_id
  if (entry_type !== undefined) update.entry_type = entry_type
  if (timestamp !== undefined) {
    const ts = new Date(timestamp)
    if (isNaN(ts.getTime())) {
      return NextResponse.json({ error: 'invalid timestamp' }, { status: 400 })
    }
    update.timestamp = ts.toISOString()
  }

  // Snapshot the entry before the update: metadata merges need the current
  // object, and timestamp syncing needs the old timestamp to find unlinked
  // siren history rows.
  let existing: { metadata: unknown; timestamp: string; entry_type: string } | null = null
  if (metadata !== undefined || timestamp !== undefined) {
    const { data } = await db
      .from('mcinares_log_entries')
      .select('metadata, timestamp, entry_type')
      .eq('id', entry_id)
      .eq('net_id', id)
      .single()
    existing = data
  }

  // Merge metadata keys into the existing object so partial updates
  // (e.g. just location) don't clobber the rest.
  if (metadata !== undefined) {
    update.metadata = { ...((existing?.metadata as Record<string, unknown> | null) || {}), ...metadata }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('mcinares_log_entries')
    .update(update)
    .eq('id', entry_id)
    .eq('net_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep the permanent siren check history in step with log timestamp edits,
  // mid-net or after close. Linked rows move directly; legacy rows without
  // the link are matched by net + siren number + proximity to the old time.
  if (update.timestamp && existing) {
    const { data: linked } = await db
      .from('mcinares_siren_status')
      .update({ timestamp: update.timestamp })
      .eq('log_entry_id', entry_id)
      .select('id')

    if ((!linked || linked.length === 0) && existing.entry_type === 'report') {
      const meta = existing.metadata as Record<string, unknown> | null
      const sn = typeof meta?.siren_number === 'string' ? meta.siren_number : ''
      if (sn) {
        const norm = normalizeSirenId(sn).toUpperCase()
        const oldMs = new Date(existing.timestamp).getTime()
        const { data: candidates } = await db
          .from('mcinares_siren_status')
          .select('id, siren_number, timestamp')
          .eq('net_id', id)
        for (const c of candidates || []) {
          if (normalizeSirenId(c.siren_number).toUpperCase() !== norm) continue
          if (Math.abs(new Date(c.timestamp).getTime() - oldMs) > 120000) continue
          await db
            .from('mcinares_siren_status')
            .update({ timestamp: update.timestamp, log_entry_id: entry_id })
            .eq('id', c.id)
        }
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { entry_id } = await request.json() as { entry_id: string }

  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

  // Deleting a report entry retracts its siren check history row too —
  // whole-net deletes cascade at the DB level via net_id.
  await getSupabase()
    .from('mcinares_siren_status')
    .delete()
    .eq('log_entry_id', entry_id)

  const { error } = await getSupabase()
    .from('mcinares_log_entries')
    .delete()
    .eq('id', entry_id)
    .eq('net_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

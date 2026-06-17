import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { replaceCallsign } from '@/lib/station'

export async function GET() {
  const db = getSupabase()

  const { data: roster, error: rosterError } = await db
    .from('mcinares_roster')
    .select('*')
    .order('callsign')

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  const { data: logStats, error: logError } = await db
    .from('mcinares_log_entries')
    .select('station_id, net_id, metadata, timestamp')
    .in('entry_type', ['checkin', 'late_checkin'])

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  // Testing-net check-ins are ephemeral and must not count toward a registered
  // station's totals or last-heard date.
  const { data: testingNets } = await db
    .from('mcinares_nets')
    .select('id')
    .eq('testing', true)
  const testingNetIds = new Set((testingNets || []).map(n => n.id))

  // Key stats by roster UUID; fall back to callsign for legacy entries
  // that predate station_id.
  const idByCallsign: Record<string, string> = {}
  for (const r of roster || []) idByCallsign[r.callsign.toUpperCase()] = r.id

  const checkinMap: Record<string, { count: number; last: string }> = {}
  for (const e of logStats || []) {
    if (testingNetIds.has(e.net_id)) continue
    const meta = e.metadata as Record<string, unknown> | null
    const stationId = e.station_id || idByCallsign[((meta?.callsign as string) || '').toUpperCase()]
    if (!stationId) continue
    if (!checkinMap[stationId]) {
      checkinMap[stationId] = { count: 0, last: e.timestamp }
    }
    checkinMap[stationId].count++
    if (e.timestamp > checkinMap[stationId].last) {
      checkinMap[stationId].last = e.timestamp
    }
  }

  const result = (roster || []).map(r => {
    const systemLast = checkinMap[r.id]?.last || null
    const externalLast = r.last_external_participation || null
    let last_checkin = systemLast
    if (externalLast && (!systemLast || externalLast > systemLast)) {
      last_checkin = externalLast
    }
    return {
      ...r,
      checkin_count: checkinMap[r.id]?.count || 0,
      last_checkin,
    }
  })

  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, callsign, first_name, last_name, email, license, address, county } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Partial update: only fields present in the request body are touched.
  const update: Record<string, unknown> = {}
  if (callsign !== undefined) update.callsign = callsign?.toUpperCase()?.trim() || undefined
  if (first_name !== undefined) update.first_name = first_name?.trim() || null
  if (last_name !== undefined) update.last_name = last_name?.trim() || null
  if (email !== undefined) update.email = email?.trim() || null
  if (license !== undefined) update.license = license?.trim() || null
  if (address !== undefined) update.address = address?.trim() || null
  if (county !== undefined) update.county = county?.trim() || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const db = getSupabase()
  let renamedFrom: string | null = null

  if (typeof update.callsign === 'string') {
    const newCs = update.callsign as string
    const { data: current } = await db
      .from('mcinares_roster')
      .select('id, callsign')
      .eq('id', id)
      .single()

    if (current && current.callsign.toUpperCase() !== newCs.toUpperCase()) {
      // Vanity-callsign rename path: refuse silently colliding with another
      // station; the client offers merge / rename-other / cancel.
      const { data: conflict } = await db
        .from('mcinares_roster')
        .select('id, callsign')
        .ilike('callsign', newCs)
        .neq('id', id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json({ error: 'callsign already exists', conflict }, { status: 409 })
      }
      renamedFrom = current.callsign
    }
  }

  const { data, error } = await db
    .from('mcinares_roster')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Refresh cached content/metadata snapshots on every log entry of this
  // station so renames don't leave stale text behind. UUID refs are untouched.
  if (renamedFrom) {
    const { data: entries } = await db
      .from('mcinares_log_entries')
      .select('id, content, metadata')
      .eq('station_id', id)
    for (const e of entries || []) {
      const meta = (e.metadata as Record<string, unknown> | null) || {}
      await db.from('mcinares_log_entries').update({
        content: replaceCallsign(e.content, renamedFrom, data.callsign),
        metadata: { ...meta, callsign: data.callsign },
      }).eq('id', e.id)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getSupabase()

  // Stations with log history cannot be deleted; merge instead.
  const { count } = await db
    .from('mcinares_log_entries')
    .select('id', { count: 'exact', head: true })
    .eq('station_id', id)

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: `Station has ${count} log reference${count === 1 ? '' : 's'}. Merge instead.`, refs: count },
      { status: 409 }
    )
  }

  const { error } = await db
    .from('mcinares_roster')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

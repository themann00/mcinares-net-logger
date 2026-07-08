import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveStation } from '@/lib/station'
import { requestNow } from '@/lib/serverTime'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getSupabase()

  // Optional NC details from setup (skywarn asks for the NC's quadrant so the
  // controller doesn't land in the Unknown group).
  let ncQuadrant: string | null = null
  try {
    const body = await _req.json()
    if (typeof body?.nc_quadrant === 'string' && body.nc_quadrant) ncQuadrant = body.nc_quadrant
  } catch {
    // no body — fine
  }

  const { data: net, error: netError } = await db
    .from('mcinares_nets')
    .select('*')
    .eq('id', id)
    .single()

  if (netError || !net) {
    return NextResponse.json({ error: 'Net not found' }, { status: 404 })
  }

  const now = requestNow(_req)
  const checkinTime = new Date(now.getTime() + 1000)

  await db.from('mcinares_log_entries').insert({
    net_id: id,
    entry_type: 'net_open',
    content: `Net opened by ${net.net_controller}`,
    timestamp: now.toISOString(),
    metadata: { net_controller: net.net_controller },
  })

  // Link the NC's check-in to the roster like every other check-in, so their
  // name flows into station lists and exports. resolveStation stamps rows it
  // creates with this net's id, and testing-net deletion cleans those up.
  let ncStationId: string | null = null
  try {
    const station = await resolveStation(db, net.net_controller, { netId: id })
    ncStationId = station.id
  } catch {
    // roster resolution failing shouldn't block the net from opening
  }

  await db.from('mcinares_log_entries').insert({
    net_id: id,
    ...(ncStationId ? { station_id: ncStationId } : {}),
    entry_type: 'checkin',
    content: `${net.net_controller} checked in (net control)`,
    timestamp: checkinTime.toISOString(),
    metadata: {
      callsign: net.net_controller,
      station_type: 'base',
      location: 'N/A',
      ...(ncQuadrant ? { quadrant: ncQuadrant } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

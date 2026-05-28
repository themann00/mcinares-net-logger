import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getSupabase()

  const { data: net, error: netError } = await db
    .from('mcinares_nets')
    .select('*')
    .eq('id', id)
    .single()

  if (netError || !net) {
    return NextResponse.json({ error: 'Net not found' }, { status: 404 })
  }

  const now = new Date()
  const checkinTime = new Date(now.getTime() + 1000)

  await db.from('mcinares_log_entries').insert({
    net_id: id,
    entry_type: 'net_open',
    content: `Net opened by ${net.net_controller}`,
    timestamp: now.toISOString(),
    metadata: { net_controller: net.net_controller },
  })

  await db.from('mcinares_log_entries').insert({
    net_id: id,
    entry_type: 'checkin',
    content: `${net.net_controller} checked in (net control)`,
    timestamp: checkinTime.toISOString(),
    metadata: { callsign: net.net_controller, station_type: 'base', location: 'N/A' },
  })

  await db.from('mcinares_roster').upsert(
    { callsign: net.net_controller },
    { onConflict: 'callsign', ignoreDuplicates: true }
  )

  return NextResponse.json({ ok: true })
}

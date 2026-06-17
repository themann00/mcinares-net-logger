import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { NetType } from '@/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, net_controller, testing, defer_start } = body as {
    type: NetType; net_controller: string; testing?: boolean; defer_start?: boolean
  }

  if (!type || !net_controller) {
    return NextResponse.json({ error: 'type and net_controller are required' }, { status: 400 })
  }

  const cs = net_controller.toUpperCase().trim()
  const db = getSupabase()

  const { data: net, error: netError } = await db
    .from('mcinares_nets')
    .insert({ type, net_controller: cs, testing: testing || false })
    .select()
    .single()

  if (netError) return NextResponse.json({ error: netError.message }, { status: 500 })

  if (!defer_start) {
    const now = new Date()
    const checkinTime = new Date(now.getTime() + 1000)

    await db.from('mcinares_log_entries').insert({
      net_id: net.id,
      entry_type: 'net_open',
      content: `Net opened by ${cs}`,
      timestamp: now.toISOString(),
      metadata: { net_controller: cs },
    })

    await db.from('mcinares_log_entries').insert({
      net_id: net.id,
      entry_type: 'checkin',
      content: `${cs} checked in (net control)`,
      timestamp: checkinTime.toISOString(),
      metadata: { callsign: cs, station_type: 'base', location: 'N/A' },
    })

    // Testing nets stay ephemeral: don't register the controller's callsign.
    if (!testing) {
      await db.from('mcinares_roster').upsert(
        { callsign: cs },
        { onConflict: 'callsign', ignoreDuplicates: true }
      )
    }
  }

  return NextResponse.json(net, { status: 201 })
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from('mcinares_nets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

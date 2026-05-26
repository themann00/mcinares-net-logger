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

  const { data: net, error: netError } = await getSupabase()
    .from('mcinares_nets')
    .insert({ type, net_controller, testing: testing || false })
    .select()
    .single()

  if (netError) {
    console.error('Supabase insert mcinares_nets failed:', netError)
    return NextResponse.json({ error: netError.message }, { status: 500 })
  }

  if (!defer_start) {
    const openTime = new Date(net.started_at)
    const checkinTime = new Date(openTime.getTime() + 1000)

    await getSupabase().from('mcinares_log_entries').insert({
      net_id: net.id,
      entry_type: 'net_open',
      content: `Net opened by ${net_controller}`,
      timestamp: openTime.toISOString(),
    })

    await getSupabase()
      .from('mcinares_stations')
      .insert({
        net_id: net.id,
        callsign: net_controller,
        station_type: 'base',
        location: 'N/A',
        checked_in_at: checkinTime.toISOString(),
      })

    await getSupabase().from('mcinares_log_entries').insert({
      net_id: net.id,
      entry_type: 'checkin',
      content: `${net_controller} checked in (net control)`,
      timestamp: checkinTime.toISOString(),
    })
  }

  return NextResponse.json(net, { status: 201 })
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from('mcinares_nets')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

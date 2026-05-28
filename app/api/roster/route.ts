import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const db = getSupabase()

  const { data: roster, error: rosterError } = await db
    .from('mcinares_roster')
    .select('*')
    .order('callsign')

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  const { data: logStats, error: logError } = await db
    .from('mcinares_log_entries')
    .select('metadata, timestamp')
    .in('entry_type', ['checkin', 'late_checkin'])

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const checkinMap: Record<string, { count: number; last: string }> = {}
  for (const e of logStats || []) {
    const meta = e.metadata as Record<string, unknown> | null
    const cs = ((meta?.callsign as string) || '').toUpperCase()
    if (!cs) continue
    if (!checkinMap[cs]) {
      checkinMap[cs] = { count: 0, last: e.timestamp }
    }
    checkinMap[cs].count++
    if (e.timestamp > checkinMap[cs].last) {
      checkinMap[cs].last = e.timestamp
    }
  }

  const result = (roster || []).map(r => {
    const systemLast = checkinMap[r.callsign.toUpperCase()]?.last || null
    const externalLast = r.last_external_participation || null
    let last_checkin = systemLast
    if (externalLast && (!systemLast || externalLast > systemLast)) {
      last_checkin = externalLast
    }
    return {
      ...r,
      checkin_count: checkinMap[r.callsign.toUpperCase()]?.count || 0,
      last_checkin,
    }
  })

  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const { id, callsign, first_name, last_name, email } = await request.json()

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await getSupabase()
    .from('mcinares_roster')
    .update({
      callsign: callsign?.toUpperCase()?.trim() || undefined,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      email: email?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await getSupabase()
    .from('mcinares_roster')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

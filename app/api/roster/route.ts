import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const db = getSupabase()

  const { data: roster, error: rosterError } = await db
    .from('mcinares_roster')
    .select('*')
    .order('callsign')

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  const { data: stats, error: statsError } = await db
    .from('mcinares_stations')
    .select('callsign, checked_in_at')

  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 500 })

  const checkinMap: Record<string, { count: number; last: string }> = {}
  for (const s of stats || []) {
    const cs = s.callsign.toUpperCase()
    if (!checkinMap[cs]) {
      checkinMap[cs] = { count: 0, last: s.checked_in_at }
    }
    checkinMap[cs].count++
    if (s.checked_in_at > checkinMap[cs].last) {
      checkinMap[cs].last = s.checked_in_at
    }
  }

  const result = (roster || []).map(r => ({
    ...r,
    checkin_count: checkinMap[r.callsign.toUpperCase()]?.count || 0,
    last_checkin: checkinMap[r.callsign.toUpperCase()]?.last || null,
  }))

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

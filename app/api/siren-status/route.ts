import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { normalizeSirenId } from '@/lib/sirenLocations'
import { requestNow } from '@/lib/serverTime'

/**
 * Running log of siren checks across all siren check nets. Rows are appended
 * whenever a siren report naming a siren is logged; they are never rewritten,
 * so the table is a permanent per-siren history.
 */

export async function GET(request: NextRequest) {
  const siren = request.nextUrl.searchParams.get('siren')

  let query = getSupabase()
    .from('mcinares_siren_status')
    .select('*')
    .order('timestamp', { ascending: false })

  if (siren) query = query.eq('siren_number', normalizeSirenId(siren))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    net_id?: string
    log_entry_id?: string
    callsign?: string
    siren_number: string
    sound?: boolean | null
    rotation?: boolean | null
    visual?: boolean | null
    notes?: string
    timestamp?: string
  }

  if (!body.siren_number?.trim()) {
    return NextResponse.json({ error: 'siren_number is required' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
    net_id: body.net_id || null,
    log_entry_id: body.log_entry_id || null,
    callsign: body.callsign?.toUpperCase().trim() || null,
    siren_number: normalizeSirenId(body.siren_number),
    sound: body.sound ?? null,
    rotation: body.rotation ?? null,
    visual: body.visual ?? null,
    notes: body.notes?.trim() || null,
  }
  insert.timestamp = body.timestamp || requestNow(request).toISOString()

  const { data, error } = await getSupabase()
    .from('mcinares_siren_status')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

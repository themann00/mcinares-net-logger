import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { replaceCallsign } from '@/lib/station'

/**
 * Merge one roster station into another (docs/station-identity-spec.md).
 * Every log entry of the source repoints to the target across all nets,
 * target's null contact fields fill from the source, source is deleted.
 */
export async function POST(request: NextRequest) {
  const { source_id, target_id } = await request.json() as { source_id: string; target_id: string }

  if (!source_id || !target_id) {
    return NextResponse.json({ error: 'source_id and target_id are required' }, { status: 400 })
  }
  if (source_id === target_id) {
    return NextResponse.json({ error: 'source and target are the same station' }, { status: 400 })
  }

  const db = getSupabase()

  const [{ data: source }, { data: target }] = await Promise.all([
    db.from('mcinares_roster').select('*').eq('id', source_id).single(),
    db.from('mcinares_roster').select('*').eq('id', target_id).single(),
  ])

  if (!source || !target) {
    return NextResponse.json({ error: 'station not found' }, { status: 404 })
  }

  // Target wins; fill its null fields from the source.
  const fill: Record<string, unknown> = {}
  for (const field of ['first_name', 'last_name', 'email', 'license', 'address', 'county'] as const) {
    if (!target[field] && source[field]) fill[field] = source[field]
  }
  if (source.last_external_participation &&
      (!target.last_external_participation || source.last_external_participation > target.last_external_participation)) {
    fill.last_external_participation = source.last_external_participation
  }
  if (Object.keys(fill).length > 0) {
    const { error: fillError } = await db.from('mcinares_roster').update(fill).eq('id', target_id)
    if (fillError) return NextResponse.json({ error: fillError.message }, { status: 500 })
  }

  // Repoint every source log entry, refreshing cached content/metadata.
  const { data: entries, error: entriesError } = await db
    .from('mcinares_log_entries')
    .select('id, content, metadata')
    .eq('station_id', source_id)

  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

  for (const e of entries || []) {
    const meta = (e.metadata as Record<string, unknown> | null) || {}
    const { error: repointError } = await db.from('mcinares_log_entries').update({
      station_id: target_id,
      content: replaceCallsign(e.content, source.callsign, target.callsign),
      metadata: { ...meta, callsign: target.callsign },
    }).eq('id', e.id)
    if (repointError) return NextResponse.json({ error: repointError.message }, { status: 500 })
  }

  const { error: deleteError } = await db.from('mcinares_roster').delete().eq('id', source_id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, moved: (entries || []).length, target_callsign: target.callsign })
}

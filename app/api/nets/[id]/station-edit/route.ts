import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { replaceCallsign } from '@/lib/station'

/**
 * Station identity edit flow (docs/station-identity-spec.md).
 *
 * mode 'analyze': classify an intended callsign change on a log entry.
 *   Matrix keyed on whether the incorrect (current) station was created in
 *   this net and whether the correct (typed) callsign already exists:
 *     1 new/new       -> rename roster row in place (typo never existed)
 *     2 new/existing  -> repoint to existing, incorrect row "never happened"
 *     3 existing/new  -> create roster row, repoint; prompt for the rest
 *     4 existing/existing -> repoint; prompt for the rest
 *   Rows 1-2 auto-apply only when the incorrect station has a single entry
 *   in this net; otherwise the client shows change-all / highlight / skip.
 *
 * mode 'apply': execute with scope 'entry' (this log entry only) or
 *   'net' (every entry in this net referencing the incorrect station).
 */

interface RosterRow {
  id: string
  callsign: string
  created_in_net_id: string | null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: netId } = await params
  const body = await request.json() as {
    mode: 'analyze' | 'apply'
    entry_id: string
    new_callsign: string
    scope?: 'entry' | 'net'
  }
  const { mode, entry_id, new_callsign, scope } = body

  if (!entry_id || !new_callsign?.trim()) {
    return NextResponse.json({ error: 'entry_id and new_callsign are required' }, { status: 400 })
  }

  const db = getSupabase()
  const newCs = new_callsign.toUpperCase().trim()

  const { data: entry, error: entryError } = await db
    .from('mcinares_log_entries')
    .select('id, net_id, station_id, content, metadata')
    .eq('id', entry_id)
    .eq('net_id', netId)
    .single()

  if (entryError || !entry) {
    return NextResponse.json({ error: entryError?.message || 'entry not found' }, { status: 404 })
  }

  // Target station, if it exists (case-insensitive)
  const { data: target } = await db
    .from('mcinares_roster')
    .select('id, callsign, created_in_net_id')
    .ilike('callsign', newCs)
    .maybeSingle()

  // Current (incorrect) station on the entry
  let incorrect: RosterRow | null = null
  if (entry.station_id) {
    const { data } = await db
      .from('mcinares_roster')
      .select('id, callsign, created_in_net_id')
      .eq('id', entry.station_id)
      .single()
    incorrect = data
  }

  // Entry has no station yet (legacy or non-station entry): attach only.
  if (!incorrect) {
    if (mode === 'analyze') {
      return NextResponse.json({
        case: 'attach',
        auto: true,
        incorrect: null,
        correct: { exists: !!target, id: target?.id || null, callsign: target?.callsign || newCs },
      })
    }
    let targetId = target?.id
    let targetCs = target?.callsign || newCs
    if (!targetId) {
      const { data: created, error: createError } = await db
        .from('mcinares_roster')
        .insert({ callsign: newCs, created_in_net_id: netId })
        .select('id, callsign')
        .single()
      if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
      targetId = created.id
      targetCs = created.callsign
    }
    const meta = (entry.metadata as Record<string, unknown> | null) || {}
    const { error: updError } = await db
      .from('mcinares_log_entries')
      .update({ station_id: targetId, metadata: { ...meta, callsign: targetCs } })
      .eq('id', entry.id)
    if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })
    return NextResponse.json({ ok: true, case: 'attach', repointed: 1, station_id: targetId, callsign: targetCs, orphan: null, remaining_entry_ids: [] })
  }

  if (target && target.id === incorrect.id) {
    return NextResponse.json(mode === 'analyze'
      ? { case: 'noop', auto: true, incorrect: null, correct: { exists: true, id: target.id, callsign: target.callsign } }
      : { ok: true, case: 'noop', repointed: 0, orphan: null, remaining_entry_ids: [] })
  }

  const newThisNet = incorrect.created_in_net_id === netId

  // All entries in this net referencing the incorrect station
  const { data: netEntries, error: netEntriesError } = await db
    .from('mcinares_log_entries')
    .select('id, content, metadata, entry_type, timestamp')
    .eq('net_id', netId)
    .eq('station_id', incorrect.id)
    .order('timestamp', { ascending: true })

  if (netEntriesError) return NextResponse.json({ error: netEntriesError.message }, { status: 500 })

  const { count: elsewhereCount } = await db
    .from('mcinares_log_entries')
    .select('id', { count: 'exact', head: true })
    .eq('station_id', incorrect.id)
    .neq('net_id', netId)

  // Spec table numbering: 1 new/new, 2 new/existing, 3 existing/new, 4 existing/existing
  const specCase = newThisNet ? (target ? 2 : 1) : (target ? 4 : 3)

  if (mode === 'analyze') {
    return NextResponse.json({
      case: specCase,
      auto: newThisNet && (netEntries || []).length <= 1,
      incorrect: {
        id: incorrect.id,
        callsign: incorrect.callsign,
        new_this_net: newThisNet,
        entries_in_net: (netEntries || []).length,
        entry_ids_in_net: (netEntries || []).map(e => e.id),
        entries_elsewhere: elsewhereCount || 0,
      },
      correct: { exists: !!target, id: target?.id || null, callsign: target?.callsign || newCs },
    })
  }

  // ---- apply ----
  const effectiveScope = scope || 'entry'

  // Case 1, scope net: rename the roster row in place. UUID keeps, no repoint.
  if (specCase === 1 && effectiveScope === 'net') {
    const { error: renameError } = await db
      .from('mcinares_roster')
      .update({ callsign: newCs })
      .eq('id', incorrect.id)
    if (renameError) return NextResponse.json({ error: renameError.message }, { status: 500 })

    // Refresh cached content/metadata snapshots on this net's entries
    for (const e of netEntries || []) {
      const meta = (e.metadata as Record<string, unknown> | null) || {}
      await db.from('mcinares_log_entries').update({
        content: replaceCallsign(e.content, incorrect.callsign, newCs),
        metadata: { ...meta, callsign: newCs },
      }).eq('id', e.id)
    }
    return NextResponse.json({ ok: true, case: 1, renamed: true, repointed: 0, station_id: incorrect.id, callsign: newCs, orphan: null, remaining_entry_ids: [] })
  }

  // Every other path repoints to a target station, creating it if needed.
  let targetId = target?.id
  let targetCs = target?.callsign || newCs
  if (!targetId) {
    const { data: created, error: createError } = await db
      .from('mcinares_roster')
      .insert({ callsign: newCs, created_in_net_id: netId })
      .select('id, callsign')
      .single()
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
    targetId = created.id
    targetCs = created.callsign
  }

  const toRepoint = effectiveScope === 'net'
    ? (netEntries || [])
    : (netEntries || []).filter(e => e.id === entry.id)

  for (const e of toRepoint) {
    const meta = (e.metadata as Record<string, unknown> | null) || {}
    const { error: repointError } = await db.from('mcinares_log_entries').update({
      station_id: targetId,
      content: replaceCallsign(e.content, incorrect.callsign, targetCs),
      metadata: { ...meta, callsign: targetCs },
    }).eq('id', e.id)
    if (repointError) return NextResponse.json({ error: repointError.message }, { status: 500 })
  }

  const remaining = (netEntries || []).filter(e => !toRepoint.some(r => r.id === e.id)).map(e => e.id)

  // Orphan handling: incorrect station no longer referenced anywhere.
  let orphan: { id: string; callsign: string } | null = null
  let orphanDeleted = false
  const { count: refsLeft } = await db
    .from('mcinares_log_entries')
    .select('id', { count: 'exact', head: true })
    .eq('station_id', incorrect.id)

  if ((refsLeft || 0) === 0 && incorrect.created_in_net_id) {
    if (specCase === 2 && effectiveScope === 'net') {
      // "It never happened": auto-created this net, fully repointed away.
      const { error: delError } = await db.from('mcinares_roster').delete().eq('id', incorrect.id)
      orphanDeleted = !delError
      if (!orphanDeleted) orphan = { id: incorrect.id, callsign: incorrect.callsign }
    } else {
      orphan = { id: incorrect.id, callsign: incorrect.callsign }
    }
  }

  return NextResponse.json({
    ok: true,
    case: specCase,
    renamed: false,
    repointed: toRepoint.length,
    station_id: targetId,
    callsign: targetCs,
    orphan,
    orphan_deleted: orphanDeleted,
    remaining_entry_ids: remaining,
  })
}

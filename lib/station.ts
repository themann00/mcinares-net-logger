import type { SupabaseClient } from '@supabase/supabase-js'

export interface ResolvedStation {
  id: string
  callsign: string
  created: boolean
}

/**
 * Resolve a typed callsign to a roster station, creating the roster entry if
 * it does not exist (case-insensitive match, normalized to uppercase).
 * New entries are stamped with created_in_net_id so the edit flow can tell
 * "new this net" stations from imported or long-standing ones.
 * Existing entries get null name fields filled from the provided names.
 */
export async function resolveStation(
  db: SupabaseClient,
  callsign: string,
  opts: { netId?: string; firstName?: string | null; lastName?: string | null } = {}
): Promise<ResolvedStation> {
  const cs = callsign.toUpperCase().trim()
  if (!cs) throw new Error('callsign is required')

  const { data: existing, error: selectError } = await db
    .from('mcinares_roster')
    .select('id, callsign, first_name, last_name')
    .ilike('callsign', cs)
    .maybeSingle()

  if (selectError) throw new Error(selectError.message)

  if (existing) {
    const update: Record<string, unknown> = {}
    if (opts.firstName && !existing.first_name) update.first_name = opts.firstName
    if (opts.lastName && !existing.last_name) update.last_name = opts.lastName
    if (Object.keys(update).length > 0) {
      await db.from('mcinares_roster').update(update).eq('id', existing.id)
    }
    return { id: existing.id, callsign: existing.callsign, created: false }
  }

  const { data: inserted, error: insertError } = await db
    .from('mcinares_roster')
    .insert({
      callsign: cs,
      first_name: opts.firstName || null,
      last_name: opts.lastName || null,
      created_in_net_id: opts.netId || null,
    })
    .select('id, callsign')
    .single()

  if (insertError) {
    // unique race: another request created the row between select and insert
    if (insertError.code === '23505') {
      const { data: raced, error: racedError } = await db
        .from('mcinares_roster')
        .select('id, callsign')
        .ilike('callsign', cs)
        .single()
      if (racedError) throw new Error(racedError.message)
      return { id: raced.id, callsign: raced.callsign, created: false }
    }
    throw new Error(insertError.message)
  }

  return { id: inserted.id, callsign: inserted.callsign, created: true }
}

/** Replace a callsign inside cached log content, word-boundary safe. */
export function replaceCallsign(content: string, oldCs: string, newCs: string): string {
  const escaped = oldCs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return content.replace(new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, 'gi'), `$1${newCs}`)
}

/** Render the display line for a check-in entry from station + per-net facts. */
export function buildCheckinContent(
  callsign: string,
  meta: {
    station_type?: string | null
    location?: string | null
    quadrant?: string | null
    has_traffic?: boolean
    has_announcements?: boolean
  }
): string {
  const parts: string[] = [`${callsign} checked in`]
  if (meta.station_type) parts.push(`(${meta.station_type})`)
  if (meta.location) parts.push(`@ ${meta.location}`)
  if (meta.quadrant) parts.push(`[${meta.quadrant}]`)
  if (meta.has_traffic) parts.push('— has traffic')
  if (meta.has_announcements) parts.push('— has announcement')
  return parts.join(' ')
}

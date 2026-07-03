import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSirenId } from '@/lib/sirenLocations'

/** Row shape of mcinares_sirens. */
export interface SirenRecord {
  id: string
  name: string
  location: string | null
  lat: number | null
  lng: number | null
  created_at: string
}

/**
 * Rewrite every stored reference to a siren name (status history rows, report
 * metadata siren_number, check-in metadata siren_numbers arrays) to a new
 * name. Matches raw and zero-padded forms case-insensitively, since log
 * metadata stores operator keystrokes. Returns the number of rows touched.
 */
export async function renameSirenRefs(db: SupabaseClient, oldName: string, newName: string): Promise<number> {
  const matches = (v: unknown) =>
    typeof v === 'string' &&
    (v.toUpperCase() === oldName.toUpperCase() || normalizeSirenId(v).toUpperCase() === oldName.toUpperCase())
  let touched = 0

  const { data: statusRows } = await db
    .from('mcinares_siren_status')
    .select('id, siren_number')
  for (const row of statusRows || []) {
    if (matches(row.siren_number)) {
      await db.from('mcinares_siren_status').update({ siren_number: newName }).eq('id', row.id)
      touched++
    }
  }

  // Log entries: report metadata.siren_number and check-in siren_numbers.
  // Fetched broadly and filtered in JS — the variants ('12' vs '012') make a
  // pure SQL match unreliable, and the table is small.
  const [{ data: withSingle }, { data: withArray }] = await Promise.all([
    db.from('mcinares_log_entries').select('id, metadata').not('metadata->>siren_number', 'is', null),
    db.from('mcinares_log_entries').select('id, metadata').not('metadata->siren_numbers', 'is', null),
  ])
  const entryMap = new Map<string, { id: string; metadata: unknown }>()
  for (const e of [...(withSingle || []), ...(withArray || [])]) entryMap.set(e.id, e)
  for (const e of entryMap.values()) {
    const meta = (e.metadata as Record<string, unknown> | null) || {}
    let changed = false
    if (matches(meta.siren_number)) {
      meta.siren_number = newName
      changed = true
    }
    if (Array.isArray(meta.siren_numbers) && meta.siren_numbers.some(matches)) {
      meta.siren_numbers = meta.siren_numbers.map(v => (matches(v) ? newName : v))
      changed = true
    }
    if (changed) {
      await db.from('mcinares_log_entries').update({ metadata: meta }).eq('id', e.id)
      touched++
    }
  }

  return touched
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { renameSirenRefs } from '@/lib/sirenDb'

/**
 * Merge one siren record into another. The kept siren's data is untouched;
 * every stored reference to the merged siren (status history, log metadata)
 * is renamed to the kept siren, then the merged row is deleted.
 */
export async function POST(request: NextRequest) {
  const { keep_id, merge_id } = await request.json() as { keep_id: string; merge_id: string }

  if (!keep_id || !merge_id) {
    return NextResponse.json({ error: 'keep_id and merge_id are required' }, { status: 400 })
  }
  if (keep_id === merge_id) {
    return NextResponse.json({ error: 'cannot merge a siren into itself' }, { status: 400 })
  }

  const db = getSupabase()
  const [{ data: keep }, { data: merge }] = await Promise.all([
    db.from('mcinares_sirens').select('*').eq('id', keep_id).single(),
    db.from('mcinares_sirens').select('*').eq('id', merge_id).single(),
  ])
  if (!keep || !merge) return NextResponse.json({ error: 'siren not found' }, { status: 404 })

  const touched = await renameSirenRefs(db, merge.name, keep.name)

  const { error: delError } = await db.from('mcinares_sirens').delete().eq('id', merge_id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  return NextResponse.json({ ok: true, kept: keep, removed: merge.name, records_updated: touched })
}

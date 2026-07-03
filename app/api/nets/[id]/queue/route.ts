import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

/**
 * Persisted check-in queue for a net. The payload is the client-side
 * QueuedCheckin object minus its id (the row UUID is the item id), so a page
 * refresh or a second device sees the same uncommitted queue. Rows are
 * deleted when the queue is committed to the log.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await getSupabase()
    .from('mcinares_checkin_queue')
    .select('*')
    .eq('net_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload } = await request.json() as { payload: Record<string, unknown> }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('mcinares_checkin_queue')
    .insert({ net_id: id, payload })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { item_id, payload } = await request.json() as { item_id: string; payload: Record<string, unknown> }

  if (!item_id || !payload) {
    return NextResponse.json({ error: 'item_id and payload are required' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('mcinares_checkin_queue')
    .update({ payload })
    .eq('id', item_id)
    .eq('net_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { item_id, all } = await request.json() as { item_id?: string; all?: boolean }

  if (!item_id && !all) {
    return NextResponse.json({ error: 'item_id or all is required' }, { status: 400 })
  }

  let query = getSupabase().from('mcinares_checkin_queue').delete().eq('net_id', id)
  if (item_id) query = query.eq('id', item_id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await getSupabase().from('mcinares_nets').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const { data, error } = await getSupabase()
    .from('mcinares_nets')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getSupabase()

  const { data: net } = await db
    .from('mcinares_nets')
    .select('testing')
    .eq('id', id)
    .maybeSingle()

  await db.from('mcinares_log_entries').delete().eq('net_id', id)

  // Testing nets are ephemeral: drop any roster rows they created, as long as
  // no other net's log entries still reference them. Done before deleting the
  // net so created_in_net_id still points here. The main check-in path already
  // avoids creating these in testing nets; this also catches station-edit.
  if (net?.testing) {
    const { data: created } = await db
      .from('mcinares_roster')
      .select('id')
      .eq('created_in_net_id', id)
    for (const row of created || []) {
      const { count } = await db
        .from('mcinares_log_entries')
        .select('id', { count: 'exact', head: true })
        .eq('station_id', row.id)
      if (!count) await db.from('mcinares_roster').delete().eq('id', row.id)
    }
  }

  const { error } = await db.from('mcinares_nets').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { NetType } from '@/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { type, net_controller } = body as { type: NetType; net_controller: string }

  if (!type || !net_controller) {
    return NextResponse.json({ error: 'type and net_controller are required' }, { status: 400 })
  }

  const { data: net, error: netError } = await getSupabase()
    .from('mcinares_nets')
    .insert({ type, net_controller })
    .select()
    .single()

  if (netError) {
    console.error('Supabase insert mcinares_nets failed:', netError)
    return NextResponse.json({ error: netError.message }, { status: 500 })
  }

  await getSupabase().from('mcinares_log_entries').insert({
    net_id: net.id,
    entry_type: 'net_open',
    content: `Net opened by ${net_controller}`,
  })

  return NextResponse.json(net, { status: 201 })
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from('mcinares_nets')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

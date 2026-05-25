import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { LogEntryType } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('MCINARES-log_entries')
    .select('*')
    .eq('net_id', id)
    .order('timestamp', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { entry_type, content, station_id } = body as {
    entry_type: LogEntryType
    content: string
    station_id?: string
  }

  if (!entry_type || !content) {
    return NextResponse.json({ error: 'entry_type and content are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('MCINARES-log_entries')
    .insert({ net_id: id, entry_type, content, station_id: station_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

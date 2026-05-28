import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import type { LogEntryType } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .select('*')
    .eq('net_id', id)
    .order('timestamp', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { entry_type, content, timestamp, metadata } = body as {
    entry_type: LogEntryType
    content: string
    timestamp?: string
    metadata?: Record<string, unknown>
  }

  if (!entry_type || !content) {
    return NextResponse.json({ error: 'entry_type and content are required' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = { net_id: id, entry_type, content }
  if (timestamp) insertData.timestamp = timestamp
  if (metadata) insertData.metadata = metadata

  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { entry_id, content, metadata } = await request.json() as {
    entry_id: string
    content?: string
    metadata?: Record<string, unknown>
  }

  if (!entry_id) {
    return NextResponse.json({ error: 'entry_id is required' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (content !== undefined) update.content = content.trim()
  if (metadata !== undefined) update.metadata = metadata

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('mcinares_log_entries')
    .update(update)
    .eq('id', entry_id)
    .eq('net_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { entry_id } = await request.json() as { entry_id: string }

  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 })

  const { error } = await getSupabase()
    .from('mcinares_log_entries')
    .delete()
    .eq('id', entry_id)
    .eq('net_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

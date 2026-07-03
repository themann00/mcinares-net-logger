import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { normalizeSirenId } from '@/lib/sirenLocations'
import { renameSirenRefs } from '@/lib/sirenDb'

export async function GET() {
  const { data, error } = await getSupabase()
    .from('mcinares_sirens')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { name, location, lat, lng } = await request.json() as {
    name: string; location?: string; lat?: number; lng?: number
  }

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const canonical = normalizeSirenId(name)

  const db = getSupabase()
  // Idempotent create: an existing siren (case-insensitive) is returned as-is.
  const { data: existing } = await db
    .from('mcinares_sirens')
    .select('*')
    .ilike('name', canonical)
    .maybeSingle()
  if (existing) return NextResponse.json(existing)

  const { data, error } = await db
    .from('mcinares_sirens')
    .insert({ name: canonical, location: location?.trim() || null, lat: lat ?? null, lng: lng ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { id, name, location, lat, lng } = await request.json() as {
    id: string; name?: string; location?: string | null; lat?: number | null; lng?: number | null
  }

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = getSupabase()
  const { data: current, error: curError } = await db
    .from('mcinares_sirens')
    .select('*')
    .eq('id', id)
    .single()
  if (curError || !current) return NextResponse.json({ error: 'siren not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  let renamedFrom: string | null = null

  if (name !== undefined) {
    const newName = normalizeSirenId(name)
    if (!newName) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    if (newName.toUpperCase() !== current.name.toUpperCase()) {
      const { data: conflict } = await db
        .from('mcinares_sirens')
        .select('id, name')
        .ilike('name', newName)
        .neq('id', id)
        .maybeSingle()
      if (conflict) {
        return NextResponse.json({ error: 'siren name already exists — merge instead', conflict }, { status: 409 })
      }
      renamedFrom = current.name
    }
    update.name = newName
  }
  if (location !== undefined) update.location = location?.trim() || null
  if (lat !== undefined) update.lat = lat
  if (lng !== undefined) update.lng = lng

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('mcinares_sirens')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Renames carry the check history and log references along.
  if (renamedFrom) await renameSirenRefs(db, renamedFrom, data.name)

  return NextResponse.json(data)
}

'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _tried = false

/**
 * Browser-side Supabase client (anon key) used only for realtime
 * subscriptions. RLS limits anon to SELECT on the net-sync tables; all writes
 * go through the API routes with the service role key. Returns null when the
 * public env vars are absent (e.g. local dev with placeholder keys) so the
 * app degrades to manual-refresh behavior.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (_tried) return _client
  _tried = true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || key.includes('placeholder')) return null
  _client = createClient(url, key, {
    auth: { persistSession: false },
  })
  return _client
}

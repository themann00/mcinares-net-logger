import { normalizeSirenId } from '@/lib/sirenLocations'

/** Client-side shape of a mcinares_sirens row. */
export interface SirenListItem {
  id: string
  name: string
  location: string | null
  lat: number | null
  lng: number | null
}

/** True when the typed value matches a registered siren (raw or zero-padded). */
export function isKnownSiren(value: string, sirens: SirenListItem[]): boolean {
  const raw = value.trim().toUpperCase()
  if (!raw) return true
  const norm = normalizeSirenId(value).toUpperCase()
  return sirens.some(s => {
    const n = s.name.toUpperCase()
    return n === raw || n === norm
  })
}

/** Typed values not in the registry (deduped, blanks skipped). */
export function unknownSirens(values: string[], sirens: SirenListItem[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t || isKnownSiren(t, sirens)) continue
    const key = normalizeSirenId(t).toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** Registry name an unrecognized siren number is stored under. */
export function unkName(typed: string): string {
  return `UNK:${normalizeSirenId(typed)}`
}

/** Map entered values: known ones pass through, unknown ones become UNK:###. */
export function toRegisteredNames(values: string[], sirens: SirenListItem[]): string[] {
  return values.map(v => {
    const t = v.trim()
    if (!t || isKnownSiren(t, sirens)) return t
    return unkName(t)
  })
}

/** Create UNK:### registry rows for confirmed unknown sirens (idempotent). */
export async function registerUnknownSirens(typedValues: string[]): Promise<void> {
  for (const t of typedValues) {
    await fetch('/api/sirens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: unkName(t) }),
    })
  }
}

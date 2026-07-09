import type { LogEntry, DerivedStation, CheckinMetadata, StationType, Quadrant } from '@/types'

export function deriveStations(entries: LogEntry[]): DerivedStation[] {
  const stationMap = new Map<string, DerivedStation>()

  // Identity comes from the roster join (station) when present; metadata and
  // content parsing remain as fallback for legacy entries without station_id.
  function entryKey(e: LogEntry, callsign: string | null): string | null {
    return e.station_id || callsign
  }

  for (const e of entries) {
    if (e.entry_type === 'checkin' || e.entry_type === 'late_checkin') {
      const meta = e.metadata as CheckinMetadata | null
      const callsign = e.station?.callsign || meta?.callsign || parseCallsignFromContent(e.content)
      if (!callsign) continue
      const key = entryKey(e, callsign)!
      if (stationMap.has(key)) continue

      stationMap.set(key, {
        station_id: e.station_id || null,
        callsign,
        first_name: e.station?.first_name ?? meta?.first_name ?? null,
        last_name: e.station?.last_name ?? meta?.last_name ?? null,
        station_type: (meta?.station_type as StationType) || parseTypeFromContent(e.content),
        location: meta?.location || null,
        quadrant: (meta?.quadrant as Quadrant) || null,
        siren_numbers: meta?.siren_numbers || [],
        has_traffic: meta?.has_traffic || false,
        has_announcements: meta?.has_announcements || false,
        checked_in_at: e.timestamp,
        log_entry_id: e.id,
      })
    }

    if (e.entry_type === 'station_moved') {
      const station = findStation(stationMap, e)
      if (station) {
        const meta = e.metadata as Record<string, unknown> | null
        if (meta?.location) station.location = meta.location as string
        if (meta?.quadrant) station.quadrant = meta.quadrant as Quadrant
        if (meta?.siren_numbers) station.siren_numbers = meta.siren_numbers as string[]
      }
    }

    if (e.entry_type === 'circle_back') {
      const station = findStation(stationMap, e)
      if (station) {
        const meta = e.metadata as Record<string, unknown> | null
        if (meta?.station_type) station.station_type = meta.station_type as StationType
        if (meta?.location) station.location = meta.location as string
        if (meta?.quadrant) station.quadrant = meta.quadrant as Quadrant
        if (meta?.siren_numbers) station.siren_numbers = meta.siren_numbers as string[]
      }
    }
  }

  return Array.from(stationMap.values())

  // Match by UUID key first, then by callsign for mixed legacy/new data
  // (e.g. an old station_moved without station_id targeting a new checkin).
  function findStation(map: Map<string, DerivedStation>, e: LogEntry): DerivedStation | undefined {
    const meta = e.metadata as Record<string, unknown> | null
    const callsign = e.station?.callsign || (meta?.callsign as string) || parseCallsignFromContent(e.content)
    const key = entryKey(e, callsign)
    const direct = key ? map.get(key) : undefined
    if (direct) return direct
    if (!callsign) return undefined
    const cs = callsign.toUpperCase()
    for (const s of map.values()) {
      if (s.callsign.toUpperCase() === cs) return s
    }
    return undefined
  }
}

function parseCallsignFromContent(content: string): string | null {
  const m = content.match(/^(?:MANUAL:\s*)?([A-Z0-9/]+)\s/)
  return m ? m[1] : null
}

function parseTypeFromContent(content: string): StationType | null {
  if (content.includes('(base)')) return 'base'
  if (content.includes('(mobile)')) return 'mobile'
  return null
}

export function deriveNetContext(entries: LogEntry[], net: { net_controller: string }): {
  net_controller: string
  alt_net_controller: string | null
  liaison: string | null
  nts_liaison: string | null
  oes_station: string | null
  weather_status: 'approaching' | 'imminent' | null
  nws_bulletin: string | null
  started_at: string | null
  closed_at: string | null
} {
  const openEntry = entries.find(e => e.entry_type === 'net_open')
  const closeEntry = [...entries].reverse().find(e => e.entry_type === 'net_close')
  const altNcEntry = entries.find(e => e.entry_type === 'alt_nc')
  const liaisonEntry = entries.find(e => e.entry_type === 'liaison')

  const altNc = altNcEntry
    ? (altNcEntry.metadata as Record<string, unknown>)?.callsign as string || altNcEntry.content.replace(/^Alternate net control:\s*/i, '').trim()
    : null
  const liaison = liaisonEntry
    ? (liaisonEntry.metadata as Record<string, unknown>)?.callsign as string || liaisonEntry.content.replace(/^(?:NTS )?Liaison(?: station)?:\s*/i, '').trim()
    : null

  // ARES logs its two preamble volunteer roles as separate liaison entries,
  // told apart by content prefix.
  const liaisonByPrefix = (prefix: RegExp): string | null => {
    const e = entries.find(x => x.entry_type === 'liaison' && prefix.test(x.content))
    return e ? e.content.replace(prefix, '').trim() || null : null
  }
  const ntsLiaison = liaisonByPrefix(/^NTS Liaison:\s*/i)
  const oesStation = liaisonByPrefix(/^OES Station:\s*/i)

  return {
    net_controller: net.net_controller,
    alt_net_controller: altNc,
    liaison,
    nts_liaison: ntsLiaison,
    oes_station: oesStation,
    weather_status: null,
    nws_bulletin: null,
    started_at: openEntry?.timestamp || null,
    closed_at: closeEntry?.timestamp || null,
  }
}

export function getSuffix(cs: string): string {
  const m = cs.match(/\d([A-Z]+)$/)
  return m ? m[1] : cs
}

import type { LogEntry, DerivedStation, CheckinMetadata, StationType, Quadrant } from '@/types'

export function deriveStations(entries: LogEntry[]): DerivedStation[] {
  const stationMap = new Map<string, DerivedStation>()

  for (const e of entries) {
    if (e.entry_type === 'checkin' || e.entry_type === 'late_checkin') {
      const meta = e.metadata as CheckinMetadata | null
      const callsign = meta?.callsign || parseCallsignFromContent(e.content)
      if (!callsign) continue
      if (stationMap.has(callsign)) continue

      stationMap.set(callsign, {
        callsign,
        first_name: meta?.first_name || null,
        last_name: meta?.last_name || null,
        station_type: (meta?.station_type as StationType) || parseTypeFromContent(e.content),
        location: meta?.location || null,
        quadrant: (meta?.quadrant as Quadrant) || null,
        has_traffic: meta?.has_traffic || false,
        has_announcements: meta?.has_announcements || false,
        checked_in_at: e.timestamp,
        log_entry_id: e.id,
      })
    }

    if (e.entry_type === 'station_moved') {
      const meta = e.metadata as Record<string, unknown> | null
      const callsign = (meta?.callsign as string) || parseCallsignFromContent(e.content)
      if (callsign && stationMap.has(callsign)) {
        const station = stationMap.get(callsign)!
        if (meta?.location) station.location = meta.location as string
        if (meta?.quadrant) station.quadrant = meta.quadrant as Quadrant
      }
    }

    if (e.entry_type === 'circle_back') {
      const meta = e.metadata as Record<string, unknown> | null
      const callsign = (meta?.callsign as string) || parseCallsignFromContent(e.content)
      if (callsign && stationMap.has(callsign)) {
        const station = stationMap.get(callsign)!
        if (meta?.station_type) station.station_type = meta.station_type as StationType
        if (meta?.location) station.location = meta.location as string
        if (meta?.quadrant) station.quadrant = meta.quadrant as Quadrant
      }
    }
  }

  return Array.from(stationMap.values())
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

  return {
    net_controller: net.net_controller,
    alt_net_controller: altNc,
    liaison,
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

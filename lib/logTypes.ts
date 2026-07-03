import type { LogEntry, LogEntryType, NetType } from '@/types'

/** Display metadata for every log entry type (shared by feeds and modals). */
export const LOG_TYPE_META: Record<LogEntryType, { label: string; color: string }> = {
  net_open: { label: 'NET OPEN', color: 'text-green-400' },
  checkin: { label: 'CHECK-IN', color: 'text-blue-400' },
  report: { label: 'REPORT', color: 'text-orange-400' },
  traffic: { label: 'TRAFFIC', color: 'text-yellow-400' },
  announcement: { label: 'ANNOUNCEMENT', color: 'text-teal-400' },
  liaison: { label: 'LIAISON', color: 'text-purple-400' },
  alt_nc: { label: 'ALT NC', color: 'text-purple-400' },
  continuity: { label: 'CONTINUITY', color: 'text-cyan-400' },
  circle_back: { label: 'UPDATE', color: 'text-amber-400' },
  late_checkin: { label: 'LATE CHECK-IN', color: 'text-blue-300' },
  station_moved: { label: 'MOVED', color: 'text-orange-300' },
  net_close: { label: 'NET CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-fg-3' },
}

/**
 * Entry types that make sense for each net type. ARES nets carry traffic,
 * announcements, and liaison roles; Skywarn and Siren nets take reports and
 * circle-back updates; only Skywarn/Siren run continuity announcements.
 */
export const LOG_TYPES_BY_NET: Record<NetType, LogEntryType[]> = {
  ares: ['net_open', 'checkin', 'late_checkin', 'announcement', 'traffic', 'report', 'liaison', 'alt_nc', 'station_moved', 'net_close', 'note'],
  skywarn: ['net_open', 'checkin', 'late_checkin', 'report', 'circle_back', 'liaison', 'continuity', 'station_moved', 'net_close', 'note'],
  siren: ['net_open', 'checkin', 'late_checkin', 'report', 'circle_back', 'continuity', 'station_moved', 'net_close', 'note'],
}

/** Type choices for a net's add/edit dialogs; `current` is kept even if off-list. */
export function typesForNet(netType?: NetType | null, current?: LogEntryType): LogEntryType[] {
  const base = netType ? LOG_TYPES_BY_NET[netType] : (Object.keys(LOG_TYPE_META) as LogEntryType[])
  if (current && !base.includes(current)) return [...base, current]
  return base
}

/**
 * Sanity warnings for an entry being added or edited. Nets normally have one
 * NET OPEN that is first by timestamp and one NET CLOSE that is last; anything
 * else gets a warning the operator can override.
 */
export function openCloseWarnings(
  entries: Pick<LogEntry, 'id' | 'entry_type' | 'timestamp'>[],
  candidate: { id?: string; entry_type: LogEntryType; timestamp: string },
): string[] {
  const warnings: string[] = []
  const others = entries.filter(e => e.id !== candidate.id)
  const t = new Date(candidate.timestamp).getTime()

  if (candidate.entry_type === 'net_open') {
    if (others.some(e => e.entry_type === 'net_open')) {
      warnings.push('This net already has a NET OPEN entry. Nets normally have exactly one.')
    }
    if (others.some(e => new Date(e.timestamp).getTime() < t)) {
      warnings.push('NET OPEN would not be the first entry by timestamp.')
    }
  } else if (candidate.entry_type === 'net_close') {
    if (others.some(e => e.entry_type === 'net_close')) {
      warnings.push('This net already has a NET CLOSE entry. Nets normally have exactly one.')
    }
    if (others.some(e => new Date(e.timestamp).getTime() > t)) {
      warnings.push('NET CLOSE would not be the last entry by timestamp.')
    }
  } else {
    const open = others.find(e => e.entry_type === 'net_open')
    if (open && t < new Date(open.timestamp).getTime()) {
      warnings.push('This entry would be timestamped before the NET OPEN.')
    }
    const lastClose = [...others].reverse().find(e => e.entry_type === 'net_close')
    if (lastClose && t > new Date(lastClose.timestamp).getTime()) {
      warnings.push('This entry would be timestamped after the NET CLOSE.')
    }
  }

  return warnings
}

'use client'

import { format } from 'date-fns'
import type { LogEntry, LogEntryType } from '@/types'

const TYPE_CONFIG: Record<LogEntryType, { label: string; color: string }> = {
  net_open: { label: 'OPEN', color: 'text-green-400' },
  checkin: { label: 'CHECK-IN', color: 'text-blue-400' },
  report: { label: 'REPORT', color: 'text-orange-400' },
  traffic: { label: 'TRAFFIC', color: 'text-yellow-400' },
  announcement: { label: 'ANN.', color: 'text-teal-400' },
  liaison: { label: 'LIAISON', color: 'text-purple-400' },
  alt_nc: { label: 'ALT NC', color: 'text-purple-400' },
  continuity: { label: 'CONT.', color: 'text-cyan-400' },
  circle_back: { label: 'UPDATE', color: 'text-amber-400' },
  late_checkin: { label: 'LATE', color: 'text-blue-300' },
  net_close: { label: 'CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-gray-400' },
}

interface LogFeedProps {
  entries: LogEntry[]
}

export function LogFeed({ entries }: LogFeedProps) {
  return (
    <div className="space-y-1">
      {entries.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">No log entries yet.</p>
      )}
      {entries.map(entry => {
        const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }
        return (
          <div
            key={entry.id}
            className="flex gap-2 text-sm border-b border-gray-800 pb-1 last:border-0"
          >
            <span className="text-gray-500 font-mono text-xs flex-shrink-0 pt-0.5">
              {format(new Date(entry.timestamp), 'HH:mm:ss')}
            </span>
            <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-gray-300 break-all">{entry.content}</span>
          </div>
        )
      })}
    </div>
  )
}

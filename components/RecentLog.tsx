'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { EditLogModal } from '@/components/EditLogModal'
import type { LogEntry, LogEntryType, Station } from '@/types'

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

interface RecentLogProps {
  entries: LogEntry[]
  netId: string
  onUpdate: () => void
  limit?: number
  reversed?: boolean
  stations?: Station[]
}

export function RecentLog({ entries, netId, onUpdate, limit = 10, reversed = false, stations = [] }: RecentLogProps) {
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null)

  const sliced = entries.slice(-limit)
  const recent = reversed ? [...sliced].reverse() : sliced

  if (recent.length === 0) return null

  return (
    <>
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-3">
        <h3 className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Recent Log</h3>
        <div className="space-y-0.5">
          {recent.map(entry => {
            const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }

            return (
              <div
                key={entry.id}
                onClick={() => setEditingEntry(entry)}
                className="flex gap-2 text-sm py-1 border-b border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-gray-600 font-mono text-xs flex-shrink-0 pt-0.5">
                  {format(new Date(entry.timestamp), 'HH:mm')}
                </span>
                <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-gray-400 break-all flex-1">
                  {entry.content}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {editingEntry && (
        <EditLogModal
          entry={editingEntry}
          station={stations.find(s => s.id === editingEntry.station_id) || null}
          netId={netId}
          onSave={() => {
            setEditingEntry(null)
            onUpdate()
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </>
  )
}

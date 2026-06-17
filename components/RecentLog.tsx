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
  station_moved: { label: 'MOVED', color: 'text-orange-300' },
  net_close: { label: 'CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-fg-3' },
}

interface RecentLogProps {
  entries: LogEntry[]
  netId: string
  onUpdate: () => void
  limit?: number
  reversed?: boolean
  stations?: Station[]
  roster?: { callsign: string; first_name?: string | null; last_name?: string | null; email?: string | null }[]
}

export function RecentLog({ entries, netId, onUpdate, limit = 10, reversed = false, stations = [], roster = [] }: RecentLogProps) {
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  const sliced = entries.slice(-limit)
  const recent = reversed ? [...sliced].reverse() : sliced

  if (recent.length === 0) return null

  return (
    <>
      <div className="bg-surface-1/50 rounded-xl border border-surface-2 p-3">
        <h3 className="text-fg-4 text-xs font-medium mb-2 uppercase tracking-wider">Recent Log</h3>
        {highlighted.size > 0 && (
          <div className="flex items-center justify-between text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1 mb-2">
            <span>{highlighted.size} highlighted entr{highlighted.size === 1 ? 'y' : 'ies'} to review</span>
            <button onClick={() => setHighlighted(new Set())} className="text-amber-400 hover:text-amber-200 underline">
              Clear
            </button>
          </div>
        )}
        <div className="space-y-0.5">
          {recent.map(entry => {
            const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-fg-3' }
            const isHighlighted = highlighted.has(entry.id)

            return (
              <div
                key={entry.id}
                onClick={() => setEditingEntry(entry)}
                className={`flex gap-2 text-sm py-1 border-b border-surface-2/50 last:border-0 cursor-pointer hover:bg-surface-2/50 rounded px-1 -mx-1 transition-colors ${
                  isHighlighted ? 'bg-amber-950/40 ring-1 ring-amber-700' : ''
                }`}
              >
                <span className="text-fg-5 font-mono text-xs flex-shrink-0 pt-0.5">
                  {format(new Date(entry.timestamp), 'HH:mm')}
                </span>
                <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-fg-3 break-all flex-1">
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
          station={(() => {
            if (editingEntry.station_id) {
              const byId = stations.find(s => s.station_id === editingEntry.station_id)
              if (byId) return byId
            }
            const meta = editingEntry.metadata as Record<string, unknown> | null
            const cs = (meta?.callsign as string) || editingEntry.content.match(/^(?:MANUAL:\s*)?([A-Z0-9/]+)[\s:]/)?.[1]
            return cs ? stations.find(s => s.callsign === cs) || null : null
          })()}
          netId={netId}
          onSave={() => {
            setHighlighted(prev => {
              if (!prev.has(editingEntry.id)) return prev
              const next = new Set(prev)
              next.delete(editingEntry.id)
              return next
            })
            setEditingEntry(null)
            onUpdate()
          }}
          onClose={() => setEditingEntry(null)}
          stations={stations}
          roster={roster}
          onHighlight={ids => setHighlighted(prev => new Set([...prev, ...ids]))}
        />
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Pencil, Check, X } from 'lucide-react'
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

interface RecentLogProps {
  entries: LogEntry[]
  netId: string
  onUpdate: () => void
  limit?: number
  reversed?: boolean
}

export function RecentLog({ entries, netId, onUpdate, limit = 10, reversed = false }: RecentLogProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const sliced = entries.slice(-limit)
  const recent = reversed ? [...sliced].reverse() : sliced

  async function handleSave(entryId: string) {
    if (!editContent.trim()) return
    setSaving(true)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, content: editContent }),
    })
    setSaving(false)
    setEditingId(null)
    onUpdate()
  }

  function startEdit(entry: LogEntry) {
    setEditingId(entry.id)
    setEditContent(entry.content)
  }

  if (recent.length === 0) return null

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-3">
      <h3 className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wider">Recent Log</h3>
      <div className="space-y-0.5">
        {recent.map(entry => {
          const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }
          const isEditing = editingId === entry.id

          return (
            <div
              key={entry.id}
              className="group flex gap-2 text-sm py-1 border-b border-gray-800/50 last:border-0"
            >
              <span className="text-gray-600 font-mono text-xs flex-shrink-0 pt-0.5">
                {format(new Date(entry.timestamp), 'HH:mm')}
              </span>
              <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                {cfg.label}
              </span>

              {isEditing ? (
                <div className="flex-1 flex gap-1">
                  <input
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave(entry.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white text-sm"
                    autoFocus
                    disabled={saving}
                  />
                  <button
                    onClick={() => handleSave(entry.id)}
                    disabled={saving}
                    className="text-green-400 hover:text-green-300 p-0.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-500 hover:text-gray-300 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span
                  className="text-gray-400 break-all flex-1 cursor-pointer hover:text-gray-200 transition-colors"
                  onClick={() => startEdit(entry)}
                  title="Click to edit"
                >
                  {entry.content}
                </span>
              )}

              {!isEditing && (
                <button
                  onClick={() => startEdit(entry)}
                  className="text-gray-700 group-hover:text-gray-500 hover:!text-gray-300 p-0.5 flex-shrink-0 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

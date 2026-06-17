'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { Station, LogEntry } from '@/types'

interface TrafficListProps {
  stations: Station[]
  logEntries: LogEntry[]
  netId: string
  onUpdate: () => void
}

interface EditState {
  callsign: string
  type: 'traffic' | 'announcement'
  content: string
}

export function TrafficList({ stations, logEntries, netId, onUpdate }: TrafficListProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [handled, setHandled] = useState<Record<string, boolean>>({})
  const [summaries, setSummaries] = useState<Record<string, string>>({})

  const relevant = stations
    .filter(s => s.has_traffic || s.has_announcements)
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())

  function getKey(callsign: string, type: string) {
    return `${callsign}:${type}`
  }

  function findEntryByCallsign(callsign: string, type: string) {
    return logEntries.find(
      e => e.entry_type === type && e.content.startsWith(`${callsign}:`)
    )
  }

  function isHandled(callsign: string, type: string) {
    const key = getKey(callsign, type)
    if (handled[key] !== undefined) return handled[key]
    return !!findEntryByCallsign(callsign, type)
  }

  function getSummary(callsign: string, type: string) {
    const key = getKey(callsign, type)
    if (summaries[key] !== undefined) return summaries[key]
    const entry = findEntryByCallsign(callsign, type)
    return entry?.content || ''
  }

  function handleClick(station: Station, type: 'traffic' | 'announcement') {
    const key = getKey(station.callsign, type)
    if (isHandled(station.callsign, type)) {
      setHandled(prev => ({ ...prev, [key]: false }))
      return
    }
    const existing = getSummary(station.callsign, type)
    setEditState({
      callsign: station.callsign,
      type,
      content: existing || 'N/A',
    })
  }

  async function handleSave() {
    if (!editState) return
    setSaving(true)
    const key = getKey(editState.callsign, editState.type)
    const content = editState.content.trim() || 'N/A'

    const existing = findEntryByCallsign(editState.callsign, editState.type)

    if (existing) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: existing.id, content: `${editState.callsign}: ${content}` }),
      })
    } else {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: editState.type,
          content: `${editState.callsign}: ${content}`,
          metadata: { callsign: editState.callsign },
        }),
      })
    }

    setSummaries(prev => ({ ...prev, [key]: content }))
    setHandled(prev => ({ ...prev, [key]: true }))
    setSaving(false)
    setEditState(null)
    onUpdate()
  }

  if (relevant.length === 0) {
    return <p className="text-fg-4 text-sm text-center py-4">No stations with traffic or announcements.</p>
  }

  return (
    <>
      <div className="space-y-1">
        {relevant.map(station => {
          const items: { type: 'traffic' | 'announcement'; label: string }[] = []
          if (station.has_traffic) items.push({ type: 'traffic', label: 'Traffic' })
          if (station.has_announcements) items.push({ type: 'announcement', label: 'Announcement' })

          return (
            <div key={station.callsign} className="space-y-0.5">
              {items.map(item => {
                const done = isHandled(station.callsign, item.type)
                return (
                  <button
                    key={`${station.callsign}-${item.type}`}
                    onClick={() => handleClick(station, item.type)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      done
                        ? 'bg-surface-2/30 hover:bg-surface-2/50'
                        : 'bg-surface-2 hover:bg-surface-3'
                    }`}
                  >
                    <span className={`font-mono font-semibold text-sm ${done ? 'text-fg-5 line-through' : 'text-fg'}`}>
                      {station.callsign}
                    </span>
                    <Badge className={`text-xs ${
                      item.type === 'traffic'
                        ? done ? 'bg-yellow-900/50 text-yellow-700' : 'bg-yellow-700 text-white'
                        : done ? 'bg-teal-900/50 text-teal-700' : 'bg-teal-700 text-white'
                    }`}>
                      {item.label}
                    </Badge>
                    {done && (
                      <span className="text-fg-5 text-xs ml-auto truncate max-w-32">
                        {getSummary(station.callsign, item.type)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {editState && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-fg font-mono font-semibold">{editState.callsign}</span>
                <Badge className={editState.type === 'traffic' ? 'bg-yellow-700 text-white' : 'bg-teal-700 text-white'}>
                  {editState.type === 'traffic' ? 'Traffic' : 'Announcement'}
                </Badge>
              </div>
              <button onClick={() => setEditState(null)} className="text-fg-3 hover:text-fg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Summary</Label>
              <Textarea
                value={editState.content}
                onChange={e => setEditState(prev => prev ? { ...prev, content: e.target.value } : null)}
                className="bg-surface-2 border-surface-3 text-fg"
                rows={3}
                autoFocus
                onFocus={e => {
                  if (e.target.value === 'N/A') e.target.select()
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditState(null)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-700 hover:bg-blue-600"
              >
                {saving ? 'Saving...' : 'Save & Mark Handled'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

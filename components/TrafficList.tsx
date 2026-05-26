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
  stationId: string
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

  function getKey(stationId: string, type: string) {
    return `${stationId}:${type}`
  }

  function isHandled(stationId: string, type: string) {
    const key = getKey(stationId, type)
    if (handled[key] !== undefined) return handled[key]
    return logEntries.some(
      e => e.station_id === stationId && e.entry_type === type
    )
  }

  function getSummary(stationId: string, type: string) {
    const key = getKey(stationId, type)
    if (summaries[key] !== undefined) return summaries[key]
    const entry = logEntries.find(
      e => e.station_id === stationId && e.entry_type === type
    )
    return entry?.content || ''
  }

  function handleClick(station: Station, type: 'traffic' | 'announcement') {
    const key = getKey(station.id, type)
    if (isHandled(station.id, type)) {
      setHandled(prev => ({ ...prev, [key]: false }))
      return
    }
    const existing = getSummary(station.id, type)
    setEditState({
      stationId: station.id,
      callsign: station.callsign,
      type,
      content: existing || 'N/A',
    })
  }

  async function handleSave() {
    if (!editState) return
    setSaving(true)
    const key = getKey(editState.stationId, editState.type)
    const content = editState.content.trim() || 'N/A'

    const existing = logEntries.find(
      e => e.station_id === editState.stationId && e.entry_type === editState.type
    )

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
          station_id: editState.stationId,
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
    return <p className="text-gray-500 text-sm text-center py-4">No stations with traffic or announcements.</p>
  }

  return (
    <>
      <div className="space-y-1">
        {relevant.map(station => {
          const items: { type: 'traffic' | 'announcement'; label: string }[] = []
          if (station.has_traffic) items.push({ type: 'traffic', label: 'Traffic' })
          if (station.has_announcements) items.push({ type: 'announcement', label: 'Announcement' })

          return (
            <div key={station.id} className="space-y-0.5">
              {items.map(item => {
                const done = isHandled(station.id, item.type)
                return (
                  <button
                    key={`${station.id}-${item.type}`}
                    onClick={() => handleClick(station, item.type)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      done
                        ? 'bg-gray-800/30 hover:bg-gray-800/50'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <span className={`font-mono font-semibold text-sm ${done ? 'text-gray-600 line-through' : 'text-white'}`}>
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
                      <span className="text-gray-600 text-xs ml-auto truncate max-w-32">
                        {getSummary(station.id, item.type)}
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white font-mono font-semibold">{editState.callsign}</span>
                <Badge className={editState.type === 'traffic' ? 'bg-yellow-700 text-white' : 'bg-teal-700 text-white'}>
                  {editState.type === 'traffic' ? 'Traffic' : 'Announcement'}
                </Badge>
              </div>
              <button onClick={() => setEditState(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Summary</Label>
              <Textarea
                value={editState.content}
                onChange={e => setEditState(prev => prev ? { ...prev, content: e.target.value } : null)}
                className="bg-gray-800 border-gray-700 text-white"
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
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
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

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X, Check } from 'lucide-react'
import type { Station, LogEntry } from '@/types'

interface StationPassListProps {
  netId: string
  flag: 'traffic' | 'announcement'
  stations: Station[]
  logEntries: LogEntry[]
  onUpdate: () => void
}

interface DraftState {
  text: string
  cancelled: boolean
}

type Drafts = Record<string, DraftState>

// Everything durable derives from props each render: the flagged station list
// comes from current check-in data (so a station flagged late still appears)
// and logged status comes from the log entries themselves. Only unsaved
// drafts live in state, mirrored to sessionStorage so stepping to another
// section and back does not lose typed summaries.
export function StationPassList({ netId, flag, stations, logEntries, onUpdate }: StationPassListProps) {
  const storageKey = `net-${netId}-${flag}-drafts`

  const [drafts, setDrafts] = useState<Drafts>(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(window.sessionStorage.getItem(storageKey) || '{}') as Drafts
    } catch {
      return {}
    }
  })

  function updateDrafts(next: Drafts) {
    setDrafts(next)
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // storage full or unavailable — drafts just live in memory
    }
  }

  const flagged = stations
    .filter(s => (flag === 'traffic' ? s.has_traffic : s.has_announcements))
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())

  const loggedCallsigns = new Set(
    logEntries
      .filter(e => e.entry_type === flag && e.content.includes(':'))
      .map(e => e.content.split(':')[0].trim().toUpperCase())
  )

  const draftFor = (callsign: string): DraftState =>
    drafts[callsign] || { text: 'N/A', cancelled: false }

  async function save(station: Station) {
    const state = draftFor(station.callsign)
    if (!state.text.trim()) return

    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: flag,
        content: `${station.callsign}: ${state.text.trim()}`,
        callsign: station.callsign,
      }),
    })

    // The log entry is now the record; drop the draft.
    const next = { ...drafts }
    delete next[station.callsign]
    updateDrafts(next)
    onUpdate()
  }

  if (flagged.length === 0) return null

  const label = flag === 'traffic' ? 'Traffic' : 'Announcement'
  const buttonColor = flag === 'traffic' ? 'bg-yellow-700 hover:bg-yellow-600' : 'bg-teal-700 hover:bg-teal-600'

  return (
    <div className="space-y-3">
      <h4 className="text-fg-3 text-xs font-semibold uppercase tracking-wider">
        Stations with {label}s ({flagged.length})
      </h4>
      <div className="flex items-center gap-2 text-amber-400/80 text-sm bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
        <span>Enter a summary for each station (or leave as N/A) and click Log {label}, or it will not appear in the net logs.</span>
      </div>
      {flagged.map(station => {
        const saved = loggedCallsigns.has(station.callsign.toUpperCase())
        const state = draftFor(station.callsign)

        if (saved) {
          return (
            <div key={station.callsign} className="flex items-center gap-2 px-3 py-2 bg-green-950/30 rounded-lg">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="font-mono text-sm text-green-400 line-through">{station.callsign}</span>
              <span className="text-fg-4 text-xs">logged</span>
            </div>
          )
        }

        if (state.cancelled) {
          return (
            <div key={station.callsign} className="flex items-center gap-2 px-3 py-2 bg-surface-2/50 rounded-lg">
              <X className="w-4 h-4 text-fg-4 flex-shrink-0" />
              <span className="font-mono text-sm text-fg-4 line-through">{station.callsign}</span>
              <span className="text-fg-4 text-xs">no {flag}</span>
              <button
                onClick={() => updateDrafts({ ...drafts, [station.callsign]: { ...state, cancelled: false } })}
                className="text-blue-400 hover:text-blue-300 text-xs underline underline-offset-2 ml-auto"
              >
                Undo
              </button>
            </div>
          )
        }

        return (
          <div key={station.callsign} className="bg-surface-2 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-fg">{station.callsign}</span>
              <button
                onClick={() => updateDrafts({ ...drafts, [station.callsign]: { ...state, cancelled: true } })}
                className="text-fg-4 hover:text-red-400 text-xs flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                No {flag}
              </button>
            </div>
            <Textarea
              value={state.text}
              onChange={e => updateDrafts({ ...drafts, [station.callsign]: { ...state, text: e.target.value } })}
              placeholder={`Summarize ${flag}...`}
              onFocus={e => { if (e.target.value === 'N/A') e.target.select() }}
              className="bg-surface-1 border-surface-3 text-fg text-sm"
              rows={2}
            />
            <Button
              size="sm"
              onClick={() => save(station)}
              disabled={!state.text.trim()}
              className={`${buttonColor} text-xs`}
            >
              Log {label}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

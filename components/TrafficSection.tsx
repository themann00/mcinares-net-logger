'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Check, Plus } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import type { Station, LogEntry } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface TrafficSectionProps {
  stations: Station[]
  logEntries: LogEntry[]
  netId: string
  roster: RosterEntry[]
  onUpdate: () => void
}

interface TrafficState {
  text: string
  cancelled: boolean
  saved: boolean
}

export function TrafficSection({ stations, logEntries, netId, roster, onUpdate }: TrafficSectionProps) {
  const trafficStations = stations
    .filter(s => s.has_traffic)
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())

  const alreadyLogged = new Set(
    logEntries
      .filter(e => e.entry_type === 'traffic' && e.station_id)
      .map(e => e.station_id)
  )

  const [trafficState, setTrafficState] = useState<Record<string, TrafficState>>(() => {
    const initial: Record<string, TrafficState> = {}
    trafficStations.forEach(s => {
      initial[s.id] = { text: '', cancelled: false, saved: alreadyLogged.has(s.id) }
    })
    return initial
  })

  const [noteCallsign, setNoteCallsign] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<'traffic' | 'question' | 'comment' | 'note'>('traffic')
  const [noteSaving, setNoteSaving] = useState(false)

  async function saveTraffic(station: Station) {
    const state = trafficState[station.id]
    if (!state || !state.text.trim()) return

    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'traffic',
        content: `${station.callsign}: ${state.text.trim()}`,
        station_id: station.id,
      }),
    })

    setTrafficState(prev => ({
      ...prev,
      [station.id]: { ...prev[station.id], saved: true },
    }))
    onUpdate()
  }

  async function logNote() {
    if (!noteContent.trim()) return
    setNoteSaving(true)

    const prefix = noteCallsign.trim() ? `${noteCallsign.trim().toUpperCase()}: ` : ''
    const station = stations.find(s => s.callsign.toUpperCase() === noteCallsign.trim().toUpperCase())

    const entryType = noteType === 'traffic' ? 'traffic' : 'note'
    const typePrefix = noteType === 'question' ? '[Question] ' : noteType === 'comment' ? '[Comment] ' : ''
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: entryType,
        content: `${prefix}${typePrefix}${noteContent.trim()}`,
        station_id: station?.id || null,
      }),
    })

    setNoteCallsign('')
    setNoteContent('')
    setNoteType('traffic')
    setNoteSaving(false)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-4">
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-base leading-7 text-gray-100 whitespace-pre-wrap border border-gray-800">
          Are there any questions, comments, or traffic for the net?
        </div>

        {trafficStations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Stations with Traffic</h4>
            {trafficStations.map(station => {
              const state = trafficState[station.id]
              if (!state || state.cancelled) return null

              if (state.saved) {
                return (
                  <div key={station.id} className="flex items-center gap-2 px-3 py-2 bg-green-950/30 rounded-lg">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-green-400 line-through">{station.callsign}</span>
                    <span className="text-gray-500 text-xs">logged</span>
                  </div>
                )
              }

              return (
                <div key={station.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-white">{station.callsign}</span>
                    <button
                      onClick={() => setTrafficState(prev => ({ ...prev, [station.id]: { ...prev[station.id], cancelled: true } }))}
                      className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      No traffic
                    </button>
                  </div>
                  <Textarea
                    value={state.text}
                    onChange={e => setTrafficState(prev => ({ ...prev, [station.id]: { ...prev[station.id], text: e.target.value } }))}
                    placeholder="Summarize traffic..."
                    className="bg-gray-900 border-gray-700 text-white text-sm"
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={() => saveTraffic(station)}
                    disabled={!state.text.trim()}
                    className="bg-yellow-700 hover:bg-yellow-600 text-xs"
                  >
                    Log Traffic
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <div className="border-t border-gray-700 pt-4 space-y-3">
          <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Log Question, Comment, or Traffic
          </h4>
          <div>
            <Label className="text-gray-400 text-xs mb-1 block">Station (optional)</Label>
            <CallsignAutocomplete
              value={noteCallsign}
              onChange={setNoteCallsign}
              onSelect={s => setNoteCallsign(s.callsign)}
              stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
              roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
              placeholder="Callsign (optional)"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-gray-400 text-xs">Content</Label>
              {(['traffic', 'question', 'comment', 'note'] as const).map(t => {
                const labels: Record<string, string> = { traffic: 'Traffic', question: 'Question', comment: 'Comment', note: 'Note' }
                return (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      noteType === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {labels[t]}
                  </button>
                )
              })}
            </div>
            <Textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Question, comment, or traffic details..."
              className="bg-gray-800 border-gray-700 text-white text-sm"
              rows={2}
            />
          </div>
          <Button
            size="sm"
            onClick={logNote}
            disabled={noteSaving || !noteContent.trim()}
            className="bg-blue-700 hover:bg-blue-600"
          >
            {noteSaving ? 'Logging...' : 'Log Entry'}
          </Button>
        </div>
      </div>
    </div>
  )
}

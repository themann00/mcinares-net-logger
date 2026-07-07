'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { StationPassList } from '@/components/StationPassList'
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

export function TrafficSection({ stations, logEntries, netId, roster, onUpdate }: TrafficSectionProps) {
  const [noteCallsign, setNoteCallsign] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteType, setNoteType] = useState<'traffic' | 'question' | 'comment' | 'note'>('traffic')
  const [noteSaving, setNoteSaving] = useState(false)

  async function logNote() {
    if (!noteContent.trim()) return
    setNoteSaving(true)

    const prefix = noteCallsign.trim() ? `${noteCallsign.trim().toUpperCase()}: ` : ''
    const entryType = noteType === 'traffic' ? 'traffic' : 'note'
    const typePrefix = noteType === 'question' ? '[Question] ' : noteType === 'comment' ? '[Comment] ' : ''
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: entryType,
        content: `${prefix}${typePrefix}${noteContent.trim()}`,
        callsign: noteCallsign.trim() ? noteCallsign.trim().toUpperCase() : undefined,
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
      <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 space-y-4">
        <div className="bg-surface-0 rounded-lg p-4 font-mono text-base leading-7 text-fg-1 whitespace-pre-wrap border border-surface-2">
          Are there any questions, comments, or traffic for the net?
        </div>

        <StationPassList
          netId={netId}
          flag="traffic"
          stations={stations}
          logEntries={logEntries}
          onUpdate={onUpdate}
        />

        <div className="border-t border-surface-3 pt-4 space-y-3">
          <h4 className="text-fg-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Log Question, Comment, or Traffic
          </h4>
          <div>
            <Label className="text-fg-3 text-xs mb-1 block">Station (optional)</Label>
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
              <Label className="text-fg-3 text-xs">Content</Label>
              {(['traffic', 'question', 'comment', 'note'] as const).map(t => {
                const labels: Record<string, string> = { traffic: 'Traffic', question: 'Question', comment: 'Comment', note: 'Note' }
                return (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      noteType === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-2 text-fg-4 hover:text-fg-2'
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
              className="bg-surface-2 border-surface-3 text-fg text-sm"
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

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import type { Station } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type NoteType = 'note' | 'traffic' | 'question' | 'comment'

interface AddToLogModalProps {
  netId: string
  stations: Station[]
  roster: RosterEntry[]
  onSave: () => void
  onClose: () => void
}

export function AddToLogModal({ netId, stations, roster, onSave, onClose }: AddToLogModalProps) {
  const [callsign, setCallsign] = useState('')
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('note')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)

    const cs = callsign.trim().toUpperCase()
    const prefix = cs ? `${cs}: ` : ''
    const station = stations.find(s => s.callsign.toUpperCase() === cs)
    const entryType = noteType === 'traffic' ? 'traffic' : 'note'
    const typePrefix = noteType === 'question' ? '[Question] ' : noteType === 'comment' ? '[Comment] ' : ''

    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: entryType,
        content: `${prefix}${typePrefix}${content.trim()}`,
        metadata: cs ? { callsign: cs } : undefined,
      }),
    })

    setSaving(false)
    onSave()
  }

  const types: { id: NoteType; label: string }[] = [
    { id: 'note', label: 'Note' },
    { id: 'traffic', label: 'Traffic' },
    { id: 'question', label: 'Question' },
    { id: 'comment', label: 'Comment' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-fg font-semibold">Add to Log</span>
          <button onClick={onClose} className="text-fg-3 hover:text-fg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <Label className="text-fg-3 text-xs mb-1 block">Station (optional)</Label>
          <CallsignAutocomplete
            value={callsign}
            onChange={setCallsign}
            onSelect={s => setCallsign(s.callsign)}
            stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
            roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
            placeholder="Callsign (optional)"
            autoFocus
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-fg-3 text-xs">Type</Label>
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => setNoteType(t.id)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  noteType === t.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-2 text-fg-4 hover:text-fg-2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Enter content..."
            className="bg-surface-2 border-surface-3 text-fg text-sm"
            rows={3}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="bg-green-700 hover:bg-green-600"
          >
            {saving ? 'Saving...' : 'Add to Log'}
          </Button>
        </div>
      </div>
    </div>
  )
}

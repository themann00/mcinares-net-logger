'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { LOG_TYPE_META, typesForNet, openCloseWarnings } from '@/lib/logTypes'
import type { LogEntry, LogEntryType, NetType, Station } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface AddLogEntryModalProps {
  netId: string
  netType?: NetType | null
  entries: LogEntry[]
  stations?: Station[]
  roster?: RosterEntry[]
  onSave: () => void
  onClose: () => void
}

export function AddLogEntryModal({ netId, netType, entries, stations = [], roster = [], onSave, onClose }: AddLogEntryModalProps) {
  const [entryType, setEntryType] = useState<LogEntryType>('note')
  const [callsign, setCallsign] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [warnings, setWarnings] = useState<string[] | null>(null)

  // Default the timestamp inside the net: one second before NET CLOSE when the
  // net is already closed, otherwise now (net still open).
  const [dateStr, setDateStr] = useState(() => {
    const lastClose = [...entries].reverse().find(e => e.entry_type === 'net_close')
    const d = lastClose ? new Date(new Date(lastClose.timestamp).getTime() - 1000) : new Date()
    return format(d, 'yyyy-MM-dd')
  })
  const [timeStr, setTimeStr] = useState(() => {
    const lastClose = [...entries].reverse().find(e => e.entry_type === 'net_close')
    const d = lastClose ? new Date(new Date(lastClose.timestamp).getTime() - 1000) : new Date()
    return format(d, 'HH:mm:ss')
  })

  async function handleSave(force = false) {
    if (!content.trim()) return
    const ts = new Date(`${dateStr}T${timeStr}`)
    if (isNaN(ts.getTime())) return
    const iso = ts.toISOString()

    if (!force) {
      const w = openCloseWarnings(entries, { entry_type: entryType, timestamp: iso })
      if (w.length > 0) {
        setWarnings(w)
        return
      }
    }

    setSaving(true)
    const cs = callsign.trim().toUpperCase()
    const prefix = cs && !content.trim().toUpperCase().startsWith(`${cs}:`) ? `${cs}: ` : ''
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: entryType,
        content: `${prefix}${content.trim()}`,
        timestamp: iso,
        ...(cs ? { callsign: cs } : {}),
      }),
    })
    setSaving(false)
    onSave()
  }

  const types = typesForNet(netType)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-fg font-semibold">Add Log Entry</span>
          <button onClick={onClose} className="text-fg-3 hover:text-fg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {warnings ? (
          <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-amber-300 text-sm space-y-1">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { setWarnings(null); handleSave(true) }}
                disabled={saving}
                className="bg-amber-700 hover:bg-amber-600"
              >
                Add Anyway
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWarnings(null)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Type</Label>
              <Select value={entryType} onValueChange={v => setEntryType(v as LogEntryType)}>
                <SelectTrigger className="bg-surface-2 border-surface-3 text-fg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-surface-3 max-h-64">
                  {types.map(t => (
                    <SelectItem key={t} value={t} className="text-fg">
                      <span className={`font-mono text-xs font-semibold ${LOG_TYPE_META[t].color}`}>
                        {LOG_TYPE_META[t].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              />
            </div>

            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Content</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Enter content..."
                className="bg-surface-2 border-surface-3 text-fg text-sm"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Date &amp; Time</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateStr}
                  onChange={e => setDateStr(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
                <Input
                  type="time"
                  lang="en-GB"
                  step={1}
                  value={timeStr}
                  onChange={e => setTimeStr(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg w-36"
                />
              </div>
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
                onClick={() => handleSave()}
                disabled={saving || !content.trim()}
                className="bg-green-700 hover:bg-green-600"
              >
                {saving ? 'Adding...' : 'Add Entry'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

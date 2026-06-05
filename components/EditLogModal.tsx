'use client'

import { useState, useEffect } from 'react'
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
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { buildCheckinContent } from '@/lib/station'
import type { LogEntry, Station, LogEntryType, CheckinMetadata } from '@/types'

const TYPE_CONFIG: Record<LogEntryType, { label: string; color: string }> = {
  net_open: { label: 'NET OPEN', color: 'text-green-400' },
  checkin: { label: 'CHECK-IN', color: 'text-blue-400' },
  report: { label: 'REPORT', color: 'text-orange-400' },
  traffic: { label: 'TRAFFIC', color: 'text-yellow-400' },
  announcement: { label: 'ANNOUNCEMENT', color: 'text-teal-400' },
  liaison: { label: 'LIAISON', color: 'text-purple-400' },
  alt_nc: { label: 'ALT NC', color: 'text-purple-400' },
  continuity: { label: 'CONTINUITY', color: 'text-cyan-400' },
  circle_back: { label: 'UPDATE', color: 'text-amber-400' },
  late_checkin: { label: 'LATE CHECK-IN', color: 'text-blue-300' },
  station_moved: { label: 'MOVED', color: 'text-orange-300' },
  net_close: { label: 'NET CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-gray-400' },
}

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface Analysis {
  case: 'noop' | 'attach' | 1 | 2 | 3 | 4
  auto: boolean
  incorrect: {
    id: string
    callsign: string
    new_this_net: boolean
    entries_in_net: number
    entry_ids_in_net: string[]
    entries_elsewhere: number
  } | null
  correct: { exists: boolean; id: string | null; callsign: string }
}

interface ApplyResult {
  ok: boolean
  station_id?: string
  callsign?: string
  orphan: { id: string; callsign: string } | null
  remaining_entry_ids: string[]
}

interface EditLogModalProps {
  entry: LogEntry
  station: Station | null
  netId: string
  onSave: () => void
  onClose: () => void
  stations?: Station[]
  roster?: RosterEntry[]
  onHighlight?: (entryIds: string[]) => void
}

function parseReportContent(content: string) {
  const callMatch = content.match(/^([A-Z0-9]+):\s*/)
  const callsign = callMatch ? callMatch[1] : ''
  let rest = callMatch ? content.slice(callMatch[0].length) : content

  const locMatch = rest.match(/^\[([^\]]*)\]\s*/)
  const location = locMatch ? locMatch[1] : ''
  const report = locMatch ? rest.slice(locMatch[0].length) : rest

  return { callsign, location, report }
}

function parseCheckinContent(content: string) {
  const callMatch = content.match(/^(?:MANUAL:\s*)?([A-Z0-9]+)\s/)
  return callMatch ? callMatch[1] : ''
}

export function EditLogModal({ entry, station, netId, onSave, onClose, stations = [], roster = [], onHighlight }: EditLogModalProps) {
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [content, setContent] = useState(entry.content)

  const [callsign, setCallsign] = useState('')
  const [location, setLocation] = useState('')
  const [report, setReport] = useState('')
  const [stationType, setStationType] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [pending, setPending] = useState<Analysis | null>(null)
  const [orphan, setOrphan] = useState<{ id: string; callsign: string } | null>(null)

  const isReport = entry.entry_type === 'report'
  const isCheckin = entry.entry_type === 'checkin' || entry.entry_type === 'late_checkin'
  const isStructured = isReport || isCheckin

  const originalCallsign = (entry.station?.callsign || '').toUpperCase()

  useEffect(() => {
    const meta = entry.metadata as CheckinMetadata | null
    if (isReport) {
      const parsed = parseReportContent(entry.content)
      setCallsign(entry.station?.callsign || parsed.callsign)
      setLocation(station?.location || parsed.location)
      setReport(parsed.report)
    } else if (isCheckin) {
      setCallsign(entry.station?.callsign || station?.callsign || parseCheckinContent(entry.content))
      setStationType(meta?.station_type || station?.station_type || '')
      setLocation(meta?.location || station?.location || '')
      setFirstName(entry.station?.first_name || station?.first_name || '')
      setLastName(entry.station?.last_name || station?.last_name || '')
    } else {
      setContent(entry.content)
    }
  }, [entry, station, isReport, isCheckin])

  function newCallsign() {
    return callsign.trim().toUpperCase()
  }

  async function analyzeChange(): Promise<Analysis | null> {
    const res = await fetch(`/api/nets/${netId}/station-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'analyze', entry_id: entry.id, new_callsign: newCallsign() }),
    })
    if (!res.ok) return null
    return res.json()
  }

  async function applyChange(scope: 'entry' | 'net'): Promise<ApplyResult | null> {
    const res = await fetch(`/api/nets/${netId}/station-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'apply', entry_id: entry.id, new_callsign: newCallsign(), scope }),
    })
    if (!res.ok) return null
    return res.json()
  }

  async function saveFields(cs: string, stationId?: string | null) {
    if (isReport) {
      const prefix = cs ? `${cs}: ` : ''
      const locPrefix = location.trim() ? `[${location.trim()}] ` : ''
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id, content: `${prefix}${locPrefix}${report.trim()}` }),
      })
    } else if (isCheckin) {
      const meta = {
        ...((entry.metadata as Record<string, unknown> | null) || {}),
        callsign: cs,
        station_type: stationType || null,
        location: location.trim() || null,
      }
      const manual = entry.content.startsWith('MANUAL:') ? 'MANUAL: ' : ''
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entry.id,
          content: `${manual}${buildCheckinContent(cs, meta as CheckinMetadata)}`,
          metadata: meta,
        }),
      })

      // Names live on the roster: fixing them here fixes them everywhere.
      const sid = stationId ?? entry.station?.id
      const nameChanged =
        firstName.trim() !== (entry.station?.first_name || '') ||
        lastName.trim() !== (entry.station?.last_name || '')
      if (sid && nameChanged) {
        await fetch('/api/roster', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sid, first_name: firstName.trim(), last_name: lastName.trim() }),
        })
      }
    } else {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id, content: content.trim() }),
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    const cs = newCallsign()
    const changed = isStructured && !!cs && cs !== originalCallsign

    if (changed) {
      const analysis = await analyzeChange()
      if (analysis && analysis.case !== 'noop' && !analysis.auto) {
        // Needs a human decision: change all / highlight all / skip
        setPending(analysis)
        setSaving(false)
        return
      }
      if (analysis && analysis.case !== 'noop' && analysis.auto) {
        const result = await applyChange('net')
        await saveFields(result?.callsign || cs, result?.station_id)
        if (result?.orphan) {
          setOrphan(result.orphan)
          setSaving(false)
          return
        }
        setSaving(false)
        onSave()
        return
      }
    }

    await saveFields(cs || originalCallsign)
    setSaving(false)
    onSave()
  }

  async function resolvePrompt(choice: 'all' | 'highlight' | 'skip') {
    if (!pending) return
    setSaving(true)
    const result = await applyChange(choice === 'all' ? 'net' : 'entry')
    if (choice === 'highlight' && onHighlight && pending.incorrect) {
      onHighlight(pending.incorrect.entry_ids_in_net.filter(eid => eid !== entry.id))
    }
    setPending(null)
    await saveFields(result?.callsign || newCallsign(), result?.station_id)
    if (result?.orphan) {
      setOrphan(result.orphan)
      setSaving(false)
      return
    }
    setSaving(false)
    onSave()
  }

  async function resolveOrphan(del: boolean) {
    if (del && orphan) {
      await fetch('/api/roster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orphan.id }),
      })
    }
    setOrphan(null)
    onSave()
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entry.id }),
    })
    setDeleting(false)
    onSave()
  }

  const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-gray-500 text-xs">
              {format(new Date(entry.timestamp), 'HH:mm:ss')}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {orphan ? (
          <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-2">
            <p className="text-amber-300 text-sm">
              <span className="font-mono font-semibold">{orphan.callsign}</span> is no longer referenced by any
              log entry and was created during a net. Delete it from the roster?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => resolveOrphan(true)} className="bg-red-700 hover:bg-red-600">
                Delete from Roster
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveOrphan(false)}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Keep
              </Button>
            </div>
          </div>
        ) : pending ? (
          <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3 space-y-3">
            <div className="text-sm text-gray-200 space-y-1">
              <p>
                {pending.correct.exists ? (
                  <>Pointing this entry at existing station <span className="font-mono font-semibold text-white">{pending.correct.callsign}</span>.</>
                ) : (
                  <>Creating new station <span className="font-mono font-semibold text-white">{pending.correct.callsign}</span> for this entry.</>
                )}
              </p>
              {pending.incorrect && (
                <p className="text-gray-400 text-xs">
                  <span className="font-mono">{pending.incorrect.callsign}</span>
                  {': '}{pending.incorrect.entries_in_net} entr{pending.incorrect.entries_in_net === 1 ? 'y' : 'ies'} in this net
                  {pending.incorrect.entries_elsewhere > 0 && (
                    <>, {pending.incorrect.entries_elsewhere} in other nets</>
                  )}
                  {pending.incorrect.new_this_net && <>, first seen this net</>}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" onClick={() => resolvePrompt('all')} disabled={saving} className="bg-blue-700 hover:bg-blue-600 justify-start">
                Change all {pending.incorrect ? `(${pending.incorrect.entries_in_net} entries this net)` : ''}
              </Button>
              {onHighlight && (
                <Button size="sm" onClick={() => resolvePrompt('highlight')} disabled={saving} className="bg-amber-700 hover:bg-amber-600 justify-start">
                  Change this entry, highlight the rest for review
                </Button>
              )}
              <Button size="sm" onClick={() => resolvePrompt('skip')} disabled={saving} className="bg-gray-700 hover:bg-gray-600 justify-start">
                Change this entry only
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPending(null)}
                disabled={saving}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white justify-start"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {isReport && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Callsign</Label>
                  <CallsignAutocomplete
                    value={callsign}
                    onChange={setCallsign}
                    onSelect={s => {
                      setCallsign(s.callsign)
                      const st = stations.find(st => st.callsign.toUpperCase() === s.callsign.toUpperCase())
                      if (st?.location && st.location !== 'N/A') setLocation(st.location)
                    }}
                    stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
                    roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
                  <Input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Report</Label>
                  <Textarea
                    value={report}
                    onChange={e => setReport(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={3}
                  />
                </div>
              </>
            )}

            {isCheckin && (
              <>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Callsign</Label>
                  <CallsignAutocomplete
                    value={callsign}
                    onChange={setCallsign}
                    onSelect={s => {
                      setCallsign(s.callsign)
                      if (s.first_name) setFirstName(s.first_name)
                      if (s.last_name) setLastName(s.last_name)
                      const st = stations.find(st => st.callsign.toUpperCase() === s.callsign.toUpperCase())
                      if (st?.location && st.location !== 'N/A') setLocation(st.location)
                      if (st?.station_type) setStationType(st.station_type)
                    }}
                    stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
                    roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-xs mb-1 block">First Name</Label>
                    <Input
                      value={firstName}
                      onChange={e => { const v = e.target.value; setFirstName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs mb-1 block">Last Name</Label>
                    <Input
                      value={lastName}
                      onChange={e => { const v = e.target.value; setLastName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-xs mb-1 block">Base / Mobile</Label>
                    <Select value={stationType} onValueChange={v => setStationType(v || '')}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="base" className="text-white">Base</SelectItem>
                        <SelectItem value="mobile" className="text-white">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
                    <Input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {!isStructured && (
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Content</Label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                  rows={3}
                />
              </div>
            )}

            {confirmDelete ? (
              <div className="bg-red-950/40 border border-red-700 rounded-lg p-3 space-y-2">
                <p className="text-red-300 text-sm">Delete this {isCheckin ? 'check-in and station' : 'log entry'}?</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleDelete} disabled={deleting} className="bg-red-700 hover:bg-red-600">
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white">
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="border-red-800 bg-red-950/30 text-red-400 hover:bg-red-900 hover:text-red-300"
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onClose}
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
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

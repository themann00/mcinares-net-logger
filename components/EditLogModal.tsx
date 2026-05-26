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
import type { LogEntry, Station, LogEntryType } from '@/types'

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
  net_close: { label: 'NET CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-gray-400' },
}

interface EditLogModalProps {
  entry: LogEntry
  station: Station | null
  netId: string
  onSave: () => void
  onClose: () => void
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
  const callMatch = content.match(/^([A-Z0-9]+)\s/)
  return callMatch ? callMatch[1] : ''
}

export function EditLogModal({ entry, station, netId, onSave, onClose }: EditLogModalProps) {
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState(entry.content)

  const [callsign, setCallsign] = useState('')
  const [location, setLocation] = useState('')
  const [report, setReport] = useState('')
  const [stationType, setStationType] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const isReport = entry.entry_type === 'report'
  const isCheckin = entry.entry_type === 'checkin' || entry.entry_type === 'late_checkin'
  const isStructured = isReport || isCheckin

  useEffect(() => {
    if (isReport) {
      const parsed = parseReportContent(entry.content)
      setCallsign(station?.callsign || parsed.callsign)
      setLocation(station?.location || parsed.location)
      setReport(parsed.report)
    } else if (isCheckin) {
      setCallsign(station?.callsign || parseCheckinContent(entry.content))
      setStationType(station?.station_type || '')
      setLocation(station?.location || '')
      setFirstName(station?.first_name || '')
      setLastName(station?.last_name || '')
    } else {
      setContent(entry.content)
    }
  }, [entry, station, isReport, isCheckin])

  async function handleSave() {
    setSaving(true)

    if (isReport) {
      const prefix = callsign.trim() ? `${callsign.trim()}: ` : ''
      const locPrefix = location.trim() ? `[${location.trim()}] ` : ''
      const newContent = `${prefix}${locPrefix}${report.trim()}`

      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id, content: newContent }),
      })

      if (station && location.trim()) {
        await fetch(`/api/nets/${netId}/stations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: station.id, location: location.trim() }),
        })
      }
    } else if (isCheckin && station) {
      const parts: string[] = [`${callsign.trim()} checked in`]
      if (stationType) parts.push(`(${stationType})`)
      if (location.trim() && location.trim() !== 'N/A') parts.push(`@ ${location.trim()}`)

      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id, content: parts.join(' ') }),
      })

      await fetch(`/api/nets/${netId}/stations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: station.id,
          station_type: stationType || undefined,
          location: location.trim() || undefined,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        }),
      })
    } else {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id, content: content.trim() }),
      })
    }

    setSaving(false)
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

        {isReport && (
          <>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Callsign</Label>
              <Input
                value={callsign}
                onChange={e => setCallsign(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
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
              <Input
                value={callsign}
                onChange={e => setCallsign(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">First Name</Label>
                <Input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
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

        <div className="flex gap-2 justify-end">
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
    </div>
  )
}

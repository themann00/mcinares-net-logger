'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RefreshCw, MapPin, AlertCircle, Pencil, AlertTriangle } from 'lucide-react'
import { WeatherReportInputs } from '@/components/WeatherReportInputs'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { sirenMapUrl } from '@/lib/sirenLocations'
import type { Station, NetType, StationType, Quadrant } from '@/types'

type EditReason = 'correction' | 'moved'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface StationListProps {
  stations: Station[]
  netId: string
  netType: NetType
  showCircleBack?: boolean
  onUpdate: () => void
  roster?: RosterEntry[]
}

export function StationList({ stations, netId, netType, showCircleBack = false, onUpdate, roster = [] }: StationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCallsign, setEditCallsign] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  // Names as they were autofilled (roster values); edits past this baseline
  // are permanent roster changes and get a confirmation warning.
  const [nameBaseline, setNameBaseline] = useState<{ first: string; last: string }>({ first: '', last: '' })
  const [editLocation, setEditLocation] = useState('')
  const [editType, setEditType] = useState<StationType | ''>('')
  const [editQuadrant, setEditQuadrant] = useState<Quadrant | ''>('')
  const [editSirens, setEditSirens] = useState<string[]>(['', '', '', ''])
  const [editReason, setEditReason] = useState<EditReason>('correction')
  const [editReportFormatted, setEditReportFormatted] = useState('')
  const [editReportValid, setEditReportValid] = useState(false)
  const [editReportResetKey, setEditReportResetKey] = useState(0)
  const [confirmMsgs, setConfirmMsgs] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  const isSiren = netType === 'siren'

  // Siren: complete once a location or at least one siren number is set.
  // Skywarn: still needs base/mobile and location.
  const stationIncomplete = (s: Station) =>
    isSiren
      ? !s.location && s.siren_numbers.length === 0
      : !s.station_type || !s.location

  const needsCircleBack = showCircleBack
    ? stations.filter(
        s => (netType === 'skywarn' || netType === 'siren') && stationIncomplete(s)
      )
    : []

  function startEdit(station: Station, reason: EditReason) {
    setEditingId(station.callsign)
    setEditCallsign(station.callsign)
    setEditFirstName(station.first_name || '')
    setEditLastName(station.last_name || '')
    setNameBaseline({ first: station.first_name || '', last: station.last_name || '' })
    setEditLocation(station.location || 'N/A')
    setEditType((station.station_type as StationType) || '')
    setEditQuadrant((station.quadrant as Quadrant) || '')
    setEditSirens([0, 1, 2, 3].map(i => station.siren_numbers[i] || ''))
    setEditReason(reason)
    setEditReportResetKey(k => k + 1)
    setEditReportFormatted('')
    setEditReportValid(false)
    setConfirmMsgs(null)
  }

  async function saveEdit(station: Station, confirmed = false) {
    const newCs = editCallsign.trim().toUpperCase()
    const csChanged = !!newCs && newCs !== station.callsign.toUpperCase()
    const nameChanged =
      editFirstName.trim() !== nameBaseline.first ||
      editLastName.trim() !== nameBaseline.last

    // Permanent changes (station identity, roster names) get one confirmation
    // step; per-net facts (type, location, sirens) save straight through.
    if (!confirmed && (csChanged || nameChanged)) {
      const msgs: string[] = []
      if (csChanged) {
        msgs.push(`Callsign changes from ${station.callsign} to ${newCs}: every entry for this station in this net is updated.`)
      }
      if (nameChanged) {
        msgs.push('Name change is a permanent update to this station’s roster record, affecting all past and future nets.')
      }
      setConfirmMsgs(msgs)
      return
    }
    setConfirmMsgs(null)
    setSaving(true)

    let targetStationId = station.station_id
    let targetCs = station.callsign
    if (csChanged) {
      const res = await fetch(`/api/nets/${netId}/station-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apply', entry_id: station.log_entry_id, new_callsign: newCs, scope: 'net' }),
      })
      if (res.ok) {
        const result = await res.json()
        targetStationId = result.station_id || targetStationId
        targetCs = result.callsign || newCs
      }
    }

    const metadata: Record<string, unknown> = {}
    if (editType) metadata.station_type = editType
    if (editLocation.trim()) metadata.location = editLocation.trim()
    if (editQuadrant) metadata.quadrant = editQuadrant
    if (isSiren) metadata.siren_numbers = editSirens.map(s => s.trim()).filter(Boolean)

    await fetch(`/api/nets/${netId}/log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_id: station.log_entry_id,
        metadata,
      }),
    })

    // Names live on the roster: fixing them here fixes them everywhere.
    if (nameChanged && targetStationId) {
      await fetch('/api/roster', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetStationId, first_name: editFirstName.trim(), last_name: editLastName.trim() }),
      })
    }

    if (editReason === 'moved') {
      const parts: string[] = []
      if (editLocation.trim()) parts.push(editLocation.trim())
      if (editQuadrant) parts.push(`[${editQuadrant}]`)
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: 'station_moved',
          content: `${targetCs} moved${parts.length ? ' to ' + parts.join(' ') : ''}`,
          callsign: targetCs,
        }),
      })
    }

    if (editReportValid) {
      const locPrefix = editLocation.trim() ? `[${editLocation.trim()}] ` : ''
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: 'report',
          content: `${targetCs}: ${locPrefix}${editReportFormatted}`,
          callsign: targetCs,
        }),
      })
    }

    setSaving(false)
    setEditingId(null)
    onUpdate()
  }

  const typeColor = (type: string | null) => {
    if (type === 'base') return 'bg-blue-700'
    if (type === 'mobile') return 'bg-purple-700'
    return 'bg-surface-3'
  }

  return (
    <div className="space-y-2">
      {showCircleBack && needsCircleBack.length > 0 && (
        <div className="flex items-center gap-2 text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 text-sm mb-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{needsCircleBack.length} station{needsCircleBack.length > 1 ? 's' : ''} need circle-back</span>
        </div>
      )}

      {stations.length === 0 && (
        <p className="text-fg-4 text-sm text-center py-4">No stations checked in yet.</p>
      )}

      {netType === 'skywarn' ? (
        ([null, 'SW', 'NW', 'NE', 'SE'] as const).map(quadrant => {
          const group = stations
            .filter(s => quadrant === null ? !s.quadrant : s.quadrant === quadrant)
            .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())
          if (group.length === 0) return null
          return (
            <div key={quadrant ?? 'unknown'}>
              <div className="text-fg-4 text-xs font-semibold uppercase tracking-wider mt-2 mb-1">
                {quadrant ?? 'Unknown'}
              </div>
              {group.map(station => renderStation(station))}
            </div>
          )
        })
      ) : (
        [...stations]
          .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())
          .map(station => renderStation(station))
      )}
    </div>
  )

  function renderStation(station: Station) {
    const incomplete =
      showCircleBack &&
      (netType === 'skywarn' || netType === 'siren') &&
      stationIncomplete(station)

    return (
      <div
        key={station.callsign}
        className={`rounded-lg border p-3 ${
          incomplete ? 'border-amber-700/50 bg-amber-950/20' : 'border-surface-3 bg-surface-2/60'
        }`}
      >
        {editingId === station.callsign ? (
          <div className="space-y-2">
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Callsign</Label>
              <CallsignAutocomplete
                value={editCallsign}
                onChange={setEditCallsign}
                onSelect={s => {
                  // Autofill identity from the selection; edits past these
                  // values are what trigger the roster-update warning.
                  setEditCallsign(s.callsign)
                  const first = s.first_name || ''
                  const last = s.last_name || ''
                  setEditFirstName(first)
                  setEditLastName(last)
                  setNameBaseline({ first, last })
                  const known = stations.find(st => st.callsign.toUpperCase() === s.callsign.toUpperCase())
                  if (known && known.callsign !== station.callsign) {
                    setEditLocation(known.location && known.location !== 'N/A' ? known.location : 'N/A')
                    if (known.station_type) setEditType(known.station_type as StationType)
                  }
                }}
                stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
                roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">First Name</Label>
                <Input
                  value={editFirstName}
                  onChange={e => { const v = e.target.value; setEditFirstName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Last Name</Label>
                <Input
                  value={editLastName}
                  onChange={e => { const v = e.target.value; setEditLastName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-28">
                <Label className="text-fg-3 text-xs mb-1 block">Base / Mobile</Label>
                <Select value={editType} onValueChange={v => setEditType(v as StationType)}>
                  <SelectTrigger className="bg-surface-2 border-surface-3 text-fg">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2 border-surface-3">
                    <SelectItem value="base" className="text-fg">Base</SelectItem>
                    <SelectItem value="mobile" className="text-fg">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {netType === 'skywarn' && (
                <div className="w-20">
                  <Label className="text-fg-3 text-xs mb-1 block">Quad</Label>
                  <Select value={editQuadrant} onValueChange={v => setEditQuadrant(v as Quadrant)}>
                    <SelectTrigger className="bg-surface-2 border-surface-3 text-fg">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-2 border-surface-3">
                      <SelectItem value="SW" className="text-fg">SW</SelectItem>
                      <SelectItem value="NW" className="text-fg">NW</SelectItem>
                      <SelectItem value="NE" className="text-fg">NE</SelectItem>
                      <SelectItem value="SE" className="text-fg">SE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex-1">
                <Label className="text-fg-3 text-xs mb-1 block">Location (where operating from)</Label>
                <Input
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
            </div>

            {isSiren && (
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Siren #s (up to 4)</Label>
                <div className="flex gap-2">
                  {editSirens.map((val, i) => (
                    <Input
                      key={i}
                      value={val}
                      onChange={e => setEditSirens(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      placeholder={`#${i + 1}`}
                      className="bg-surface-2 border-surface-3 text-fg w-16 font-mono text-sm"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex rounded-lg overflow-hidden border border-surface-3">
                <button
                  type="button"
                  onClick={() => setEditReason('correction')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    editReason === 'correction'
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-2 text-fg-3 hover:text-fg-1'
                  }`}
                >
                  Update inaccurate data
                </button>
                <button
                  type="button"
                  onClick={() => setEditReason('moved')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    editReason === 'moved'
                      ? 'bg-orange-600 text-white'
                      : 'bg-surface-2 text-fg-3 hover:text-fg-1'
                  }`}
                >
                  Station has moved
                </button>
              </div>

            {netType === 'skywarn' && (
              <div className="border-t border-surface-3 pt-2">
                <span className="text-fg-3 text-xs font-medium">Weather Report (optional)</span>
                <WeatherReportInputs
                  resetKey={editReportResetKey}
                  compact
                  onChange={data => {
                    setEditReportFormatted(data.formatted)
                    setEditReportValid(data.valid)
                  }}
                />
              </div>
            )}

            {confirmMsgs ? (
              <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-300 text-sm space-y-1">
                    {confirmMsgs.map((m, i) => <p key={i}>{m}</p>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveEdit(station, true)}
                    disabled={saving}
                    className="bg-amber-700 hover:bg-amber-600"
                  >
                    {saving ? 'Saving...' : 'Confirm & Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmMsgs(null)}
                    className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveEdit(station)}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingId(null)}
                  className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-fg font-mono font-semibold">{station.callsign}</span>
                {netType === 'skywarn' && (
                  <span className="text-fg-4 text-xs">({station.quadrant || 'Unknown'})</span>
                )}
                {station.station_type && (
                  <Badge className={`${typeColor(station.station_type)} text-fg text-xs`}>
                    {station.station_type}
                  </Badge>
                )}
                {station.has_traffic && (
                  <Badge className="bg-yellow-700 text-white text-xs">Traffic</Badge>
                )}
                {station.has_announcements && (
                  <Badge className="bg-teal-700 text-white text-xs">Ann.</Badge>
                )}
              </div>
              {station.location && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(station.location + ' indianapolis')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs mt-0.5 underline underline-offset-2"
                >
                  <MapPin className="w-3 h-3" />
                  {station.location}
                </a>
              )}
              {isSiren && station.siren_numbers.length > 0 && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {station.siren_numbers.map(n => (
                    <a
                      key={n}
                      href={sirenMapUrl(n)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 text-xs font-mono underline underline-offset-2"
                      title={`Siren #${n} on the county siren map`}
                    >
                      Siren #{n}
                    </a>
                  ))}
                </div>
              )}
              {(station.first_name || station.last_name) && (
                <div className="text-fg-4 text-xs mt-0.5">
                  {[station.first_name, station.last_name].filter(Boolean).join(' ')}
                </div>
              )}
            </div>
            {showCircleBack && incomplete ? (
              <button
                onClick={() => startEdit(station, 'correction')}
                className="flex-shrink-0 text-amber-400 hover:text-amber-300 p-1"
                title="Circle back to fill in missing info"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => startEdit(station, 'correction')}
                className="flex-shrink-0 text-fg-4 hover:text-fg-2 p-1"
                title="Edit station"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
}

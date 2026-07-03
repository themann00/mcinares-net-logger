'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText, AlertTriangle } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { WeatherReportInputs } from '@/components/WeatherReportInputs'
import { isKnownSiren, unkName, registerUnknownSirens, type SirenListItem } from '@/lib/sirenClient'
import type { NetType, Station, LogEntry } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface ReportFormProps {
  netId: string
  netType: NetType
  stations: Station[]
  onReport: () => void
  roster?: RosterEntry[]
  logEntries?: LogEntry[]
  /** Testing nets leave no permanent trace, so siren status rows are skipped */
  testing?: boolean
  /** Siren registry, for warning on unrecognized siren numbers */
  sirens?: SirenListItem[]
}

// Tri-state toggle switch: yes on the left, no on the right, unset in between.
function TriToggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-2 text-xs w-14">{label}</span>
      <div
        className={`flex w-24 h-7 rounded-full border text-xs font-medium select-none overflow-hidden ${
          value === true
            ? 'border-green-700'
            : value === false
            ? 'border-red-800'
            : 'border-surface-3'
        }`}
      >
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 transition-colors ${
            value === true ? 'bg-green-700 text-white font-semibold' : 'bg-surface-2 text-fg-4 hover:text-fg-2'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 transition-colors ${
            value === false ? 'bg-red-700 text-white font-semibold' : 'bg-surface-2 text-fg-4 hover:text-fg-2'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

export function ReportForm({ netId, netType, stations, onReport, roster = [], logEntries = [], testing = false, sirens = [] }: ReportFormProps) {
  const [callsign, setCallsign] = useState('')
  const [location, setLocation] = useState('')
  const [sirenNumber, setSirenNumber] = useState('')
  // Tri-state toggles: null = not set, true = yes, false = no
  const [visual, setVisual] = useState<boolean | null>(null)
  const [sound, setSound] = useState<boolean | null>(null)
  const [rotation, setRotation] = useState<boolean | null>(null)
  const [reportFormatted, setReportFormatted] = useState('')
  const [reportValid, setReportValid] = useState(false)
  const [sirenContent, setSirenContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [unkPrompt, setUnkPrompt] = useState<string | null>(null)

  const isSkywarn = netType === 'skywarn'
  const isSiren = netType === 'siren'

  const togglesSet = sound !== null && rotation !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Unrecognized siren numbers need explicit confirmation; they log and
    // register as UNK:###.
    if (isSiren && sirenNumber.trim() && !isKnownSiren(sirenNumber, sirens)) {
      setUnkPrompt(sirenNumber.trim())
      return
    }
    await doSubmit(sirenNumber)
  }

  async function confirmUnknownSiren() {
    if (!unkPrompt) return
    const name = unkName(unkPrompt)
    await registerUnknownSirens([unkPrompt])
    setSirenNumber(name)
    setUnkPrompt(null)
    await doSubmit(name)
  }

  async function doSubmit(sirenValue: string) {
    const sirenNum = sirenValue.trim()
    const reportContent = isSkywarn ? reportFormatted : sirenContent.trim()
    if (isSiren) {
      if (!reportContent && !togglesSet) return
      if (!location.trim() && !sirenNum) return
    } else if (!reportContent) {
      return
    }
    setLoading(true)

    const cs = callsign.toUpperCase().trim()
    const existing = stations.find(s => s.callsign === cs)

    if (cs && !existing) {
      await fetch(`/api/nets/${netId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign: cs,
          location: location.trim() || null,
        }),
      })
    } else if (cs && existing && location.trim() && location.trim() !== (existing.location || '')) {
      // Stations are assumed stationary: only log a move when a previously
      // set location changes. Filling in a blank location just updates the
      // original check-in.
      if (existing.location) {
        await fetch(`/api/nets/${netId}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_type: 'station_moved',
            content: `${cs} moved to ${location.trim()}`,
            callsign: cs,
          }),
        })
      }
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: existing.log_entry_id,
          metadata: { location: location.trim() },
        }),
      })
    }

    // Report format: CALLSIGN: [Location] - Siren #N - toggles - text,
    // omitting missing parts and their separators.
    const prefix = cs ? `${cs}: ` : ''
    const parts: string[] = []
    if (location.trim()) parts.push(`[${location.trim()}]`)

    let metadata: Record<string, unknown> | undefined
    if (isSiren) {
      if (sirenNum) parts.push(`Siren #${sirenNum}`)
      const statusParts: string[] = []
      if (sound !== null) statusParts.push(sound ? 'Sound' : 'No sound')
      if (rotation !== null) statusParts.push(rotation ? 'Rotation' : 'No rotation')
      if (visual !== null) statusParts.push(visual ? 'Visual' : 'No visual')
      if (statusParts.length > 0) parts.push(statusParts.join(', '))
      metadata = {
        siren_number: sirenNum || null,
        sound,
        rotation,
        visual,
      }
    }
    if (reportContent) parts.push(reportContent)
    const content = `${prefix}${parts.join(' - ')}`

    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'report',
        content,
        callsign: cs || undefined,
        metadata,
      }),
    })

    // Append to the permanent per-siren check history.
    if (isSiren && sirenNum && !testing) {
      await fetch('/api/siren-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          net_id: netId,
          callsign: cs || undefined,
          siren_number: sirenNum,
          sound,
          rotation,
          visual,
          notes: sirenContent.trim() || undefined,
        }),
      })
    }

    // Remember the siren number on the station's check-in so future reports
    // and the pending list can use it.
    if (isSiren && sirenNum && existing && !existing.siren_numbers.includes(sirenNum)) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: existing.log_entry_id,
          metadata: { siren_numbers: [...existing.siren_numbers, sirenNum] },
        }),
      })
    }

    setCallsign('')
    setLocation('')
    setSirenNumber('')
    setVisual(null)
    setSound(null)
    setRotation(null)
    setSirenContent('')
    setResetKey(k => k + 1)
    setLoading(false)
    onReport()
  }

  function resetToggles() {
    setVisual(null)
    setSound(null)
    setRotation(null)
  }

  const hasContent = isSiren
    ? (togglesSet || !!sirenContent.trim()) && (!!location.trim() || !!sirenNumber.trim())
    : isSkywarn ? reportValid : !!sirenContent.trim()

  // Siren: stations split into Awaiting Report (check-in order) and Reports
  // Made (reverse check-in order). A station with multiple siren numbers gets
  // one tile per number. Reported stations stay clickable so they can add
  // information or report more sirens — each log is an additional entry.
  type Tile = { callsign: string; sirenNumber: string | null; location: string | null }
  const pendingTiles: Tile[] = []
  const reportedTiles: Tile[] = []
  if (isSiren) {
    const reports = logEntries.filter(e => e.entry_type === 'report')
    const inCheckinOrder = [...stations].sort(
      (a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
    )
    function stationTiles(s: Station): Tile[] {
      if (s.siren_numbers.length === 0) {
        return [{ callsign: s.callsign, sirenNumber: null, location: s.location }]
      }
      return s.siren_numbers.map(n => ({ callsign: s.callsign, sirenNumber: n, location: s.location }))
    }
    for (const s of inCheckinOrder) {
      const hasReported = reports.some(r =>
        (r.station_id && r.station_id === s.station_id) ||
        (!r.station_id && r.content.toUpperCase().startsWith(`${s.callsign.toUpperCase()}:`))
      )
      if (hasReported) reportedTiles.unshift(...stationTiles(s))
      else pendingTiles.push(...stationTiles(s))
    }
  }

  function pickTile(tile: { callsign: string; sirenNumber: string | null; location: string | null }) {
    setCallsign(tile.callsign)
    setSirenNumber(tile.sirenNumber || '')
    const station = stations.find(s => s.callsign === tile.callsign)
    if (station?.location && station.location !== 'N/A') setLocation(station.location)
    else setLocation('')
  }

  return (
    <div className="space-y-4">
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="text-fg-3 text-xs mb-1 block">Station Callsign</Label>
        <CallsignAutocomplete
          value={callsign}
          onChange={setCallsign}
          onSelect={s => {
            setCallsign(s.callsign)
            const station = stations.find(st => st.callsign.toUpperCase() === s.callsign.toUpperCase())
            if (station?.location && station.location !== 'N/A') {
              setLocation(station.location)
            }
            if (isSiren && station && station.siren_numbers.length > 0) {
              setSirenNumber(station.siren_numbers[0])
            }
          }}
          stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
          roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
        />
      </div>
      {isSiren ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-fg-3 text-xs mb-1 block">Location</Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 38th & Meridian"
              className="bg-surface-2 border-surface-3 text-fg"
            />
          </div>
          <div>
            <Label className="text-fg-3 text-xs mb-1 block">Siren Number</Label>
            <Input
              value={sirenNumber}
              onChange={e => setSirenNumber(e.target.value)}
              placeholder="e.g. 12"
              className="bg-surface-2 border-surface-3 text-fg font-mono"
            />
          </div>
        </div>
      ) : (
        <div>
          <Label className="text-fg-3 text-xs mb-1 block">Location</Label>
          <Input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. 38th & Meridian"
            className="bg-surface-2 border-surface-3 text-fg"
          />
        </div>
      )}

      {isSiren && (
        <p className="text-fg-4 text-xs -mt-1">Location or siren number required.</p>
      )}

      {isSkywarn ? (
        <WeatherReportInputs
          resetKey={resetKey}
          onChange={data => {
            setReportFormatted(data.formatted)
            setReportValid(data.valid)
          }}
        />
      ) : (
        <div className="space-y-2">
          {isSiren && (
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1.5">
                <TriToggle label="Sound" value={sound} onChange={setSound} />
                <TriToggle label="Rotation" value={rotation} onChange={setRotation} />
                <TriToggle label="Visual" value={visual} onChange={setVisual} />
              </div>
              <button
                type="button"
                onClick={resetToggles}
                disabled={sound === null && rotation === null && visual === null}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-2 border border-surface-3 text-fg-3 hover:text-fg-1 disabled:opacity-40 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
          <div>
            <Label className="text-fg-3 text-xs mb-1 block">
              {netType === 'siren' ? 'Siren Report' : 'Weather Report'} *
            </Label>
            <Textarea
              value={sirenContent}
              onChange={e => setSirenContent(e.target.value)}
              placeholder={
                netType === 'siren'
                  ? 'Damage/repair notes, observations...'
                  : 'Event type, measurement, time...'
              }
              className="bg-surface-2 border-surface-3 text-fg"
              rows={3}
              required={!isSiren}
            />
          </div>
        </div>
      )}

      {unkPrompt ? (
        <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm">
              Siren <span className="font-mono font-semibold">{unkPrompt}</span> is not in the siren
              database. Log it as <span className="font-mono font-semibold">{unkName(unkPrompt)}</span>?
              It will be added to the database under that name.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={confirmUnknownSiren}
              disabled={loading}
              className="bg-amber-700 hover:bg-amber-600"
            >
              Log as {unkName(unkPrompt)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setUnkPrompt(null)}
              className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
            >
              Go Back
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="submit"
          disabled={loading || !hasContent}
          className="w-full bg-orange-700 hover:bg-orange-600"
        >
          <FileText className="w-4 h-4 mr-2" />
          {loading ? 'Logging...' : 'Log Report'}
        </Button>
      )}
    </form>

    {isSiren && pendingTiles.length > 0 && (
      <div className="space-y-1.5">
        <h4 className="text-fg-3 text-xs font-semibold uppercase tracking-wider">
          Awaiting Report ({pendingTiles.length})
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {pendingTiles.map(tile => (
            <button
              key={`${tile.callsign}-${tile.sirenNumber ?? 'none'}`}
              type="button"
              onClick={() => pickTile(tile)}
              className="text-left px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 border border-surface-3 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {tile.sirenNumber && (
                  <span className="text-red-400 font-mono text-xs font-semibold">#{tile.sirenNumber}</span>
                )}
                <span className="text-fg font-mono text-sm">{tile.callsign}</span>
              </div>
              {!tile.sirenNumber && tile.location && (
                <div className="text-fg-4 text-xs truncate">{tile.location}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    )}

    {isSiren && reportedTiles.length > 0 && (
      <div className="space-y-1.5">
        <h4 className="text-fg-3 text-xs font-semibold uppercase tracking-wider">
          Reports Made ({reportedTiles.length})
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {reportedTiles.map(tile => (
            <button
              key={`${tile.callsign}-${tile.sirenNumber ?? 'none'}`}
              type="button"
              onClick={() => pickTile(tile)}
              className="text-left px-2.5 py-1.5 bg-green-950/30 hover:bg-green-900/40 border border-green-800/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {tile.sirenNumber && (
                  <span className="text-green-400 font-mono text-xs font-semibold">#{tile.sirenNumber}</span>
                )}
                <span className="text-fg-1 font-mono text-sm">{tile.callsign}</span>
              </div>
              {!tile.sirenNumber && tile.location && (
                <div className="text-fg-4 text-xs truncate">{tile.location}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
    </div>
  )
}

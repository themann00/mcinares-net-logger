'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { WeatherReportInputs } from '@/components/WeatherReportInputs'
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
}

export function ReportForm({ netId, netType, stations, onReport, roster = [], logEntries = [] }: ReportFormProps) {
  const [callsign, setCallsign] = useState('')
  const [location, setLocation] = useState('')
  const [sirenNumber, setSirenNumber] = useState('')
  const [visualConfirm, setVisualConfirm] = useState(false)
  const [sound, setSound] = useState(true)
  const [rotation, setRotation] = useState(true)
  const [reportFormatted, setReportFormatted] = useState('')
  const [reportValid, setReportValid] = useState(false)
  const [sirenContent, setSirenContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const isSkywarn = netType === 'skywarn'
  const isSiren = netType === 'siren'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const reportContent = isSkywarn ? reportFormatted : sirenContent.trim()
    if (!reportContent) return
    if (isSiren && !location.trim() && !sirenNumber.trim()) return
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
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: 'station_moved',
          content: `${cs} moved to ${location.trim()}`,
          callsign: cs,
        }),
      })
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: existing.log_entry_id,
          metadata: { location: location.trim() },
        }),
      })
    }

    const prefix = cs ? `${cs}: ` : ''
    const locPrefix = location.trim() ? `[${location.trim()}] ` : ''

    let content: string
    let metadata: Record<string, unknown> | undefined
    if (isSiren) {
      const sirenPart = sirenNumber.trim() ? `Siren #${sirenNumber.trim()} ` : ''
      const statusParts = [
        sound ? 'Sound' : 'No sound',
        rotation ? 'Rotation' : 'No rotation',
        ...(visualConfirm ? ['Visual confirmation'] : []),
      ]
      content = `${prefix}${sirenPart}${locPrefix}${statusParts.join(', ')} — ${reportContent}`
      metadata = {
        siren_number: sirenNumber.trim() || null,
        sound,
        rotation,
        visual_confirmation: visualConfirm,
      }
    } else {
      content = `${prefix}${locPrefix}${reportContent}`
    }

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

    // Remember the siren number on the station's check-in so future reports
    // and the pending list can use it.
    if (isSiren && sirenNumber.trim() && existing && !existing.siren_numbers.includes(sirenNumber.trim())) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: existing.log_entry_id,
          metadata: { siren_numbers: [...existing.siren_numbers, sirenNumber.trim()] },
        }),
      })
    }

    setCallsign('')
    setLocation('')
    setSirenNumber('')
    setVisualConfirm(false)
    setSound(true)
    setRotation(true)
    setSirenContent('')
    setResetKey(k => k + 1)
    setLoading(false)
    onReport()
  }

  const hasContent = (isSkywarn ? reportValid : !!sirenContent.trim()) &&
    (!isSiren || !!location.trim() || !!sirenNumber.trim())

  // Siren: stations that have not reported yet, one tile per siren number.
  const pendingTiles: { callsign: string; sirenNumber: string | null; location: string | null }[] = []
  if (isSiren) {
    const reports = logEntries.filter(e => e.entry_type === 'report')
    for (const s of stations) {
      const own = reports.filter(r =>
        (r.station_id && r.station_id === s.station_id) ||
        (!r.station_id && r.content.toUpperCase().startsWith(`${s.callsign.toUpperCase()}:`))
      )
      // A report without a siren number counts as covering the whole station.
      const bareReport = own.some(r => !(r.metadata as Record<string, unknown> | null)?.siren_number)
      if (bareReport) continue
      const reportedNumbers = new Set(
        own.map(r => ((r.metadata as Record<string, unknown> | null)?.siren_number as string) || '').filter(Boolean)
      )
      if (s.siren_numbers.length > 0) {
        for (const n of s.siren_numbers) {
          if (!reportedNumbers.has(n)) {
            pendingTiles.push({ callsign: s.callsign, sirenNumber: n, location: s.location })
          }
        }
      } else if (own.length === 0) {
        pendingTiles.push({ callsign: s.callsign, sirenNumber: null, location: s.location })
      }
    }
    pendingTiles.sort((a, b) => {
      if (a.sirenNumber && b.sirenNumber) {
        const na = parseInt(a.sirenNumber, 10)
        const nb = parseInt(b.sirenNumber, 10)
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
        return a.sirenNumber.localeCompare(b.sirenNumber)
      }
      if (a.sirenNumber) return -1
      if (b.sirenNumber) return 1
      return a.callsign.localeCompare(b.callsign)
    })
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
        <Label className="text-gray-400 text-xs mb-1 block">Station Callsign</Label>
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
            <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 38th & Meridian"
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1 block">Siren Number</Label>
            <Input
              value={sirenNumber}
              onChange={e => setSirenNumber(e.target.value)}
              placeholder="e.g. 12"
              className="bg-gray-800 border-gray-700 text-white font-mono"
            />
          </div>
        </div>
      ) : (
        <div>
          <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
          <Input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. 38th & Meridian"
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      )}

      {isSiren && (
        <p className="text-gray-500 text-xs -mt-1">Location or siren number required.</p>
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
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-gray-300 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={visualConfirm}
                  onChange={e => setVisualConfirm(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                Visual Confirmation
              </label>
              <button
                type="button"
                onClick={() => setSound(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  sound
                    ? 'bg-green-700 text-white'
                    : 'bg-red-900/70 text-red-200 border border-red-800'
                }`}
              >
                {sound ? 'Sound' : 'No Sound'}
              </button>
              <button
                type="button"
                onClick={() => setRotation(v => !v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  rotation
                    ? 'bg-green-700 text-white'
                    : 'bg-red-900/70 text-red-200 border border-red-800'
                }`}
              >
                {rotation ? 'Rotation' : 'No Rotation'}
              </button>
            </div>
          )}
          <div>
            <Label className="text-gray-400 text-xs mb-1 block">
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
              className="bg-gray-800 border-gray-700 text-white"
              rows={3}
              required
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !hasContent}
        className="w-full bg-orange-700 hover:bg-orange-600"
      >
        <FileText className="w-4 h-4 mr-2" />
        {loading ? 'Logging...' : 'Log Report'}
      </Button>
    </form>

    {isSiren && pendingTiles.length > 0 && (
      <div className="space-y-1.5">
        <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Awaiting Report ({pendingTiles.length})
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {pendingTiles.map(tile => (
            <button
              key={`${tile.callsign}-${tile.sirenNumber ?? 'none'}`}
              type="button"
              onClick={() => pickTile(tile)}
              className="text-left px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {tile.sirenNumber && (
                  <span className="text-red-400 font-mono text-xs font-semibold">#{tile.sirenNumber}</span>
                )}
                <span className="text-white font-mono text-sm">{tile.callsign}</span>
              </div>
              {!tile.sirenNumber && tile.location && (
                <div className="text-gray-500 text-xs truncate">{tile.location}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
    </div>
  )
}

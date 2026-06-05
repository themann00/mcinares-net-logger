'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { WeatherReportInputs } from '@/components/WeatherReportInputs'
import type { NetType, Station } from '@/types'

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
}

export function ReportForm({ netId, netType, stations, onReport, roster = [] }: ReportFormProps) {
  const [callsign, setCallsign] = useState('')
  const [location, setLocation] = useState('')
  const [reportFormatted, setReportFormatted] = useState('')
  const [reportValid, setReportValid] = useState(false)
  const [sirenContent, setSirenContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const isSkywarn = netType === 'skywarn'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const reportContent = isSkywarn ? reportFormatted : sirenContent.trim()
    if (!reportContent) return
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
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'report',
        content: `${prefix}${locPrefix}${reportContent}`,
        callsign: cs || undefined,
      }),
    })

    setCallsign('')
    setLocation('')
    setSirenContent('')
    setResetKey(k => k + 1)
    setLoading(false)
    onReport()
  }

  const hasContent = isSkywarn ? reportValid : !!sirenContent.trim()

  return (
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
          placeholder="e.g. 38th & Meridian"
          className="bg-gray-800 border-gray-700 text-white"
        />
      </div>

      {isSkywarn ? (
        <WeatherReportInputs
          resetKey={resetKey}
          onChange={data => {
            setReportFormatted(data.formatted)
            setReportValid(data.valid)
          }}
        />
      ) : (
        <div>
          <Label className="text-gray-400 text-xs mb-1 block">
            {netType === 'siren' ? 'Siren Report' : 'Weather Report'} *
          </Label>
          <Textarea
            value={sirenContent}
            onChange={e => setSirenContent(e.target.value)}
            placeholder={
              netType === 'siren'
                ? 'Siren #, rotation, damage/repair notes...'
                : 'Event type, measurement, time...'
            }
            className="bg-gray-800 border-gray-700 text-white"
            rows={3}
            required
          />
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
  )
}

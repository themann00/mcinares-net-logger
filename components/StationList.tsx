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
import { RefreshCw, MapPin, AlertCircle, Pencil } from 'lucide-react'
import { WeatherReportInputs } from '@/components/WeatherReportInputs'
import type { Station, NetType, StationType, Quadrant } from '@/types'

type EditReason = 'correction' | 'moved'

interface StationListProps {
  stations: Station[]
  netId: string
  netType: NetType
  showCircleBack?: boolean
  onUpdate: () => void
}

export function StationList({ stations, netId, netType, showCircleBack = false, onUpdate }: StationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLocation, setEditLocation] = useState('')
  const [editType, setEditType] = useState<StationType | ''>('')
  const [editQuadrant, setEditQuadrant] = useState<Quadrant | ''>('')
  const [editReason, setEditReason] = useState<EditReason>('correction')
  const [editReportFormatted, setEditReportFormatted] = useState('')
  const [editReportValid, setEditReportValid] = useState(false)
  const [editReportResetKey, setEditReportResetKey] = useState(0)
  const [saving, setSaving] = useState(false)

  const needsCircleBack = showCircleBack
    ? stations.filter(
        s =>
          (netType === 'skywarn' || netType === 'siren') &&
          (!s.station_type || !s.location)
      )
    : []

  function startEdit(station: Station, reason: EditReason) {
    setEditingId(station.callsign)
    setEditLocation(station.location || '')
    setEditType((station.station_type as StationType) || '')
    setEditQuadrant((station.quadrant as Quadrant) || '')
    setEditReason(reason)
    setEditReportResetKey(k => k + 1)
    setEditReportFormatted('')
    setEditReportValid(false)
  }

  async function saveEdit(station: Station) {
    setSaving(true)

    const metadata: Record<string, unknown> = {}
    if (editType) metadata.station_type = editType
    if (editLocation.trim()) metadata.location = editLocation.trim()
    if (editQuadrant) metadata.quadrant = editQuadrant

    await fetch(`/api/nets/${netId}/log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_id: station.log_entry_id,
        metadata,
      }),
    })

    if (editReason === 'moved') {
      const parts: string[] = []
      if (editLocation.trim()) parts.push(editLocation.trim())
      if (editQuadrant) parts.push(`[${editQuadrant}]`)
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: 'station_moved',
          content: `${station.callsign} moved${parts.length ? ' to ' + parts.join(' ') : ''}`,
          callsign: station.callsign,
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
          content: `${station.callsign}: ${locPrefix}${editReportFormatted}`,
          callsign: station.callsign,
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
    return 'bg-gray-700'
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
        <p className="text-gray-500 text-sm text-center py-4">No stations checked in yet.</p>
      )}

      {([null, 'SW', 'NW', 'NE', 'SE'] as const).map(quadrant => {
        const group = stations
          .filter(s => quadrant === null ? !s.quadrant : s.quadrant === quadrant)
          .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())
        if (group.length === 0) return null
        return (
          <div key={quadrant ?? 'unknown'}>
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mt-2 mb-1">
              {quadrant ?? 'Unknown'}
            </div>
            {group.map(station => renderStation(station))}
          </div>
        )
      })}
    </div>
  )

  function renderStation(station: Station) {
    const incomplete =
      showCircleBack &&
      (netType === 'skywarn' || netType === 'siren') &&
      (!station.station_type || !station.location)

    return (
      <div
        key={station.callsign}
        className={`rounded-lg border p-3 ${
          incomplete ? 'border-amber-700/50 bg-amber-950/20' : 'border-gray-700 bg-gray-800/60'
        }`}
      >
        {editingId === station.callsign ? (
          <div className="space-y-2">
            <div className="text-white font-mono font-semibold">{station.callsign}</div>
            <div className="flex gap-2">
              <Select value={editType} onValueChange={v => setEditType(v as StationType)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-28">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="base" className="text-white">Base</SelectItem>
                  <SelectItem value="mobile" className="text-white">Mobile</SelectItem>
                </SelectContent>
              </Select>
              <Select value={editQuadrant} onValueChange={v => setEditQuadrant(v as Quadrant)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-20">
                  <SelectValue placeholder="Quad" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="SW" className="text-white">SW</SelectItem>
                  <SelectItem value="NW" className="text-white">NW</SelectItem>
                  <SelectItem value="NE" className="text-white">NE</SelectItem>
                  <SelectItem value="SE" className="text-white">SE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="Location..."
                className="bg-gray-800 border-gray-700 text-white flex-1"
              />
            </div>

            <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditReason('correction')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                    editReason === 'correction'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
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
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Station has moved
                </button>
              </div>

            {netType === 'skywarn' && (
              <div className="border-t border-gray-700 pt-2">
                <span className="text-gray-400 text-xs font-medium">Weather Report (optional)</span>
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
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-mono font-semibold">{station.callsign}</span>
                <span className="text-gray-500 text-xs">({station.quadrant || 'Unknown'})</span>
                {station.station_type && (
                  <Badge className={`${typeColor(station.station_type)} text-white text-xs`}>
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
              {(station.first_name || station.last_name) && (
                <div className="text-gray-500 text-xs mt-0.5">
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
                className="flex-shrink-0 text-gray-500 hover:text-gray-300 p-1"
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

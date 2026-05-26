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
import { RefreshCw, MapPin, AlertCircle } from 'lucide-react'
import type { Station, NetType, StationType } from '@/types'

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
  const [saving, setSaving] = useState(false)

  const needsCircleBack = showCircleBack
    ? stations.filter(
        s =>
          (netType === 'skywarn' || netType === 'siren') &&
          (!s.station_type || !s.location)
      )
    : []

  function startEdit(station: Station) {
    setEditingId(station.id)
    setEditLocation(station.location || '')
    setEditType((station.station_type as StationType) || '')
  }

  async function saveEdit(stationId: string) {
    setSaving(true)
    await fetch(`/api/nets/${netId}/stations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station_id: stationId,
        station_type: editType || undefined,
        location: editLocation.trim() || undefined,
      }),
    })
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

      {(['SW', 'NW', 'NE', 'SE', null] as const).map(quadrant => {
        const group = stations.filter(s =>
          quadrant === null ? !s.quadrant : s.quadrant === quadrant
        )
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
        key={station.id}
        className={`rounded-lg border p-3 ${
          incomplete ? 'border-amber-700/50 bg-amber-950/20' : 'border-gray-700 bg-gray-800/60'
        }`}
      >
        {editingId === station.id ? (
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
              <Input
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="Location..."
                className="bg-gray-800 border-gray-700 text-white flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => saveEdit(station.id)}
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
                <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {station.location}
                </div>
              )}
              {(station.first_name || station.last_name) && (
                <div className="text-gray-500 text-xs mt-0.5">
                  {[station.first_name, station.last_name].filter(Boolean).join(' ')}
                </div>
              )}
            </div>
            {showCircleBack && incomplete && (
              <button
                onClick={() => startEdit(station)}
                className="flex-shrink-0 text-amber-400 hover:text-amber-300 p-1"
                title="Circle back to fill in missing info"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
}

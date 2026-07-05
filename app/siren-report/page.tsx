'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { sirenMapUrlAt } from '@/lib/sirenLocations'
import { haversineMiles, type SirenListItem } from '@/lib/sirenClient'

interface StatusRow {
  id: string
  siren_number: string
  sound: boolean | null
  rotation: boolean | null
  visual: boolean | null
  notes: string | null
  callsign: string | null
  timestamp: string
}

type SortMode = 'name' | 'proximity' | 'last_reported' | 'pass_sound' | 'pass_rotation' | 'pass_both'

const DEFAULT_CENTER = { lat: 39.7684, lng: -86.1581 } // Monument Circle

/** Natural sort: numeric siren names by value, then everything else A-Z. */
function nameCompare(a: string, b: string): number {
  const na = /^\d+$/.test(a) ? parseInt(a, 10) : null
  const nb = /^\d+$/.test(b) ? parseInt(b, 10) : null
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b)
}

function PassBadge({ value }: { value: boolean | null }) {
  if (value === true) return <span className="text-green-400 font-semibold">PASS</span>
  if (value === false) return <span className="text-red-400 font-semibold">FAIL</span>
  return <span className="text-fg-5">—</span>
}

export default function SirenReportPage() {
  const [sirens, setSirens] = useState<SirenListItem[]>([])
  const [status, setStatus] = useState<StatusRow[]>([])
  const [sort, setSort] = useState<SortMode>('name')
  const [coordInput, setCoordInput] = useState(`${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}`)
  const [locating, setLocating] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeLabel, setGeocodeLabel] = useState('')

  useEffect(() => {
    async function load() {
      const [sirensRes, statusRes] = await Promise.all([
        fetch('/api/sirens'),
        fetch('/api/siren-status'),
      ])
      if (sirensRes.ok) setSirens(await sirensRes.json())
      if (statusRes.ok) setStatus(await statusRes.json())
    }
    load()
  }, [])

  // Latest status row per siren (the API returns newest first).
  const latestBySiren = useMemo(() => {
    const map = new Map<string, StatusRow>()
    for (const row of status) {
      const key = row.siren_number.toUpperCase()
      if (!map.has(key)) map.set(key, row)
    }
    return map
  }, [status])

  const center = useMemo(() => {
    const m = coordInput.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
    if (!m) return DEFAULT_CENTER
    return { lat: Number(m[1]), lng: Number(m[2]) }
  }, [coordInput])

  async function findAddress() {
    if (!addressInput.trim()) return
    setGeocoding(true)
    setGeocodeLabel('')
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(addressInput.trim())}`)
    setGeocoding(false)
    if (!res.ok) {
      setGeocodeLabel('Lookup failed.')
      return
    }
    const results = await res.json() as { lat: number; lng: number; label: string }[]
    if (results.length === 0) {
      setGeocodeLabel('No match found — try adding a city or ZIP.')
      return
    }
    const top = results[0]
    setCoordInput(`${top.lat.toFixed(6)}, ${top.lng.toFixed(6)}`)
    setGeocodeLabel(top.label)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoordInput(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`)
        setSort('proximity')
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const rows = useMemo(() => {
    const list = sirens.map(s => {
      const latest = latestBySiren.get(s.name.toUpperCase()) || null
      const distance =
        s.lat != null && s.lng != null ? haversineMiles(center.lat, center.lng, s.lat, s.lng) : null
      return { siren: s, latest, distance }
    })

    // Pass sorts: fails first (most actionable), then untested, then passes.
    const passRank = (v: boolean | null | undefined) => (v === false ? 0 : v == null ? 1 : 2)
    const bothValue = (r: StatusRow | null): boolean | null => {
      if (!r || (r.sound == null && r.rotation == null)) return null
      if (r.sound === false || r.rotation === false) return false
      if (r.sound === true && r.rotation === true) return true
      return null
    }

    switch (sort) {
      case 'name':
        list.sort((a, b) => nameCompare(a.siren.name, b.siren.name))
        break
      case 'proximity':
        list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        break
      case 'last_reported':
        list.sort((a, b) => {
          const ta = a.latest ? new Date(a.latest.timestamp).getTime() : 0
          const tb = b.latest ? new Date(b.latest.timestamp).getTime() : 0
          return tb - ta
        })
        break
      case 'pass_sound':
        list.sort((a, b) => passRank(a.latest?.sound) - passRank(b.latest?.sound) || nameCompare(a.siren.name, b.siren.name))
        break
      case 'pass_rotation':
        list.sort((a, b) => passRank(a.latest?.rotation) - passRank(b.latest?.rotation) || nameCompare(a.siren.name, b.siren.name))
        break
      case 'pass_both':
        list.sort((a, b) => passRank(bothValue(a.latest)) - passRank(bothValue(b.latest)) || nameCompare(a.siren.name, b.siren.name))
        break
    }
    return list
  }, [sirens, latestBySiren, sort, center])

  const sortButtons: { id: SortMode; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'proximity', label: 'Proximity' },
    { id: 'last_reported', label: 'Last Reported' },
    { id: 'pass_sound', label: 'Sound' },
    { id: 'pass_rotation', label: 'Rotation' },
    { id: 'pass_both', label: 'Both' },
  ]

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <h1 className="text-fg text-lg font-semibold">Siren Report</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-fg-3 text-xs font-medium">Sort by:</span>
          {sortButtons.map(b => (
            <button
              key={b.id}
              onClick={() => setSort(b.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sort === b.id ? 'bg-blue-600 text-white' : 'bg-surface-2 text-fg-3 hover:text-fg-1'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {sort === 'proximity' && (
          <div className="space-y-2">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Address or cross street</Label>
                <Input
                  value={addressInput}
                  onChange={e => setAddressInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') findAddress() }}
                  placeholder="e.g. 38th & Meridian, or 6900 Thompson Rd"
                  className="bg-surface-2 border-surface-3 text-fg text-sm w-72"
                />
              </div>
              <Button
                size="sm"
                onClick={findAddress}
                disabled={geocoding || !addressInput.trim()}
                className="bg-blue-700 hover:bg-blue-600 gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                {geocoding ? 'Finding...' : 'Find'}
              </Button>
            </div>
            {geocodeLabel && <p className="text-fg-3 text-xs max-w-xl">{geocodeLabel}</p>}
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Center coordinate (lat, lng)</Label>
                <Input
                  value={coordInput}
                  onChange={e => setCoordInput(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg font-mono text-sm w-72"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={useMyLocation}
                disabled={locating}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg gap-1"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {locating ? 'Locating...' : 'Use my location'}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-fg-3 text-xs uppercase tracking-wide border-b border-surface-3">
                <th className="py-2 pr-3">Siren</th>
                <th className="py-2 pr-3">Location</th>
                {sort === 'proximity' && <th className="py-2 pr-3">Distance</th>}
                <th className="py-2 pr-3">Last Reported</th>
                <th className="py-2 pr-3">Sound</th>
                <th className="py-2 pr-3">Rotation</th>
                <th className="py-2 pr-3">Visual</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ siren, latest, distance }) => (
                <tr key={siren.id} className="border-b border-surface-2/60">
                  <td className="py-1.5 pr-3 font-mono font-semibold text-fg whitespace-nowrap">
                    {siren.lat != null && siren.lng != null ? (
                      <a
                        href={sirenMapUrlAt(siren.lat, siren.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on the county siren map"
                        className="hover:text-blue-300 inline-flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3 text-fg-4" />
                        {siren.name}
                      </a>
                    ) : (
                      siren.name
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-fg-2 max-w-64 truncate">{siren.location || ''}</td>
                  {sort === 'proximity' && (
                    <td className="py-1.5 pr-3 text-fg-2 font-mono text-xs whitespace-nowrap">
                      {distance != null ? `${distance.toFixed(1)} mi` : '—'}
                    </td>
                  )}
                  <td className="py-1.5 pr-3 text-fg-2 font-mono text-xs whitespace-nowrap">
                    {latest ? format(new Date(latest.timestamp), 'MM/dd/yy HH:mm') : <span className="text-fg-5">never</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-xs"><PassBadge value={latest?.sound ?? null} /></td>
                  <td className="py-1.5 pr-3 text-xs"><PassBadge value={latest?.rotation ?? null} /></td>
                  <td className="py-1.5 pr-3 text-xs"><PassBadge value={latest?.visual ?? null} /></td>
                  <td className="py-1.5 text-fg-3 text-xs max-w-72 truncate">{latest?.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-fg-4 text-sm text-center py-6">Loading sirens...</p>
          )}
        </div>
      </div>
    </div>
  )
}

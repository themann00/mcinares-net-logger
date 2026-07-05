'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Crosshair } from 'lucide-react'
import { haversineMiles, type SirenListItem } from '@/lib/sirenClient'

interface NearbySiren {
  name: string
  location: string | null
  distance: number
}

interface SirenFinderButtonProps {
  /** Location text to geocode (address or cross street) */
  location: string
  sirens: SirenListItem[]
  /** Selected siren names, closest first, up to 4 */
  onApply: (names: string[]) => void
}

/**
 * "Find sirens" next to a location field: geocodes the location, lists the 8
 * closest sirens, lets the operator pick up to 4, and fills them in
 * closest-to-furthest order.
 */
export function SirenFinderButton({ location, sirens, onApply }: SirenFinderButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [matchedLabel, setMatchedLabel] = useState('')
  const [nearby, setNearby] = useState<NearbySiren[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const usable = !!location.trim() && location.trim().toUpperCase() !== 'N/A'

  async function find() {
    if (!usable) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(location.trim())}`)
    setLoading(false)
    if (!res.ok) {
      setError('Location lookup failed.')
      setOpen(true)
      setNearby([])
      return
    }
    const results = await res.json() as { lat: number; lng: number; label: string }[]
    if (results.length === 0) {
      setError('No match for that location — try adding a cross street or ZIP.')
      setOpen(true)
      setNearby([])
      return
    }
    const { lat, lng, label } = results[0]
    const closest = sirens
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ name: s.name, location: s.location, distance: haversineMiles(lat, lng, s.lat!, s.lng!) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
    setMatchedLabel(label)
    setNearby(closest)
    setSelected([])
    setOpen(true)
  }

  function toggle(name: string) {
    setSelected(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      if (prev.length >= 4) return prev
      return [...prev, name]
    })
  }

  function apply() {
    // Fill closest-first regardless of the order boxes were checked.
    const ordered = nearby.filter(n => selected.includes(n.name)).map(n => n.name)
    onApply(ordered)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={find}
        disabled={!usable || loading}
        title={usable ? 'Find the closest sirens to this location' : 'Enter a location first'}
        className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg gap-1 whitespace-nowrap"
      >
        <Crosshair className="w-3.5 h-3.5" />
        {loading ? 'Finding...' : 'Find sirens'}
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-fg font-semibold">Closest Sirens</span>
              <button onClick={() => setOpen(false)} className="text-fg-3 hover:text-fg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error ? (
              <p className="text-amber-300 text-sm">{error}</p>
            ) : (
              <>
                <p className="text-fg-4 text-xs">{matchedLabel}</p>
                <p className="text-fg-3 text-xs">Select up to 4. They fill closest to furthest.</p>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {nearby.map(n => {
                    const checked = selected.includes(n.name)
                    const full = selected.length >= 4 && !checked
                    return (
                      <label
                        key={n.name}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                          checked ? 'border-blue-600 bg-blue-950/30' : 'border-surface-3 bg-surface-2'
                        } ${full ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-3'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={full}
                          onChange={() => toggle(n.name)}
                          className="accent-blue-600 flex-shrink-0"
                        />
                        <span className="font-mono font-semibold text-fg w-14 flex-shrink-0">{n.name}</span>
                        <span className="text-fg-2 text-xs flex-1 min-w-0 truncate">{n.location || 'no address'}</span>
                        <span className="text-fg-4 font-mono text-xs flex-shrink-0">{n.distance.toFixed(1)} mi</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              {!error && (
                <Button
                  size="sm"
                  onClick={apply}
                  disabled={selected.length === 0}
                  className="bg-blue-700 hover:bg-blue-600"
                >
                  Use {selected.length || ''} Selected
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

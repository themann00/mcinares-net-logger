'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, GitMerge, MapPin, AlertTriangle } from 'lucide-react'
import { sirenMapUrlAt } from '@/lib/sirenLocations'
import type { SirenListItem } from '@/lib/sirenClient'

interface SirenRow extends SirenListItem {
  created_at: string
}

export default function SirensPage() {
  const [sirens, setSirens] = useState<SirenRow[]>([])
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeFromId, setMergeFromId] = useState('')
  const [mergeIntoId, setMergeIntoId] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState('')

  const fetchSirens = useCallback(async () => {
    const res = await fetch('/api/sirens')
    if (res.ok) setSirens(await res.json())
  }, [])

  useEffect(() => {
    fetchSirens()
  }, [fetchSirens])

  function startEdit(s: SirenRow) {
    setEditingId(s.id)
    setEditName(s.name)
    setEditLocation(s.location || '')
    setEditLat(s.lat != null ? String(s.lat) : '')
    setEditLng(s.lng != null ? String(s.lng) : '')
    setError('')
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return
    const lat = editLat.trim() === '' ? null : Number(editLat)
    const lng = editLng.trim() === '' ? null : Number(editLng)
    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      setError('Coordinates must be numbers.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/sirens', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: editName, location: editLocation, lat, lng }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Save failed.')
      return
    }
    setEditingId(null)
    fetchSirens()
  }

  async function doMerge() {
    if (!mergeFromId || !mergeIntoId || mergeFromId === mergeIntoId) return
    setMerging(true)
    setMergeResult('')
    const res = await fetch('/api/sirens/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep_id: mergeIntoId, merge_id: mergeFromId }),
    })
    setMerging(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setMergeResult(body.error || 'Merge failed.')
      return
    }
    const result = await res.json()
    setMergeResult(`Merged ${result.removed} into ${result.kept.name}; ${result.records_updated} record${result.records_updated === 1 ? '' : 's'} updated.`)
    setMergeFromId('')
    setMergeIntoId('')
    fetchSirens()
  }

  const mergeFrom = sirens.find(s => s.id === mergeFromId)
  const mergeInto = sirens.find(s => s.id === mergeIntoId)

  const q = filter.trim().toUpperCase()
  const visible = q
    ? sirens.filter(s => s.name.toUpperCase().includes(q) || (s.location || '').toUpperCase().includes(q))
    : sirens

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-fg text-lg font-semibold">Siren Database ({sirens.length})</h1>
          <div className="flex items-center gap-2">
            <Input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by name or location..."
              className="bg-surface-2 border-surface-3 text-fg w-64"
            />
            <Button
              size="sm"
              onClick={() => { setMergeOpen(v => !v); setMergeResult('') }}
              className="bg-purple-700 hover:bg-purple-600 gap-1"
            >
              <GitMerge className="w-4 h-4" />
              Merge
            </Button>
          </div>
        </div>

        {mergeOpen && (
          <div className="bg-surface-1 border border-purple-800/60 rounded-xl p-4 space-y-3">
            <h2 className="text-fg font-medium">Merge two siren records</h2>
            <p className="text-fg-3 text-sm">
              The kept siren&apos;s name, location, and coordinates stay as they are. Every check
              record of the removed siren is renamed to the kept siren, then the removed record is
              deleted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Remove this siren</Label>
                <select
                  value={mergeFromId}
                  onChange={e => setMergeFromId(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-fg text-sm"
                >
                  <option value="">Select...</option>
                  {sirens.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === mergeIntoId}>
                      {s.name}{s.location ? ` — ${s.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Keep this siren (records move here)</Label>
                <select
                  value={mergeIntoId}
                  onChange={e => setMergeIntoId(e.target.value)}
                  className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-fg text-sm"
                >
                  <option value="">Select...</option>
                  {sirens.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === mergeFromId}>
                      {s.name}{s.location ? ` — ${s.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {mergeFrom && mergeInto && (
              <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-700 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-sm">
                  <span className="font-mono font-semibold">{mergeFrom.name}</span> will be deleted and
                  all of its check records renamed to{' '}
                  <span className="font-mono font-semibold">{mergeInto.name}</span>. This cannot be undone.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={doMerge}
                disabled={merging || !mergeFrom || !mergeInto}
                className="bg-purple-700 hover:bg-purple-600"
              >
                {merging ? 'Merging...' : 'Merge'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMergeOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Close
              </Button>
            </div>
            {mergeResult && <p className="text-fg-2 text-sm">{mergeResult}</p>}
          </div>
        )}

        <div className="space-y-1">
          {visible.map(s => (
            <div
              key={s.id}
              className={`rounded-lg border p-3 ${
                s.name.toUpperCase().startsWith('UNK:')
                  ? 'border-amber-800/60 bg-amber-950/20'
                  : 'border-surface-3 bg-surface-1'
              }`}
            >
              {editingId === s.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <div className="w-28">
                      <Label className="text-fg-3 text-xs mb-1 block">Name</Label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-surface-2 border-surface-3 text-fg font-mono" />
                    </div>
                    <div className="flex-1 min-w-48">
                      <Label className="text-fg-3 text-xs mb-1 block">Address / Description</Label>
                      <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} className="bg-surface-2 border-surface-3 text-fg" />
                    </div>
                    <div className="w-32">
                      <Label className="text-fg-3 text-xs mb-1 block">Latitude</Label>
                      <Input value={editLat} onChange={e => setEditLat(e.target.value)} className="bg-surface-2 border-surface-3 text-fg font-mono text-sm" />
                    </div>
                    <div className="w-32">
                      <Label className="text-fg-3 text-xs mb-1 block">Longitude</Label>
                      <Input value={editLng} onChange={e => setEditLng(e.target.value)} className="bg-surface-2 border-surface-3 text-fg font-mono text-sm" />
                    </div>
                  </div>
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={saving || !editName.trim()} className="bg-green-700 hover:bg-green-600">
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-fg font-mono font-semibold w-20 flex-shrink-0">{s.name}</span>
                  <span className="text-fg-2 text-sm flex-1 min-w-0 truncate">{s.location || <span className="text-fg-5">no location</span>}</span>
                  {s.lat != null && s.lng != null && (
                    <a
                      href={sirenMapUrlAt(s.lat, s.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open on the county siren map"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs flex-shrink-0"
                    >
                      <MapPin className="w-3 h-3" />
                      {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                    </a>
                  )}
                  <button onClick={() => startEdit(s)} className="text-fg-4 hover:text-fg-2 p-1 flex-shrink-0" title="Edit siren">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {visible.length === 0 && (
            <p className="text-fg-4 text-sm text-center py-6">No sirens match.</p>
          )}
        </div>
      </div>
    </div>
  )
}

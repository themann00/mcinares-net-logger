'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { X, Check, AlertTriangle } from 'lucide-react'
import { unknownSirens, unkName, toRegisteredNames, registerUnknownSirens, type SirenListItem } from '@/lib/sirenClient'
import type { NetType, Station, StationType, Quadrant } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

export interface QueuedCheckin {
  id: string
  callsign: string
  firstName: string
  lastName: string
  stationType: StationType | ''
  location: string
  quadrant: Quadrant | ''
  sirenNumbers: string[]
  moved: boolean
  hasTraffic: boolean
  hasAnnouncement: boolean
  trafficText: string
  announcementText: string
  timestamp: string
  trafficTimestamp?: string
  announcementTimestamp?: string
  forceManual?: boolean
}

interface CheckinQueueProps {
  queue: QueuedCheckin[]
  onUpdate: (queue: QueuedCheckin[]) => void
  onCommit: () => void
  committing: boolean
  showTrafficInputs?: boolean
  showFlags?: boolean
  roster?: RosterEntry[]
  netType?: NetType
  stations?: Station[]
  sirens?: SirenListItem[]
}

export function CheckinQueue({ queue, onUpdate, onCommit, committing, showTrafficInputs = false, showFlags = true, roster = [], netType, stations = [], sirens = [] }: CheckinQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editData, setEditData] = useState<QueuedCheckin | null>(null)
  const [unkPrompt, setUnkPrompt] = useState<string[] | null>(null)

  function openEdit(item: QueuedCheckin) {
    setEditingId(item.id)
    setEditData({ ...item })
    setUnkPrompt(null)
  }

  async function saveEdit(confirmed = false) {
    if (!editData) return
    let data = editData
    if (netType === 'siren') {
      const unknowns = unknownSirens(data.sirenNumbers, sirens)
      if (unknowns.length > 0 && !confirmed) {
        setUnkPrompt(unknowns)
        return
      }
      if (unknowns.length > 0) {
        await registerUnknownSirens(unknowns)
        data = { ...data, sirenNumbers: toRegisteredNames(data.sirenNumbers, sirens) }
      }
    }
    onUpdate(queue.map(q => q.id === data.id ? data : q))
    setUnkPrompt(null)
    setEditingId(null)
    setEditData(null)
  }

  function deleteItem(id: string) {
    onUpdate(queue.filter(q => q.id !== id))
    setDeleteConfirmId(null)
  }

  if (queue.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-fg-3 text-xs font-semibold uppercase tracking-wider">
          Queue ({queue.length})
        </span>
        <Button
          size="sm"
          onClick={onCommit}
          disabled={committing || queue.length === 0}
          className="bg-green-700 hover:bg-green-600 gap-1 text-xs"
        >
          <Check className="w-3.5 h-3.5" />
          {committing ? 'Committing...' : 'Commit to logs'}
        </Button>
      </div>

      <div className="space-y-1">
        {queue.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-2 py-1.5 bg-surface-2 rounded-lg"
          >
            <button
              onClick={() => openEdit(item)}
              className="flex-1 text-left font-mono text-sm text-fg font-semibold hover:text-blue-300 transition-colors"
            >
              {item.callsign}
              {item.firstName && <span className="text-fg-4 text-xs font-sans ml-1">{item.firstName}</span>}
            </button>
            {showFlags && (
              <>
                {item.hasTraffic && <span className="text-yellow-500 text-xs">T</span>}
                {item.hasAnnouncement && <span className="text-teal-500 text-xs">A</span>}
                <label className="flex items-center gap-1 text-xs text-fg-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.hasTraffic}
                    onChange={e => onUpdate(queue.map(q => q.id === item.id ? { ...q, hasTraffic: e.target.checked } : q))}
                    className="rounded accent-yellow-500"
                  />
                  Tfc
                </label>
                <label className="flex items-center gap-1 text-xs text-fg-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.hasAnnouncement}
                    onChange={e => onUpdate(queue.map(q => q.id === item.id ? { ...q, hasAnnouncement: e.target.checked } : q))}
                    className="rounded accent-teal-500"
                  />
                  Ann
                </label>
              </>
            )}
          </div>
        ))}
      </div>

      {editingId && editData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditingId(null) }}>
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-fg font-semibold">Edit Queued Check-in</span>
              <button onClick={() => setEditingId(null)} className="text-fg-3 hover:text-fg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Callsign</Label>
              <CallsignAutocomplete
                value={editData.callsign}
                onChange={v => setEditData({ ...editData, callsign: v })}
                onSelect={s => {
                  // Autofill identity and per-net facts from the selected
                  // station; location falls back to N/A when unknown.
                  const known = stations.find(st => st.callsign.toUpperCase() === s.callsign.toUpperCase())
                  setEditData({
                    ...editData,
                    callsign: s.callsign,
                    firstName: s.first_name || editData.firstName,
                    lastName: s.last_name || editData.lastName,
                    location: (known?.location && known.location !== 'N/A' ? known.location : editData.location) || 'N/A',
                    stationType: (known?.station_type as StationType) || editData.stationType,
                    sirenNumbers: known?.siren_numbers?.length ? known.siren_numbers : editData.sirenNumbers,
                  })
                }}
                stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
                roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">First Name</Label>
                <Input value={editData.firstName} onChange={e => { const v = e.target.value; setEditData({ ...editData, firstName: v.charAt(0).toUpperCase() + v.slice(1) }) }} className="bg-surface-2 border-surface-3 text-fg" />
              </div>
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Last Name</Label>
                <Input value={editData.lastName} onChange={e => { const v = e.target.value; setEditData({ ...editData, lastName: v.charAt(0).toUpperCase() + v.slice(1) }) }} className="bg-surface-2 border-surface-3 text-fg" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-28">
                <Label className="text-fg-3 text-xs mb-1 block">Base / Mobile</Label>
                <Select value={editData.stationType} onValueChange={v => setEditData({ ...editData, stationType: (v || '') as StationType | '' })}>
                  <SelectTrigger className="bg-surface-2 border-surface-3 text-fg">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2 border-surface-3">
                    <SelectItem value="base" className="text-fg">Base</SelectItem>
                    <SelectItem value="mobile" className="text-fg">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-fg-3 text-xs mb-1 block">Location (where operating from)</Label>
                <Input value={editData.location} onChange={e => setEditData({ ...editData, location: e.target.value })} className="bg-surface-2 border-surface-3 text-fg" />
              </div>
            </div>

            {netType === 'siren' && (
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Siren #s (up to 4)</Label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <Input
                      key={i}
                      value={editData.sirenNumbers[i] || ''}
                      onChange={e => {
                        const next = [0, 1, 2, 3].map(j => (j === i ? e.target.value : editData.sirenNumbers[j] || ''))
                        setEditData({ ...editData, sirenNumbers: next })
                      }}
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
                onClick={() => setEditData({ ...editData, moved: false })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  !editData.moved ? 'bg-blue-600 text-white' : 'bg-surface-2 text-fg-3 hover:text-fg-1'
                }`}
              >
                Update inaccurate data
              </button>
              <button
                type="button"
                onClick={() => setEditData({ ...editData, moved: true })}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  editData.moved ? 'bg-orange-600 text-white' : 'bg-surface-2 text-fg-3 hover:text-fg-1'
                }`}
              >
                Station has moved
              </button>
            </div>

            {showFlags && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-fg-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editData.hasTraffic} onChange={e => setEditData({ ...editData, hasTraffic: e.target.checked })} className="rounded" />
                  Has Traffic
                </label>
                <label className="flex items-center gap-2 text-fg-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editData.hasAnnouncement} onChange={e => setEditData({ ...editData, hasAnnouncement: e.target.checked })} className="rounded" />
                  Has Announcement
                </label>
              </div>
            )}

            {showTrafficInputs && editData.hasTraffic && (
              <div>
                <Label className="text-yellow-400 text-xs mb-1 block">Traffic Summary</Label>
                <Textarea value={editData.trafficText} onChange={e => setEditData({ ...editData, trafficText: e.target.value })} className="bg-surface-2 border-surface-3 text-fg text-sm" rows={2} />
              </div>
            )}
            {showTrafficInputs && editData.hasAnnouncement && (
              <div>
                <Label className="text-teal-400 text-xs mb-1 block">Announcement Summary</Label>
                <Textarea value={editData.announcementText} onChange={e => setEditData({ ...editData, announcementText: e.target.value })} className="bg-surface-2 border-surface-3 text-fg text-sm" rows={2} />
              </div>
            )}

            {unkPrompt && (
              <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-sm">
                    {unkPrompt.length === 1 ? 'Siren' : 'Sirens'}{' '}
                    <span className="font-mono font-semibold">{unkPrompt.join(', ')}</span>{' '}
                    {unkPrompt.length === 1 ? 'is' : 'are'} not in the siren database. Log as{' '}
                    <span className="font-mono font-semibold">{unkPrompt.map(unkName).join(', ')}</span>?
                    They will be added to the database under those names.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(true)} className="bg-amber-700 hover:bg-amber-600 text-xs h-7">
                    Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setUnkPrompt(null)} className="border-surface-4 bg-surface-2 text-fg-1 text-xs h-7">
                    Go Back
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              {deleteConfirmId === editData.id ? (
                <div className="flex gap-2 items-center text-sm">
                  <span className="text-red-400">Delete?</span>
                  <Button size="sm" onClick={() => { deleteItem(editData.id); setEditingId(null) }} className="bg-red-700 hover:bg-red-600 text-xs h-7">Yes</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-surface-4 bg-surface-2 text-fg-1 text-xs h-7">No</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(editData.id)} className="border-red-800 text-red-400 hover:bg-red-950 text-xs">Delete</Button>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg">Cancel</Button>
                <Button size="sm" onClick={() => saveEdit()} className="bg-blue-700 hover:bg-blue-600">Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

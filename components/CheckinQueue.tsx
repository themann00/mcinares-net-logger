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
import { X, Check } from 'lucide-react'
import type { StationType, Quadrant } from '@/types'

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
}

export function CheckinQueue({ queue, onUpdate, onCommit, committing, showTrafficInputs = false, showFlags = true, roster = [] }: CheckinQueueProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editData, setEditData] = useState<QueuedCheckin | null>(null)

  function openEdit(item: QueuedCheckin) {
    setEditingId(item.id)
    setEditData({ ...item })
  }

  function saveEdit() {
    if (!editData) return
    onUpdate(queue.map(q => q.id === editData.id ? editData : q))
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
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
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
            className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded-lg"
          >
            <button
              onClick={() => openEdit(item)}
              className="flex-1 text-left font-mono text-sm text-white font-semibold hover:text-blue-300 transition-colors"
            >
              {item.callsign}
              {item.firstName && <span className="text-gray-500 text-xs font-sans ml-1">{item.firstName}</span>}
            </button>
            {showFlags && (
              <>
                {item.hasTraffic && <span className="text-yellow-500 text-xs">T</span>}
                {item.hasAnnouncement && <span className="text-teal-500 text-xs">A</span>}
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.hasTraffic}
                    onChange={e => onUpdate(queue.map(q => q.id === item.id ? { ...q, hasTraffic: e.target.checked } : q))}
                    className="rounded accent-yellow-500"
                  />
                  Tfc
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Edit Queued Check-in</span>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-gray-400 text-xs mb-1 block">Callsign</Label>
                <CallsignAutocomplete
                  value={editData.callsign}
                  onChange={v => setEditData({ ...editData, callsign: v })}
                  onSelect={s => setEditData({
                    ...editData,
                    callsign: s.callsign,
                    firstName: s.first_name || editData.firstName,
                    lastName: s.last_name || editData.lastName,
                  })}
                  roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
                />
              </div>
              <div className="w-28">
                <Label className="text-gray-400 text-xs mb-1 block">Type</Label>
                <Select value={editData.stationType} onValueChange={v => setEditData({ ...editData, stationType: (v || '') as StationType | '' })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="base" className="text-white">Base</SelectItem>
                    <SelectItem value="mobile" className="text-white">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">First Name</Label>
                <Input value={editData.firstName} onChange={e => { const v = e.target.value; setEditData({ ...editData, firstName: v.charAt(0).toUpperCase() + v.slice(1) }) }} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Last Name</Label>
                <Input value={editData.lastName} onChange={e => { const v = e.target.value; setEditData({ ...editData, lastName: v.charAt(0).toUpperCase() + v.slice(1) }) }} className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
              <Input value={editData.location} onChange={e => setEditData({ ...editData, location: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
            </div>

            {showFlags && (
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input type="checkbox" checked={editData.hasTraffic} onChange={e => setEditData({ ...editData, hasTraffic: e.target.checked })} className="rounded" />
                  Has Traffic
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                  <input type="checkbox" checked={editData.hasAnnouncement} onChange={e => setEditData({ ...editData, hasAnnouncement: e.target.checked })} className="rounded" />
                  Has Announcement
                </label>
              </div>
            )}

            {showTrafficInputs && editData.hasTraffic && (
              <div>
                <Label className="text-yellow-400 text-xs mb-1 block">Traffic Summary</Label>
                <Textarea value={editData.trafficText} onChange={e => setEditData({ ...editData, trafficText: e.target.value })} className="bg-gray-800 border-gray-700 text-white text-sm" rows={2} />
              </div>
            )}
            {showTrafficInputs && editData.hasAnnouncement && (
              <div>
                <Label className="text-teal-400 text-xs mb-1 block">Announcement Summary</Label>
                <Textarea value={editData.announcementText} onChange={e => setEditData({ ...editData, announcementText: e.target.value })} className="bg-gray-800 border-gray-700 text-white text-sm" rows={2} />
              </div>
            )}

            <div className="flex justify-between pt-2">
              {deleteConfirmId === editData.id ? (
                <div className="flex gap-2 items-center text-sm">
                  <span className="text-red-400">Delete?</span>
                  <Button size="sm" onClick={() => { deleteItem(editData.id); setEditingId(null) }} className="bg-red-700 hover:bg-red-600 text-xs h-7">Yes</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-gray-600 bg-gray-800 text-gray-200 text-xs h-7">No</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(editData.id)} className="border-red-800 text-red-400 hover:bg-red-950 text-xs">Delete</Button>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white">Cancel</Button>
                <Button size="sm" onClick={saveEdit} className="bg-blue-700 hover:bg-blue-600">Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

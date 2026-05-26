'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface RosterEntry {
  id: string
  callsign: string
  first_name: string | null
  last_name: string | null
  email: string | null
  checkin_count: number
  last_checkin: string | null
}

type SortKey = 'callsign' | 'first_name' | 'last_name' | 'email' | 'checkin_count' | 'last_checkin'

export function Roster({ superAdmin = false, fullPage = false }: { superAdmin?: boolean; fullPage?: boolean }) {
  const [entries, setEntries] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('callsign')
  const [sortAsc, setSortAsc] = useState(true)
  const [pageSize, setPageSize] = useState(fullPage ? 0 : 10)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<RosterEntry | null>(null)
  const [editCallsign, setEditCallsign] = useState('')
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function fetchRoster() {
    const res = await fetch('/api/roster')
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchRoster() }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
    const cmp = String(av).localeCompare(String(bv))
    return sortAsc ? cmp : -cmp
  })

  const totalPages = pageSize === 0 ? 1 : Math.ceil(sorted.length / pageSize)
  const start = pageSize === 0 ? 0 : page * pageSize
  const visible = pageSize === 0 ? sorted : sorted.slice(start, start + pageSize)
  const showingFrom = sorted.length === 0 ? 0 : start + 1
  const showingTo = Math.min(start + (pageSize || sorted.length), sorted.length)

  function openEdit(entry: RosterEntry) {
    setEditing(entry)
    setEditCallsign(entry.callsign)
    setEditFirst(entry.first_name || '')
    setEditLast(entry.last_name || '')
    setEditEmail(entry.email || '')
    setDeleteConfirm(false)
    setDeleteInput('')
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    await fetch('/api/roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        callsign: editCallsign,
        first_name: editFirst,
        last_name: editLast,
        email: editEmail,
      }),
    })
    setSaving(false)
    setEditing(null)
    fetchRoster()
  }

  async function handleDelete() {
    if (!editing || (!superAdmin && deleteInput !== 'DELETE')) return
    setDeleting(true)
    await fetch('/api/roster', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id }),
    })
    setDeleting(false)
    setEditing(null)
    fetchRoster()
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field
    return (
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {label}
        {active && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    )
  }

  if (loading) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {fullPage ? (
            <h2 className="text-gray-300 font-medium">Roster — {showingFrom}-{showingTo} of {entries.length}</h2>
          ) : (
            <h2 className="text-gray-300 font-medium">
              <a href="/roster" className="hover:text-white underline underline-offset-2">Roster</a>
              {' '}<span className="text-gray-500">— {showingFrom}-{showingTo} of {entries.length}</span>
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-gray-500 text-xs">{page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </>
          )}
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={0}>All</option>
          </select>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No operators in roster yet.</p>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-3 py-2 text-left"><SortHeader label="Call" field="callsign" /></th>
                  <th className="px-3 py-2 text-left"><SortHeader label="First" field="first_name" /></th>
                  <th className="px-3 py-2 text-left"><SortHeader label="Last" field="last_name" /></th>
                  <th className="px-3 py-2 text-left"><SortHeader label="Email" field="email" /></th>
                  <th className="px-3 py-2 text-right"><SortHeader label="#" field="checkin_count" /></th>
                  <th className="px-3 py-2 text-left"><SortHeader label="Last Check-In" field="last_checkin" /></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(entry => (
                  <tr
                    key={entry.id}
                    onClick={() => openEdit(entry)}
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 font-mono text-white font-semibold">{entry.callsign}</td>
                    <td className="px-3 py-1.5 text-gray-300">{entry.first_name || ''}</td>
                    <td className="px-3 py-1.5 text-gray-300">{entry.last_name || ''}</td>
                    <td className="px-3 py-1.5 text-gray-400">
                      {entry.email ? (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            e.preventDefault()
                            window.open(`mailto:${entry.email}`, '_self')
                          }}
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-left"
                        >
                          {entry.email}
                        </button>
                      ) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{entry.checkin_count}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">
                      {entry.last_checkin ? format(new Date(entry.last_checkin), 'MMM d, yyyy') : ''}
                    </td>
                    <td className="px-1 py-1.5">
                      {(!entry.first_name || !entry.last_name) && (
                        <a
                          href={`https://www.qrz.com/db/${entry.callsign}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-blue-500 hover:text-blue-400 text-xs"
                        >
                          QRZ
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">Edit Operator</span>
                <a
                  href={`https://www.qrz.com/db/${editing.callsign}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  QRZ
                </a>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Callsign</Label>
              <Input
                value={editCallsign}
                onChange={e => setEditCallsign(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">First Name</Label>
                <Input
                  value={editFirst}
                  onChange={e => setEditFirst(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-1 block">Last Name</Label>
                <Input
                  value={editLast}
                  onChange={e => setEditLast(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Email</Label>
              <Input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
                type="email"
              />
            </div>

            <div className="text-gray-500 text-xs">
              Check-ins: {editing.checkin_count}
              {editing.last_checkin && ` · Last: ${format(new Date(editing.last_checkin), 'MMM d, yyyy')}`}
            </div>

            <div className="flex gap-2 justify-between">
              <div>
                {deleteConfirm ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value.toUpperCase())}
                      placeholder="Type DELETE"
                      className="bg-gray-800 border-gray-700 text-white font-mono w-28 h-8 text-xs"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleDelete()
                        if (e.key === 'Escape') setDeleteConfirm(false)
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteInput !== 'DELETE' || deleting}
                      className="bg-red-700 hover:bg-red-600 text-white h-8 text-xs"
                    >
                      {deleting ? '...' : 'Confirm'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => superAdmin ? handleDelete() : setDeleteConfirm(true)}
                    disabled={deleting}
                    className="border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? '...' : 'Delete'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(null)}
                  className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-700 hover:bg-blue-600"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

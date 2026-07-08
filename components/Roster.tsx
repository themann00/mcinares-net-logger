'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UppercaseInput } from '@/components/UppercaseInput'
import { ChevronUp, ChevronDown, X, Trash2, Pencil } from 'lucide-react'
import { format } from 'date-fns'

interface RosterEntry {
  id: string
  callsign: string
  first_name: string | null
  last_name: string | null
  email: string | null
  license: string | null
  address: string | null
  county: string | null
  checkin_count: number
  last_checkin: string | null
}

type SortKey = 'callsign' | 'first_name' | 'last_name' | 'license' | 'address' | 'county' | 'checkin_count' | 'last_checkin' | 'lookup'

type ToggleColumn = 'first_name' | 'last_name' | 'address' | 'county' | 'license' | 'last_checkin' | 'checkin_count'

const TOGGLE_COLUMNS: { key: ToggleColumn; label: string }[] = [
  { key: 'first_name', label: 'First' },
  { key: 'last_name', label: 'Last' },
  { key: 'address', label: 'Address' },
  { key: 'county', label: 'County' },
  { key: 'license', label: 'License' },
  { key: 'last_checkin', label: 'Last Check-In' },
  { key: 'checkin_count', label: '# of Check-Ins' },
]

const DEFAULT_COLUMNS: Record<ToggleColumn, boolean> = {
  first_name: true,
  last_name: true,
  address: false,
  county: false,
  license: false,
  last_checkin: true,
  checkin_count: false,
}

export function Roster({ superAdmin = false, fullPage = false }: { superAdmin?: boolean; fullPage?: boolean }) {
  const [entries, setEntries] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('callsign')
  const [sortAsc, setSortAsc] = useState(true)
  const [pageSize, setPageSize] = useState(fullPage ? 0 : 10)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sortBySuffix, setSortBySuffix] = useState(true)
  const [editing, setEditing] = useState<RosterEntry | null>(null)
  const [editCallsign, setEditCallsign] = useState('')
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLicense, setEditLicense] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCounty, setEditCounty] = useState('')
  const [columns, setColumns] = useState<Record<ToggleColumn, boolean>>(DEFAULT_COLUMNS)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [conflict, setConflict] = useState<{ id: string; callsign: string } | null>(null)
  const [renameOther, setRenameOther] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function fetchRoster() {
    const res = await fetch('/api/roster')
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchRoster() }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('roster_columns')
      if (saved) setColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(saved) })
    } catch { /* ignore bad saved state */ }
  }, [])

  function toggleColumn(key: ToggleColumn) {
    setColumns(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('roster_columns', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const filtered = search.trim()
    ? entries.filter(e => {
        const q = search.toUpperCase()
        return e.callsign.toUpperCase().includes(q) ||
          (e.first_name || '').toUpperCase().includes(q) ||
          (e.last_name || '').toUpperCase().includes(q)
      })
    : entries

  function getSuffix(callsign: string) {
    const match = callsign.match(/\d([A-Z]+)$/)
    return match ? match[1] : callsign
  }

  function compareCallsigns(a: string, b: string) {
    if (sortBySuffix) return getSuffix(a).localeCompare(getSuffix(b))
    return a.localeCompare(b)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'lookup') {
      const aMissing = !a.first_name || !a.last_name ? 0 : 1
      const bMissing = !b.first_name || !b.last_name ? 0 : 1
      const cmp = aMissing - bMissing
      if (cmp !== 0) return sortAsc ? cmp : -cmp
      return compareCallsigns(a.callsign, b.callsign)
    }
    if (sortKey === 'callsign') {
      const cmp = compareCallsigns(a.callsign, b.callsign)
      return sortAsc ? cmp : -cmp
    }
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
    setEditLicense(entry.license || '')
    setEditAddress(entry.address || '')
    setEditCounty(entry.county || '')
    setDeleteConfirm(false)
    setDeleteInput('')
    setConflict(null)
    setErrorMsg('')
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    setErrorMsg('')
    const res = await fetch('/api/roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        callsign: editCallsign,
        first_name: editFirst,
        last_name: editLast,
        email: editEmail,
        license: editLicense,
        address: editAddress,
        county: editCounty,
      }),
    })
    setSaving(false)
    if (res.status === 409) {
      const body = await res.json()
      if (body.conflict) {
        setConflict(body.conflict)
        setRenameOther(`${body.conflict.callsign}-OLD`)
        return
      }
      setErrorMsg(body.error || 'Conflict')
      return
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setErrorMsg(body?.error || 'Save failed')
      return
    }
    setEditing(null)
    fetchRoster()
  }

  async function handleMerge() {
    if (!editing || !conflict) return
    setSaving(true)
    const res = await fetch('/api/roster/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: editing.id, target_id: conflict.id }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setErrorMsg(body?.error || 'Merge failed')
      return
    }
    setConflict(null)
    setEditing(null)
    fetchRoster()
  }

  async function handleRenameOther() {
    if (!editing || !conflict || !renameOther.trim()) return
    setSaving(true)
    setErrorMsg('')
    // Move the existing station out of the way, then retry the original rename.
    const res = await fetch('/api/roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: conflict.id, callsign: renameOther.trim() }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setSaving(false)
      setErrorMsg(body?.error || 'Rename failed')
      return
    }
    setConflict(null)
    setSaving(false)
    await handleSave()
  }

  async function handleDelete() {
    if (!editing || (!superAdmin && deleteInput !== 'DELETE')) return
    setDeleting(true)
    setErrorMsg('')
    const res = await fetch('/api/roster', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id }),
    })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setErrorMsg(body?.error || 'Delete failed')
      setDeleteConfirm(false)
      return
    }
    setEditing(null)
    fetchRoster()
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field
    return (
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          active ? 'text-blue-400' : 'text-fg-4 hover:text-fg-2'
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
            <h2 className="text-fg-2 font-medium">Roster — {showingFrom}-{showingTo} of {filtered.length}{search && ` (${entries.length} total)`}</h2>
          ) : (
            <h2 className="text-fg-2 font-medium">
              <a href="/roster" className="hover:text-fg underline underline-offset-2">Roster</a>
              {' '}<span className="text-fg-4">— {showingFrom}-{showingTo} of {filtered.length}{search && ` (${entries.length} total)`}</span>
            </h2>
          )}
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search..."
            className="bg-surface-2 border border-surface-3 text-fg-1 text-xs rounded px-2 py-1 w-28"
          />
          <button
            onClick={() => setSortBySuffix(!sortBySuffix)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              sortBySuffix
                ? 'bg-blue-600/20 border-blue-600 text-blue-300'
                : 'bg-surface-2 border-surface-3 text-fg-3 hover:text-fg-1'
            }`}
          >
            {sortBySuffix ? 'Suffix' : 'Callsign'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-xs bg-surface-2 border border-surface-3 rounded text-fg-2 hover:text-fg disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-fg-4 text-xs">{page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs bg-surface-2 border border-surface-3 rounded text-fg-2 hover:text-fg disabled:opacity-40"
              >
                Next
              </button>
            </>
          )}
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="bg-surface-2 border border-surface-3 text-fg-1 text-xs rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={0}>All</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {TOGGLE_COLUMNS.map(col => (
          <label key={col.key} className="flex items-center gap-1.5 text-xs text-fg-3 cursor-pointer select-none hover:text-fg-1">
            <input
              type="checkbox"
              checked={columns[col.key]}
              onChange={() => toggleColumn(col.key)}
              className="accent-blue-600 w-3.5 h-3.5"
            />
            {col.label}
          </label>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-fg-4 text-sm">No operators in roster yet.</p>
      ) : (
        <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3">
                  <th className="px-3 py-2 text-left"><SortHeader label="Call" field="callsign" /></th>
                  {columns.first_name && <th className="px-3 py-2 text-left"><SortHeader label="First" field="first_name" /></th>}
                  {columns.last_name && <th className="px-3 py-2 text-left"><SortHeader label="Last" field="last_name" /></th>}
                  {columns.address && <th className="px-3 py-2 text-left"><SortHeader label="Address" field="address" /></th>}
                  {columns.county && <th className="px-3 py-2 text-left"><SortHeader label="County" field="county" /></th>}
                  {columns.license && <th className="px-3 py-2 text-left"><SortHeader label="License" field="license" /></th>}
                  {columns.checkin_count && <th className="px-3 py-2 text-right"><SortHeader label="#" field="checkin_count" /></th>}
                  {columns.last_checkin && <th className="px-3 py-2 text-left"><SortHeader label="Last Check-In" field="last_checkin" /></th>}
                  <th className="px-1 py-2"><SortHeader label="Lookup" field="lookup" /></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(entry => (
                  <tr
                    key={entry.id}
                    className="border-b border-surface-2 hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-3 py-1.5">
                      <span className="font-mono text-fg font-semibold">{entry.callsign}</span>
                      <button
                        onClick={() => openEdit(entry)}
                        className="ml-1.5 text-fg-5 hover:text-fg-2 transition-colors align-middle"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3 inline" />
                      </button>
                      {superAdmin && (
                        <button
                          onClick={async () => {
                            const res = await fetch('/api/roster', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: entry.id }),
                            })
                            if (!res.ok) {
                              const body = await res.json().catch(() => null)
                              window.alert(body?.error || 'Delete failed')
                              return
                            }
                            fetchRoster()
                          }}
                          className="ml-1 text-fg-5 hover:text-red-400 transition-colors align-middle"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      )}
                    </td>
                    {columns.first_name && <td className="px-3 py-1.5 text-fg-2">{entry.first_name || ''}</td>}
                    {columns.last_name && <td className="px-3 py-1.5 text-fg-2">{entry.last_name || ''}</td>}
                    {columns.address && <td className="px-3 py-1.5 text-fg-3">{entry.address || ''}</td>}
                    {columns.county && <td className="px-3 py-1.5 text-fg-3">{entry.county || ''}</td>}
                    {columns.license && <td className="px-3 py-1.5 text-fg-3">{entry.license || ''}</td>}
                    {columns.checkin_count && <td className="px-3 py-1.5 text-right text-fg-2">{entry.checkin_count}</td>}
                    {columns.last_checkin && (
                      <td className="px-3 py-1.5 text-fg-4 text-xs">
                        {entry.last_checkin ? format(new Date(entry.last_checkin), 'MMM d, yyyy') : ''}
                      </td>
                    )}
                    <td className="px-1 py-1.5">
                      {(!entry.first_name || !entry.last_name) && (
                        <a
                          href={`https://callook.info/${entry.callsign}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-blue-500 hover:text-blue-400 text-xs"
                        >
                          Lookup
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
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-fg font-semibold">Edit Operator</span>
                <a
                  href={`https://callook.info/${editing.callsign}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  Lookup
                </a>
              </div>
              <button onClick={() => setEditing(null)} className="text-fg-3 hover:text-fg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Callsign</Label>
              <UppercaseInput
                value={editCallsign}
                onValueChange={setEditCallsign}
                className="bg-surface-2 border-surface-3 text-fg uppercase font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">First Name</Label>
                <Input
                  value={editFirst}
                  onChange={e => { const v = e.target.value; setEditFirst(v.charAt(0).toUpperCase() + v.slice(1)) }}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">Last Name</Label>
                <Input
                  value={editLast}
                  onChange={e => { const v = e.target.value; setEditLast(v.charAt(0).toUpperCase() + v.slice(1)) }}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
            </div>
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Email</Label>
              <Input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="bg-surface-2 border-surface-3 text-fg"
                type="email"
              />
            </div>
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Address</Label>
              <Input
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                className="bg-surface-2 border-surface-3 text-fg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">County</Label>
                <Input
                  value={editCounty}
                  onChange={e => setEditCounty(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
              <div>
                <Label className="text-fg-3 text-xs mb-1 block">License</Label>
                <Input
                  value={editLicense}
                  onChange={e => setEditLicense(e.target.value)}
                  className="bg-surface-2 border-surface-3 text-fg"
                />
              </div>
            </div>

            <div className="text-fg-4 text-xs">
              Check-ins: {editing.checkin_count}
              {editing.last_checkin && ` · Last: ${format(new Date(editing.last_checkin), 'MMM d, yyyy')}`}
            </div>

            {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

            {conflict && (() => {
              const other = entries.find(e => e.id === conflict.id)
              return (
                <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3 space-y-3">
                  <p className="text-sm text-fg-1">
                    <span className="font-mono font-semibold text-fg">{conflict.callsign}</span> already exists in the roster
                    {other ? ` (${other.checkin_count} check-in${other.checkin_count === 1 ? '' : 's'})` : ''}.
                    {' '}This entry has {editing.checkin_count} check-in{editing.checkin_count === 1 ? '' : 's'}.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Button size="sm" onClick={handleMerge} disabled={saving} className="bg-blue-700 hover:bg-blue-600 justify-start">
                      Merge {editing.callsign} into {conflict.callsign} (all history combines, {editing.callsign} deleted)
                    </Button>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={renameOther}
                        onChange={e => setRenameOther(e.target.value.toUpperCase())}
                        className="bg-surface-2 border-surface-3 text-fg font-mono h-8 text-xs flex-1"
                      />
                      <Button size="sm" onClick={handleRenameOther} disabled={saving || !renameOther.trim()} className="bg-amber-700 hover:bg-amber-600 h-8 text-xs">
                        Rename {conflict.callsign} to this, keep both
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConflict(null)}
                      disabled={saving}
                      className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg justify-start"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-2 justify-between">
              <div>
                {deleteConfirm ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value.toUpperCase())}
                      placeholder="Type DELETE"
                      className="bg-surface-2 border-surface-3 text-fg font-mono w-28 h-8 text-xs"
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
                  className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
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

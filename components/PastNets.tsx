'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Pencil, Check, X, Trash2, BookOpen, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import type { Net, Station, LogEntry, LogEntryType } from '@/types'

const TYPE_CONFIG: Record<LogEntryType, { label: string; color: string }> = {
  net_open: { label: 'OPEN', color: 'text-green-400' },
  checkin: { label: 'CHECK-IN', color: 'text-blue-400' },
  report: { label: 'REPORT', color: 'text-orange-400' },
  traffic: { label: 'TRAFFIC', color: 'text-yellow-400' },
  announcement: { label: 'ANN.', color: 'text-teal-400' },
  liaison: { label: 'LIAISON', color: 'text-purple-400' },
  alt_nc: { label: 'ALT NC', color: 'text-purple-400' },
  continuity: { label: 'CONT.', color: 'text-cyan-400' },
  circle_back: { label: 'UPDATE', color: 'text-amber-400' },
  late_checkin: { label: 'LATE', color: 'text-blue-300' },
  station_moved: { label: 'MOVED', color: 'text-orange-300' },
  net_close: { label: 'CLOSE', color: 'text-red-400' },
  note: { label: 'NOTE', color: 'text-gray-400' },
}

const NET_LABELS: Record<string, string> = {
  ares: 'ARES Net',
  skywarn: 'Skywarn Net',
  siren: 'Siren Test Net',
}

interface PastNetsProps {
  nets: Net[]
  onDelete: () => void
  superAdmin?: boolean
}

export function PastNets({ nets, onDelete, superAdmin = false }: PastNetsProps) {
  const isSuperAdmin = superAdmin
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [logCache, setLogCache] = useState<Record<string, LogEntry[]>>({})
  const [stationCache, setStationCache] = useState<Record<string, Station[]>>({})
  const [logPopupNetId, setLogPopupNetId] = useState<string | null>(null)
  const [loadingLog, setLoadingLog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null)
  const [insertType, setInsertType] = useState<LogEntryType>('note')
  const [insertContent, setInsertContent] = useState('')
  const [insertTimestamp, setInsertTimestamp] = useState('')
  const [insertSaving, setInsertSaving] = useState(false)
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(0)

  const closedNets = nets.filter(n => n.closed_at && !n.testing)
  if (closedNets.length === 0) return null

  async function toggleExpand(net: Net) {
    const next = new Set(expandedIds)
    if (next.has(net.id)) {
      next.delete(net.id)
      setExpandedIds(next)
      return
    }
    next.add(net.id)
    setExpandedIds(next)
    setLoadingLog(true)
    const [logRes, stRes] = await Promise.all([
      logCache[net.id] ? null : fetch(`/api/nets/${net.id}/log`),
      stationCache[net.id] ? null : fetch(`/api/nets/${net.id}/stations`),
    ])
    if (logRes?.ok) {
      const entries = await logRes.json()
      setLogCache(prev => ({ ...prev, [net.id]: entries }))
    }
    if (stRes?.ok) {
      const stations: Station[] = await stRes.json()
      stations.sort((a, b) => {
        const sa = a.callsign.match(/\d([A-Z]+)$/)?.[1] || a.callsign
        const sb = b.callsign.match(/\d([A-Z]+)$/)?.[1] || b.callsign
        return sa.localeCompare(sb)
      })
      setStationCache(prev => ({ ...prev, [net.id]: stations }))
    }
    setLoadingLog(false)
  }

  async function saveEdit(netId: string, entryId: string) {
    if (!editContent.trim()) return
    setSaving(true)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId, content: editContent }),
    })
    setSaving(false)
    setEditingId(null)
    const res = await fetch(`/api/nets/${netId}/log`)
    if (res.ok) {
      const entries = await res.json()
      setLogCache(prev => ({ ...prev, [netId]: entries }))
    }
  }

  function startInsert(idx: number, entries: LogEntry[]) {
    const current = entries[idx]
    const next = entries[idx + 1]
    const t1 = new Date(current.timestamp).getTime()
    const t2 = next ? new Date(next.timestamp).getTime() : t1 + 1000
    const mid = new Date(Math.floor((t1 + t2) / 2))
    setInsertAfterIdx(idx)
    setInsertType('note')
    setInsertContent('')
    setInsertTimestamp(format(mid, "yyyy-MM-dd'T'HH:mm:ss"))
  }

  async function saveInsert(netId: string) {
    if (!insertContent.trim()) return
    setInsertSaving(true)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: insertType,
        content: insertContent.trim(),
        timestamp: new Date(insertTimestamp).toISOString(),
      }),
    })
    setInsertSaving(false)
    setInsertAfterIdx(null)
    const res = await fetch(`/api/nets/${netId}/log`)
    if (res.ok) {
      setLogCache(prev => ({ ...prev, [netId]: res.ok ? [] : [] }))
      const entries = await res.json()
      setLogCache(prev => ({ ...prev, [netId]: entries }))
    }
  }

  function getDeletePhrase(net: Net) {
    return `DELETE ${format(new Date(net.started_at), 'yyyy-MM-dd')}`
  }

  async function handleDelete(net: Net) {
    if (!isSuperAdmin && deleteInput !== getDeletePhrase(net)) return
    setDeleting(true)
    await fetch(`/api/nets/${net.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteConfirmId(null)
    setDeleteInput('')
    setExpandedIds(prev => { const next = new Set(prev); next.delete(net.id); return next })
    onDelete()
  }

  const totalPages = pageSize === 0 ? 1 : Math.ceil(closedNets.length / pageSize)
  const start = pageSize === 0 ? 0 : page * pageSize
  const visible = pageSize === 0 ? closedNets : closedNets.slice(start, start + pageSize)
  const showingFrom = closedNets.length === 0 ? 0 : start + 1
  const showingTo = Math.min(start + (pageSize || closedNets.length), closedNets.length)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-gray-300 font-medium">
          Previous Nets <span className="text-gray-500">— {showingFrom}-{showingTo} of {closedNets.length}</span>
        </h2>
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
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={0}>All</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        {visible.map(net => {
          const isExpanded = expandedIds.has(net.id)
          const logEntries = logCache[net.id] || []
          const isDeleting = deleteConfirmId === net.id
          const typeColor =
            net.type === 'ares' ? 'bg-blue-700' :
            net.type === 'skywarn' ? 'bg-orange-700' : 'bg-red-700'

          return (
            <div key={net.id} className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
              <div className="flex items-center">
                <button
                  onClick={() => toggleExpand(net)}
                  className="flex-1 flex items-center gap-3 p-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <span className={`${typeColor} text-white text-xs font-semibold px-2 py-0.5 rounded`}>
                    {net.type.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm font-medium">
                      {NET_LABELS[net.type] || net.type}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      {format(new Date(net.started_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs">{net.net_controller}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(net)
                    }}
                    className="p-3 text-gray-700 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Delete net"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-gray-800 p-3">
                  {loadingLog ? (
                    <p className="text-gray-500 text-sm text-center py-2">Loading...</p>
                  ) : (
                    <div>
                      {(() => {
                        const entries = logCache[net.id] || []
                        const seen = new Set<string>()
                        const callsigns: string[] = []
                        for (const e of entries) {
                          if (e.entry_type !== 'checkin' && e.entry_type !== 'late_checkin') continue
                          const m = e.content.match(/^(?:MANUAL:\s*)?([A-Z0-9/]+)\s/)
                          if (m && !seen.has(m[1])) { seen.add(m[1]); callsigns.push(m[1]) }
                        }
                        callsigns.sort((a, b) => {
                          const sa = a.match(/\d([A-Z]+)$/)?.[1] || a
                          const sb = b.match(/\d([A-Z]+)$/)?.[1] || b
                          return sa.localeCompare(sb)
                        })
                        return (
                          <>
                            <div className="text-gray-400 text-xs mb-2">
                              {callsigns.length} station{callsigns.length !== 1 ? 's' : ''} checked in
                            </div>
                            {callsigns.length > 0 && (() => {
                              const count = callsigns.length
                              const cols = count <= 5 ? 1 : count <= 10 ? 2 : count <= 15 ? 3 : count <= 20 ? 4 : 5
                              const colClass = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][cols - 1]
                              return (
                                <div className={`grid ${colClass} gap-1 mb-3`}>
                                  {callsigns.map(cs => (
                                    <span key={cs} className="font-mono text-xs text-gray-300 truncate">
                                      {cs}
                                    </span>
                                  ))}
                                </div>
                              )
                            })()}
                          </>
                        )
                      })()}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-800">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLogPopupNetId(net.id)}
                      className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Logs
                    </Button>
                    <Link href={`/net/${net.id}/report`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Report
                      </Button>
                    </Link>
                    {isDeleting ? (
                      <div className="space-y-2">
                        <p className="text-red-400 text-sm">
                          Type <span className="font-mono font-bold">{getDeletePhrase(net)}</span> to confirm:
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={deleteInput}
                            onChange={e => setDeleteInput(e.target.value)}
                            placeholder={getDeletePhrase(net)}
                            className="bg-gray-800 border-gray-700 text-white text-sm font-mono"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleDelete(net)
                              if (e.key === 'Escape') {
                                setDeleteConfirmId(null)
                                setDeleteInput('')
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleDelete(net)}
                            disabled={deleteInput !== getDeletePhrase(net) || deleting}
                            className="bg-red-700 hover:bg-red-600 text-white"
                          >
                            {deleting ? 'Deleting...' : 'Confirm'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeleteConfirmId(null)
                              setDeleteInput('')
                            }}
                            className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => isSuperAdmin ? handleDelete(net) : setDeleteConfirmId(net.id)}
                        disabled={deleting}
                        className="border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300 gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleting ? 'Deleting...' : 'Delete Net'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {logPopupNetId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">Net Log</h3>
              <button onClick={() => setLogPopupNetId(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
              {(logCache[logPopupNetId] || []).map((entry, idx, arr) => {
                const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }
                const isEditingThis = editingId === entry.id
                const isInsertingAfter = insertAfterIdx === idx
                return (
                  <div key={entry.id}>
                    <div className="group flex gap-2 text-sm py-1 border-b border-gray-800/50">
                      <span className="text-gray-600 font-mono text-xs flex-shrink-0 pt-0.5">
                        {format(new Date(entry.timestamp), 'HH:mm:ss')}
                      </span>
                      <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {isSuperAdmin && isEditingThis ? (
                        <div className="flex-1 flex gap-1">
                          <input
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(logPopupNetId, entry.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white text-sm"
                            autoFocus
                            disabled={saving}
                          />
                          <button onClick={() => saveEdit(logPopupNetId, entry.id)} disabled={saving} className="text-green-400 hover:text-green-300 p-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 break-all flex-1">{entry.content}</span>
                      )}
                      {isSuperAdmin && !isEditingThis && (
                        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startInsert(idx, arr)}
                            className="text-gray-600 hover:text-green-400 p-0.5"
                            title="Insert log entry after this line"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setEditingId(entry.id); setEditContent(entry.content) }}
                            className="text-gray-600 hover:text-gray-300 p-0.5"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={async () => {
                              await fetch(`/api/nets/${logPopupNetId}/log`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ entry_id: entry.id }),
                              })
                              const res = await fetch(`/api/nets/${logPopupNetId}/log`)
                              if (res.ok) {
                                const entries = await res.json()
                                setLogCache(prev => ({ ...prev, [logPopupNetId]: entries }))
                              }
                            }}
                            className="text-gray-700 hover:text-red-400 p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isSuperAdmin && isInsertingAfter && (
                      <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-3 my-1 space-y-2">
                        <div className="flex gap-2">
                          <div className="w-40">
                            <label className="text-gray-500 text-xs block mb-0.5">Timestamp</label>
                            <input
                              type="datetime-local"
                              step="1"
                              value={insertTimestamp}
                              onChange={e => setInsertTimestamp(e.target.value)}
                              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs font-mono"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-gray-500 text-xs block mb-0.5">Type</label>
                            <Select value={insertType} onValueChange={v => setInsertType(v as LogEntryType)}>
                              <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 border-gray-700 max-h-48">
                                {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                                  <SelectItem key={key} value={key} className="text-white text-xs">{val.label}</SelectItem>
                                ))}
                                <SelectItem value="station_moved" className="text-white text-xs">MOVED</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs block mb-0.5">Content</label>
                          <input
                            value={insertContent}
                            onChange={e => setInsertContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveInsert(logPopupNetId)
                              if (e.key === 'Escape') setInsertAfterIdx(null)
                            }}
                            placeholder="Log entry content..."
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveInsert(logPopupNetId)} disabled={insertSaving || !insertContent.trim()} className="bg-green-700 hover:bg-green-600 text-xs h-7">
                            {insertSaving ? 'Adding...' : 'Add Log Entry'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setInsertAfterIdx(null)} className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs h-7">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

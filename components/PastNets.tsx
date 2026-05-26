'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Pencil, Check, X, Trash2, BookOpen, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
                        const netStations = stationCache[net.id] || []
                        return (
                          <>
                            <div className="text-gray-400 text-xs mb-2">
                              {netStations.length} station{netStations.length !== 1 ? 's' : ''} checked in
                            </div>
                            {netStations.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 mb-3">
                                {netStations.map(s => (
                                  <span key={s.id} className="font-mono text-xs text-gray-300 truncate">
                                    {s.callsign}
                                  </span>
                                ))}
                              </div>
                            )}
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
              {(logCache[logPopupNetId] || []).map(entry => {
                const cfg = TYPE_CONFIG[entry.entry_type] || { label: entry.entry_type.toUpperCase(), color: 'text-gray-400' }
                return (
                  <div key={entry.id} className="flex gap-2 text-sm py-1 border-b border-gray-800/50 last:border-0">
                    <span className="text-gray-600 font-mono text-xs flex-shrink-0 pt-0.5">
                      {format(new Date(entry.timestamp), 'HH:mm:ss')}
                    </span>
                    <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-gray-400 break-all flex-1">{entry.content}</span>
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

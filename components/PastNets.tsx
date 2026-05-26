'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Pencil, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Net, LogEntry, LogEntryType } from '@/types'

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
}

export function PastNets({ nets, onDelete }: PastNetsProps) {
  const searchParams = useSearchParams()
  const isSuperAdmin = searchParams.get('superadmin') === 'yes'
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  const closedNets = nets.filter(n => n.closed_at)
  if (closedNets.length === 0) return null

  async function toggleExpand(net: Net) {
    if (expandedId === net.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(net.id)
    setLoadingLog(true)
    const res = await fetch(`/api/nets/${net.id}/log`)
    if (res.ok) setLogEntries(await res.json())
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
    if (res.ok) setLogEntries(await res.json())
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
    setExpandedId(null)
    onDelete()
  }

  return (
    <div>
      <h2 className="text-gray-300 font-medium mb-3">Previous Nets</h2>
      <div className="space-y-2">
        {closedNets.map(net => {
          const isExpanded = expandedId === net.id
          const isDeleting = deleteConfirmId === net.id
          const typeColor =
            net.type === 'ares' ? 'bg-blue-700' :
            net.type === 'skywarn' ? 'bg-orange-700' : 'bg-red-700'

          return (
            <div key={net.id} className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
              <button
                onClick={() => toggleExpand(net)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/50 transition-colors"
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

              {isExpanded && (
                <div className="border-t border-gray-800 p-3">
                  {loadingLog ? (
                    <p className="text-gray-500 text-sm text-center py-2">Loading...</p>
                  ) : (
                    <div className="space-y-0.5">
                      {logEntries.map(entry => {
                        const cfg = TYPE_CONFIG[entry.entry_type] || {
                          label: entry.entry_type.toUpperCase(),
                          color: 'text-gray-400',
                        }
                        const isEditingThis = editingId === entry.id

                        return (
                          <div
                            key={entry.id}
                            className="group flex gap-2 text-sm py-1 border-b border-gray-800/50 last:border-0"
                          >
                            <span className="text-gray-600 font-mono text-xs flex-shrink-0 pt-0.5">
                              {format(new Date(entry.timestamp), 'HH:mm:ss')}
                            </span>
                            <span className={`font-mono text-xs font-semibold flex-shrink-0 pt-0.5 w-16 ${cfg.color}`}>
                              {cfg.label}
                            </span>

                            {isEditingThis ? (
                              <div className="flex-1 flex gap-1">
                                <input
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit(net.id, entry.id)
                                    if (e.key === 'Escape') setEditingId(null)
                                  }}
                                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white text-sm"
                                  autoFocus
                                  disabled={saving}
                                />
                                <button
                                  onClick={() => saveEdit(net.id, entry.id)}
                                  disabled={saving}
                                  className="text-green-400 hover:text-green-300 p-0.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-gray-500 hover:text-gray-300 p-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="text-gray-400 break-all flex-1 cursor-pointer hover:text-gray-200 transition-colors"
                                onClick={() => {
                                  setEditingId(entry.id)
                                  setEditContent(entry.content)
                                }}
                                title="Click to edit"
                              >
                                {entry.content}
                              </span>
                            )}

                            {!isEditingThis && (
                              <button
                                onClick={() => {
                                  setEditingId(entry.id)
                                  setEditContent(entry.content)
                                }}
                                className="text-gray-700 group-hover:text-gray-500 hover:!text-gray-300 p-0.5 flex-shrink-0 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-800">
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
    </div>
  )
}

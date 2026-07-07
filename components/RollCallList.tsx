'use client'

import { useState, useEffect, useRef } from 'react'
import type { Net, Station, LogEntry } from '@/types'
import { deriveStations } from '@/lib/deriveStations'

interface RollCallListProps {
  netId: string
  /** The previous net chosen on the setup screen; its stations are the roll */
  prevNetId: string
  currentStations: Station[]
  onUpdate: () => void
  onSkip?: () => void
  sortBySuffix?: boolean
}

interface RollState {
  checkedIn: boolean
  hasTraffic: boolean
  hasAnnouncement: boolean
  tickedAt: number | null
}

function getSuffix(callsign: string) {
  const match = callsign.match(/\d([A-Z]+)$/)
  return match ? match[1] : callsign
}

export function RollCallList({ netId, prevNetId, currentStations, onUpdate, onSkip, sortBySuffix = true }: RollCallListProps) {
  const [prevNet, setPrevNet] = useState<Net | null>(null)
  const [prevStations, setPrevStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [rollState, setRollState] = useState<Record<string, RollState>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [lastWeekCount, setLastWeekCount] = useState(0)
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    async function fetchPrevious() {
      // Use exactly the net picked on the setup screen, whatever its age.
      const [netRes, stRes] = await Promise.all([
        fetch(`/api/nets/${prevNetId}`),
        fetch(`/api/nets/${prevNetId}/log`),
      ])
      if (!netRes.ok) { setLoading(false); return }
      const prev: Net = await netRes.json()
      setPrevNet(prev)
      if (stRes.ok) {
        const logEntries: LogEntry[] = await stRes.json()
        const stations: Station[] = deriveStations(logEntries)
        stations.sort((a, b) => sortBySuffix
          ? getSuffix(a.callsign).localeCompare(getSuffix(b.callsign))
          : a.callsign.localeCompare(b.callsign)
        )
        setPrevStations(stations)
        setLastWeekCount(stations.length)

        const initial: Record<string, RollState> = {}
        stations.forEach(s => {
          const alreadyIn = currentStations.some(
            cs => cs.callsign.toUpperCase() === s.callsign.toUpperCase()
          )
          initial[s.callsign] = {
            checkedIn: alreadyIn,
            hasTraffic: false,
            hasAnnouncement: false,
            tickedAt: alreadyIn ? Date.now() : null,
          }
          if (alreadyIn) processedRef.current.add(s.callsign)
        })
        setRollState(initial)
      }
      setLoading(false)
    }
    fetchPrevious()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netId, prevNetId])

  async function toggleCheckin(callsign: string) {
    const current = rollState[callsign]
    if (!current) return

    if (current.checkedIn) {
      setRollState(prev => ({
        ...prev,
        [callsign]: { ...prev[callsign], checkedIn: false, tickedAt: null },
      }))
      return
    }

    const now = Date.now()
    setRollState(prev => ({
      ...prev,
      [callsign]: { ...prev[callsign], checkedIn: true, tickedAt: now },
    }))

    if (!processedRef.current.has(callsign)) {
      const alreadyIn = currentStations.some(
        cs => cs.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (!alreadyIn) {
        setSaving(prev => ({ ...prev, [callsign]: true }))
        await fetch(`/api/nets/${netId}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign }),
        })
        processedRef.current.add(callsign)
        setSaving(prev => ({ ...prev, [callsign]: false }))
        onUpdate()
      } else {
        processedRef.current.add(callsign)
      }
    } else {
      const existing = currentStations.find(
        cs => cs.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (existing) {
        await fetch(`/api/nets/${netId}/log`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_id: existing.log_entry_id,
            metadata: { checked_in_at: new Date(now).toISOString() },
          }),
        })
        onUpdate()
      }
    }
  }

  async function toggleTraffic(callsign: string) {
    const current = rollState[callsign]
    if (!current) return
    const newVal = !current.hasTraffic
    setRollState(prev => ({
      ...prev,
      [callsign]: { ...prev[callsign], hasTraffic: newVal },
    }))

    const station = currentStations.find(
      s => s.callsign.toUpperCase() === callsign.toUpperCase()
    )
    if (station) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: station.log_entry_id, metadata: { has_traffic: newVal } }),
      })
    }
  }

  async function toggleAnnouncement(callsign: string) {
    const current = rollState[callsign]
    if (!current) return
    const newVal = !current.hasAnnouncement
    setRollState(prev => ({
      ...prev,
      [callsign]: { ...prev[callsign], hasAnnouncement: newVal },
    }))

    const station = currentStations.find(
      s => s.callsign.toUpperCase() === callsign.toUpperCase()
    )
    if (station) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: station.log_entry_id, metadata: { has_announcements: newVal } }),
      })
    }
  }

  if (loading) return <p className="text-fg-4 text-sm py-2">Loading last week...</p>

  if (!prevNet || prevStations.length === 0) {
    return (
      <div className="space-y-2 py-2">
        <p className="text-fg-4 text-sm">The selected previous net has no stations to call.</p>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
          >
            Acknowledge: Read from external source and enter manually
          </button>
        )}
      </div>
    )
  }

  const checkedCount = Object.values(rollState).filter(r => r.checkedIn).length

  return (
    <div className="space-y-3">
      <div className="text-fg-3 text-sm">
        Last week: <span className="text-fg font-semibold">{lastWeekCount}</span> stations
        &middot; Tonight: <span className="text-green-400 font-semibold">{checkedCount}</span> confirmed
      </div>

      <div className="space-y-0.5">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 text-xs text-fg-4 px-2 pb-1 border-b border-surface-2">
          <span>Callsign</span>
          <span className="w-12 text-center">In</span>
          <span className="w-12 text-center">Tfc</span>
          <span className="w-12 text-center">Ann</span>
        </div>

        {prevStations.map(station => {
          const state = rollState[station.callsign]
          if (!state) return null
          const isSaving = saving[station.callsign]

          return (
            <div
              key={station.callsign}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center px-2 py-1.5 rounded transition-colors ${
                state.checkedIn ? 'bg-green-950/30' : 'hover:bg-surface-2/50'
              }`}
            >
              <span className={`font-mono text-sm ${
                state.checkedIn ? 'text-green-400' : 'text-fg-2'
              } ${isSaving ? 'opacity-50' : ''}`}>
                {station.callsign}
                {station.first_name && (
                  <span className="text-fg-5 text-xs ml-1 font-sans">
                    {station.first_name}
                  </span>
                )}
              </span>

              <label className="w-12 flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.checkedIn}
                  onChange={() => toggleCheckin(station.callsign)}
                  className="rounded accent-green-500"
                  disabled={!!isSaving}
                />
              </label>

              <label className="w-12 flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.hasTraffic}
                  onChange={() => toggleTraffic(station.callsign)}
                  className="rounded accent-yellow-500"
                  disabled={!state.checkedIn}
                />
              </label>

              <label className="w-12 flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.hasAnnouncement}
                  onChange={() => toggleAnnouncement(station.callsign)}
                  className="rounded accent-teal-500"
                  disabled={!state.checkedIn}
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

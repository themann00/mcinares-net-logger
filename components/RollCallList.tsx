'use client'

import { useState, useEffect, useRef } from 'react'
import type { Net, Station } from '@/types'

interface RollCallListProps {
  netId: string
  currentStations: Station[]
  onUpdate: () => void
  onSkip?: () => void
}

interface RollState {
  checkedIn: boolean
  hasTraffic: boolean
  hasAnnouncement: boolean
  tickedAt: number | null
}

export function RollCallList({ netId, currentStations, onUpdate, onSkip }: RollCallListProps) {
  const [prevNet, setPrevNet] = useState<Net | null>(null)
  const [prevStations, setPrevStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [rollState, setRollState] = useState<Record<string, RollState>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [lastWeekCount, setLastWeekCount] = useState(0)
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    async function fetchPrevious() {
      const res = await fetch('/api/nets')
      if (!res.ok) { setLoading(false); return }
      const nets: Net[] = await res.json()

      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      const prev = nets.find(
        n => n.type === 'ares' && n.closed_at && n.id !== netId &&
          new Date(n.started_at).getTime() > eightDaysAgo
      )

      if (!prev) { setLoading(false); return }

      setPrevNet(prev)
      const stRes = await fetch(`/api/nets/${prev.id}/stations`)
      if (stRes.ok) {
        const stations: Station[] = await stRes.json()
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
  }, [netId, currentStations])

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
        await fetch(`/api/nets/${netId}/stations`, {
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
        await fetch(`/api/nets/${netId}/stations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            station_id: existing.id,
            checked_in_at: new Date(now).toISOString(),
          }),
        })
        onUpdate()
      }
    }
  }

  async function toggleTraffic(callsign: string) {
    const current = rollState[callsign]
    if (!current) return
    setRollState(prev => ({
      ...prev,
      [callsign]: { ...prev[callsign], hasTraffic: !prev[callsign].hasTraffic },
    }))

    if (!current.hasTraffic) {
      const station = currentStations.find(
        s => s.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (station) {
        await fetch(`/api/nets/${netId}/stations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: station.id, has_traffic: true }),
        })
        onUpdate()
      }
    }
  }

  async function toggleAnnouncement(callsign: string) {
    const current = rollState[callsign]
    if (!current) return
    setRollState(prev => ({
      ...prev,
      [callsign]: { ...prev[callsign], hasAnnouncement: !prev[callsign].hasAnnouncement },
    }))

    if (!current.hasAnnouncement) {
      const station = currentStations.find(
        s => s.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (station) {
        await fetch(`/api/nets/${netId}/stations`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ station_id: station.id, has_announcements: true }),
        })
        onUpdate()
      }
    }
  }

  if (loading) return <p className="text-gray-500 text-sm py-2">Loading last week...</p>

  if (!prevNet || prevStations.length === 0) {
    return (
      <div className="space-y-2 py-2">
        <p className="text-gray-500 text-sm">No previous ARES net found within 8 days.</p>
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
      <div className="text-gray-400 text-sm">
        Last week: <span className="text-white font-semibold">{lastWeekCount}</span> stations
        &middot; Tonight: <span className="text-green-400 font-semibold">{checkedCount}</span> confirmed
      </div>

      <div className="space-y-0.5">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 text-xs text-gray-500 px-2 pb-1 border-b border-gray-800">
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
                state.checkedIn ? 'bg-green-950/30' : 'hover:bg-gray-800/50'
              }`}
            >
              <span className={`font-mono text-sm ${
                state.checkedIn ? 'text-green-400' : 'text-gray-300'
              } ${isSaving ? 'opacity-50' : ''}`}>
                {station.callsign}
                {station.first_name && (
                  <span className="text-gray-600 text-xs ml-1 font-sans">
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

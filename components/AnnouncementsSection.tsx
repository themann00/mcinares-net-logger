'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileText, X, Check, Maximize2 } from 'lucide-react'
import type { Station, LogEntry } from '@/types'

interface AnnouncementsSectionProps {
  stations: Station[]
  logEntries: LogEntry[]
  netId: string
  announcementUrl: string | null
  onUpdate: () => void
}

interface AnnState {
  text: string
  startedAt: number | null
  cancelled: boolean
  saved: boolean
}

export function AnnouncementsSection({ stations, logEntries, netId, announcementUrl, onUpdate }: AnnouncementsSectionProps) {
  const announcementStations = stations
    .filter(s => s.has_announcements)
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime())

  const alreadyLogged = new Set(
    logEntries
      .filter(e => e.entry_type === 'announcement' && e.station_id)
      .map(e => e.station_id)
  )

  const [pdfZoom, setPdfZoom] = useState(false)

  const [annState, setAnnState] = useState<Record<string, AnnState>>(() => {
    const initial: Record<string, AnnState> = {}
    announcementStations.forEach(s => {
      initial[s.id] = {
        text: '',
        startedAt: null,
        cancelled: false,
        saved: alreadyLogged.has(s.id),
      }
    })
    return initial
  })

  const hasAnnouncements = announcementStations.length > 0

  async function saveAnnouncement(station: Station) {
    const state = annState[station.id]
    if (!state || !state.text.trim()) return

    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'announcement',
        content: `${station.callsign}: ${state.text.trim()}`,
        station_id: station.id,
      }),
    })

    setAnnState(prev => ({
      ...prev,
      [station.id]: { ...prev[station.id], saved: true },
    }))
    onUpdate()
  }

  function handleTextChange(stationId: string, text: string) {
    setAnnState(prev => ({
      ...prev,
      [stationId]: {
        ...prev[stationId],
        text,
        startedAt: prev[stationId].startedAt || Date.now(),
      },
    }))
  }

  function cancelStation(stationId: string) {
    setAnnState(prev => ({
      ...prev,
      [stationId]: { ...prev[stationId], cancelled: true },
    }))
  }

  return (
    <>
    <div className="space-y-4">
      {hasAnnouncements && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-4">
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-base leading-7 text-gray-100 whitespace-pre-wrap border border-gray-800">
            I will now take announcements from stations that indicated that they had announcements. Stations with traffic will pass after announcements.
          </div>

          <div className="space-y-3">
            {announcementStations.map(station => {
              const state = annState[station.id]
              if (!state || state.cancelled) return null

              if (state.saved) {
                return (
                  <div key={station.id} className="flex items-center gap-2 px-3 py-2 bg-green-950/30 rounded-lg">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-green-400 line-through">{station.callsign}</span>
                    <span className="text-gray-500 text-xs">logged</span>
                  </div>
                )
              }

              return (
                <div key={station.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-white">{station.callsign}</span>
                    <button
                      onClick={() => cancelStation(station.id)}
                      className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      No announcement
                    </button>
                  </div>
                  <Textarea
                    value={state.text}
                    onChange={e => handleTextChange(station.id, e.target.value)}
                    placeholder="Summarize announcement..."
                    className="bg-gray-900 border-gray-700 text-white text-sm"
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={() => saveAnnouncement(station)}
                    disabled={!state.text.trim()}
                    className="bg-teal-700 hover:bg-teal-600 text-xs"
                  >
                    Log Announcement
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-base leading-7 text-gray-100 whitespace-pre-wrap border border-gray-800">
          I will now read this week's Marion County Ham Radio Announcements.
        </div>

        {announcementUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPdfZoom(true)}
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
              >
                <Maximize2 className="w-4 h-4" />
                Zoom in
              </button>
              <a
                href={announcementUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
              >
                <FileText className="w-4 h-4" />
                Open in new tab
              </a>
            </div>
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(announcementUrl)}&embedded=true`}
              className="w-full rounded-lg border border-gray-700 bg-white"
              style={{ height: '70vh', minHeight: '400px' }}
              title="Announcements PDF"
            />
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">Read from external source.</p>
        )}
      </div>
    </div>

      {pdfZoom && announcementUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-end gap-3 p-3 bg-gray-900">
            <a
              href={announcementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Open in new tab
            </a>
            <button
              onClick={() => setPdfZoom(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(announcementUrl)}&embedded=true`}
            className="w-full bg-white"
            style={{ height: 'calc(100vh - 52px)' }}
            title="Announcements PDF (fullscreen)"
          />
        </div>
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, X, Check, Maximize2, BookOpen } from 'lucide-react'
import { StationPassList } from '@/components/StationPassList'
import type { Station, LogEntry } from '@/types'

interface AnnouncementsSectionProps {
  stations: Station[]
  logEntries: LogEntry[]
  netId: string
  announcementUrl: string | null
  onUpdate: () => void
}

export function AnnouncementsSection({ stations, logEntries, netId, announcementUrl, onUpdate }: AnnouncementsSectionProps) {
  const [pdfZoom, setPdfZoom] = useState(false)
  // Derived from logs each render so a refresh or late log still shows it.
  const readingLogged = logEntries.some(
    e => e.entry_type === 'announcement' && e.content.includes('Net controller read the prepared weekly announcements')
  )

  const hasAnnouncements = stations.some(s => s.has_announcements)

  return (
    <>
    <div className="space-y-4">
      {hasAnnouncements && (
        <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 space-y-4">
          <div className="bg-surface-0 rounded-lg p-4 font-mono text-base leading-7 text-fg-1 whitespace-pre-wrap border border-surface-2">
            I will now take announcements from stations that indicated that they had announcements. Stations with traffic will pass after announcements.
          </div>

          <StationPassList
            netId={netId}
            flag="announcement"
            stations={stations}
            logEntries={logEntries}
            onUpdate={onUpdate}
          />
        </div>
      )}

      <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 space-y-3">
        <div className="bg-surface-0 rounded-lg p-4 font-mono text-base leading-7 text-fg-1 whitespace-pre-wrap border border-surface-2">
          I will now read this week's Marion County Ham Radio Announcements.
        </div>

        {readingLogged ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            Reading announcements logged
          </div>
        ) : (
          <Button
            onClick={async () => {
              await fetch(`/api/nets/${netId}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entry_type: 'announcement',
                  content: 'Net controller read the prepared weekly announcements, available at MCINARES.org',
                }),
              })
              onUpdate()
            }}
            className="w-full bg-teal-700 hover:bg-teal-600 gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Log Start of Reading Announcements
          </Button>
        )}

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
              className="w-full rounded-lg border border-surface-3 bg-white"
              style={{ height: '70vh', minHeight: '400px' }}
              title="Announcements PDF"
            />
          </div>
        ) : (
          <p className="text-fg-4 text-sm italic">Read from external source.</p>
        )}
      </div>
    </div>

      {pdfZoom && announcementUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center justify-end gap-3 p-3 bg-surface-1">
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
              className="text-fg-3 hover:text-fg"
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

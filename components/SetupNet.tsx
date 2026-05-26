'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check, FileText, SkipForward, ChevronRight, Download } from 'lucide-react'
import type { Net } from '@/types'

interface DocFile {
  filename: string
  url: string
  date: string
  label: string
}

interface SetupNetProps {
  netId: string
  onComplete: (config: { prevNetId: string | null; announcementUrl: string | null }) => void
}

export function SetupNet({ netId, onComplete }: SetupNetProps) {
  const [step, setStep] = useState<'checklist' | 'announcements'>('checklist')

  const [recentNets, setRecentNets] = useState<Net[]>([])
  const [selectedPrevNet, setSelectedPrevNet] = useState<string | null>(null)
  const [prevNetConfirmed, setPrevNetConfirmed] = useState(false)
  const [showAllNets, setShowAllNets] = useState(false)
  const [showWebChecklists, setShowWebChecklists] = useState(false)
  const [autoNet, setAutoNet] = useState<Net | null>(null)

  const [announcements, setAnnouncements] = useState<DocFile[]>([])
  const [checklists, setChecklists] = useState<DocFile[]>([])
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null)
  const [pdfConfirmed, setPdfConfirmed] = useState(false)
  const [showAllPdfs, setShowAllPdfs] = useState(false)
  const [todayPdf, setTodayPdf] = useState<DocFile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [netsRes, docsRes] = await Promise.all([
        fetch('/api/nets'),
        fetch('/api/announcements'),
      ])

      if (netsRes.ok) {
        const nets: Net[] = await netsRes.json()
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
        const aresNets = nets.filter(
          n => n.type === 'ares' && n.closed_at && n.id !== netId && !n.testing
        )
        setRecentNets(aresNets.slice(0, 5))
        const recent = aresNets.find(n => new Date(n.started_at).getTime() > eightDaysAgo)
        if (recent) setAutoNet(recent)
      }

      if (docsRes.ok) {
        const docs = await docsRes.json()
        setAnnouncements(docs.announcements || [])
        setChecklists(docs.checklists || [])

        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysToWed = dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek
        const wed = new Date(now)
        wed.setDate(wed.getDate() + daysToWed)
        const wedStr = `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, '0')}-${String(wed.getDate()).padStart(2, '0')}`
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        const match = (docs.announcements || []).find((p: DocFile) => p.date === wedStr || p.date === todayStr)
        if (match) setTodayPdf(match)
      }

      setLoading(false)
    }
    load()
  }, [netId])

  function finishSetup() {
    onComplete({
      prevNetId: selectedPrevNet,
      announcementUrl: selectedPdf,
    })
  }

  if (loading) {
    return <div className="text-gray-500 text-sm py-4 text-center">Loading setup...</div>
  }

  if (step === 'checklist') {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-4">
        <h3 className="text-white font-semibold text-lg">Setup Net — Previous Check-in List</h3>

        {!prevNetConfirmed && !showWebChecklists && (
          <>
            {autoNet && !showAllNets ? (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm">
                  Found previous ARES net from{' '}
                  <span className="text-white font-medium">
                    {new Date(autoNet.started_at).toLocaleDateString()}
                  </span>
                  {' — use this check-in list for roll call?'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => { setSelectedPrevNet(autoNet.id); setPrevNetConfirmed(true) }}
                    className="bg-green-700 hover:bg-green-600 gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Yes, use this list
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAllNets(true)}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                  >
                    Select another date
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowWebChecklists(true)}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Use website checklist
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSelectedPrevNet(null); setPrevNetConfirmed(true) }}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {!autoNet && !showAllNets && (
                  <p className="text-gray-400 text-sm">No ARES net found within the last 8 days.</p>
                )}
                <p className="text-gray-300 text-sm">Select a previous net for roll call:</p>
                <div className="space-y-1">
                  {recentNets.map(net => (
                    <button
                      key={net.id}
                      onClick={() => { setSelectedPrevNet(net.id); setPrevNetConfirmed(true) }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left bg-gray-800 hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-white text-sm font-medium">
                        {new Date(net.started_at).toLocaleDateString()}
                      </span>
                      <span className="text-gray-500 text-xs">{net.net_controller}</span>
                    </button>
                  ))}
                  {recentNets.length === 0 && (
                    <p className="text-gray-500 text-sm">No previous ARES nets found.</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowWebChecklists(true)}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Use website checklist instead
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setSelectedPrevNet(null); setPrevNetConfirmed(true) }}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip and read manually
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {!prevNetConfirmed && showWebChecklists && (
          <div className="space-y-3">
            <p className="text-gray-300 text-sm">Select a check-in list from mcinares.org:</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {checklists.length === 0 ? (
                <p className="text-gray-500 text-sm">No checklists found on website.</p>
              ) : (
                checklists.map(cl => (
                  <a
                    key={cl.filename}
                    href={cl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-white text-sm">{cl.label}</span>
                    <span className="text-gray-500 text-xs">{cl.filename}</span>
                  </a>
                ))
              )}
            </div>
            <p className="text-gray-500 text-xs">Download the checklist, then continue setup.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowWebChecklists(false)}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => { setSelectedPrevNet(null); setPrevNetConfirmed(true) }}
                className="bg-blue-700 hover:bg-blue-600 gap-1"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {prevNetConfirmed && (
          <>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              {selectedPrevNet ? 'Previous check-in list loaded' : 'Skipped — manual roll call'}
            </div>
            <Button
              onClick={() => setStep('announcements')}
              className="bg-blue-700 hover:bg-blue-600 gap-1"
            >
              Next: Announcements
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-4">
      <h3 className="text-white font-semibold text-lg">Setup Net — Announcements</h3>

      {!pdfConfirmed && (
        <>
          {todayPdf && !showAllPdfs ? (
            <div className="space-y-3">
              <p className="text-gray-300 text-sm">
                Found announcements for{' '}
                <span className="text-white font-medium">{todayPdf.label}</span>
                {' — use this?'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => { setSelectedPdf(todayPdf.url); setPdfConfirmed(true) }}
                  className="bg-green-700 hover:bg-green-600 gap-1"
                >
                  <FileText className="w-4 h-4" />
                  Yes, use this PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAllPdfs(true)}
                  className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                >
                  Select another date
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedPdf(null); setPdfConfirmed(true) }}
                  className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {!todayPdf && !showAllPdfs && (
                <p className="text-gray-400 text-sm">No announcements PDF found for this week.</p>
              )}
              <p className="text-gray-300 text-sm">Select an announcements PDF, or skip:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {announcements.map(pdf => (
                  <button
                    key={pdf.filename}
                    onClick={() => { setSelectedPdf(pdf.url); setPdfConfirmed(true) }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-white text-sm">{pdf.label}</span>
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSelectedPdf(null); setPdfConfirmed(true) }}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
              >
                <SkipForward className="w-4 h-4" />
                Skip and read manually
              </Button>
            </div>
          )}
        </>
      )}

      {pdfConfirmed && (
        <>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            {selectedPdf ? (
              <span>
                Announcements loaded —{' '}
                <a href={selectedPdf} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                  View PDF
                </a>
              </span>
            ) : 'Skipped — manual announcements'}
          </div>
          <Button
            onClick={finishSetup}
            className="bg-blue-700 hover:bg-blue-600 gap-1"
          >
            Start Net
            <ChevronRight className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  )
}

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
  onComplete: (config: { prevNetId: string | null; announcementUrl: string | null; checklistUrl: string | null }) => void
  initialConfig?: { prevNetId: string | null; announcementUrl: string | null; checklistUrl: string | null } | null
  isResuming?: boolean
}

export function SetupNet({ netId, onComplete, initialConfig, isResuming = false }: SetupNetProps) {
  const [recentNets, setRecentNets] = useState<Net[]>([])
  const [autoNet, setAutoNet] = useState<Net | null>(null)

  const [selectedPrevNet, setSelectedPrevNet] = useState<string | null>(initialConfig?.prevNetId ?? null)
  const [selectedChecklistUrl, setSelectedChecklistUrl] = useState<string | null>(initialConfig?.checklistUrl ?? null)
  const [prevNetChoice, setPrevNetChoice] = useState<'auto' | 'other' | 'web' | 'skip'>('auto')

  const [announcements, setAnnouncements] = useState<DocFile[]>([])
  const [checklists, setChecklists] = useState<DocFile[]>([])
  const [selectedPdf, setSelectedPdf] = useState<string | null>(initialConfig?.announcementUrl ?? null)
  const [pdfChoice, setPdfChoice] = useState<'auto' | 'other' | 'skip'>('auto')
  const [todayPdf, setTodayPdf] = useState<DocFile | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [netsRes, docsRes] = await Promise.all([
        fetch('/api/nets'),
        fetch('/api/announcements'),
      ])

      let foundAutoNet: Net | null = null
      if (netsRes.ok) {
        const nets: Net[] = await netsRes.json()
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
        const aresNets = nets.filter(
          n => n.type === 'ares' && n.closed_at && n.id !== netId && !n.testing
        )
        setRecentNets(aresNets.slice(0, 5))
        foundAutoNet = aresNets.find(n => new Date(n.started_at).getTime() > eightDaysAgo) || null
        setAutoNet(foundAutoNet)
      }

      let foundPdf: DocFile | null = null
      let docs: { announcements?: DocFile[]; checklists?: DocFile[] } = {}
      if (docsRes.ok) {
        docs = await docsRes.json()
        setAnnouncements(docs.announcements || [])
        setChecklists(docs.checklists || [])

        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysToWed = dayOfWeek <= 3 ? 3 - dayOfWeek : 10 - dayOfWeek
        const wed = new Date(now)
        wed.setDate(wed.getDate() + daysToWed)
        const wedStr = `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, '0')}-${String(wed.getDate()).padStart(2, '0')}`
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        foundPdf = (docs.announcements || []).find((p: DocFile) => p.date === wedStr || p.date === todayStr) || null
        setTodayPdf(foundPdf)
      }

      if (!initialConfig) {
        if (foundAutoNet) {
          setSelectedPrevNet(foundAutoNet.id)
          setPrevNetChoice('auto')
        } else {
          setSelectedPrevNet(null)
          setPrevNetChoice('skip')
        }

        const annList = docs.announcements || []
        if (foundPdf) {
          setSelectedPdf(foundPdf.url)
          setPdfChoice('auto')
        } else if (annList.length > 0) {
          setSelectedPdf(annList[0].url)
          setTodayPdf(annList[0])
          setPdfChoice('auto')
        } else {
          setSelectedPdf(null)
          setPdfChoice('skip')
        }
      }

      setLoading(false)
    }
    load()
  }, [netId, initialConfig])

  function handleStart() {
    onComplete({
      prevNetId: prevNetChoice === 'skip' ? null : (prevNetChoice === 'web' ? null : selectedPrevNet),
      announcementUrl: pdfChoice === 'skip' ? null : selectedPdf,
      checklistUrl: prevNetChoice === 'web' ? selectedChecklistUrl : null,
    })
  }

  if (loading) {
    return <div className="text-gray-500 text-sm py-4 text-center">Loading setup...</div>
  }

  const selectedStyle = 'bg-green-900/30 border border-green-600 text-green-300'
  const unselectedStyle = 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'

  return (
    <div className="space-y-4">
      {/* Previous Check-in List */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-2">
        <h3 className="text-white font-semibold mb-3">Previous Check-in List</h3>

        {autoNet && (
          <button
            onClick={() => { setSelectedPrevNet(autoNet.id); setPrevNetChoice('auto') }}
            className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${prevNetChoice === 'auto' ? selectedStyle : unselectedStyle}`}
          >
            {prevNetChoice === 'auto' && <Check className="w-4 h-4 flex-shrink-0" />}
            Use list from {new Date(autoNet.started_at).toLocaleDateString()} (auto-detected)
          </button>
        )}

        {recentNets.filter(n => n.id !== autoNet?.id).map(net => (
          <button
            key={net.id}
            onClick={() => { setSelectedPrevNet(net.id); setPrevNetChoice('other') }}
            className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${prevNetChoice === 'other' && selectedPrevNet === net.id ? selectedStyle : unselectedStyle}`}
          >
            {prevNetChoice === 'other' && selectedPrevNet === net.id && <Check className="w-4 h-4 flex-shrink-0" />}
            {new Date(net.started_at).toLocaleDateString()} — {net.net_controller}
          </button>
        ))}

        {checklists.length > 0 && (
          <div className="pt-1">
            <span className="text-gray-500 text-xs">From mcinares.org:</span>
            <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
              {checklists.map(cl => (
                <button
                  key={cl.filename}
                  onClick={() => { setSelectedChecklistUrl(cl.url); setPrevNetChoice('web') }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors ${
                    prevNetChoice === 'web' && selectedChecklistUrl === cl.url ? selectedStyle : unselectedStyle
                  }`}
                >
                  {prevNetChoice === 'web' && selectedChecklistUrl === cl.url && <Check className="w-4 h-4 flex-shrink-0" />}
                  <Download className="w-3 h-3 flex-shrink-0" />
                  {cl.label} — {cl.filename}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { setSelectedPrevNet(null); setPrevNetChoice('skip') }}
          className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${prevNetChoice === 'skip' ? selectedStyle : unselectedStyle}`}
        >
          {prevNetChoice === 'skip' && <Check className="w-4 h-4 flex-shrink-0" />}
          <SkipForward className="w-3 h-3 flex-shrink-0" />
          Skip — read manually
        </button>
      </div>

      {/* Announcements */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 space-y-2">
        <h3 className="text-white font-semibold mb-3">Announcements</h3>

        {announcements.map(pdf => (
          <button
            key={pdf.filename}
            onClick={() => { setSelectedPdf(pdf.url); setPdfChoice(pdf === todayPdf ? 'auto' : 'other') }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
              selectedPdf === pdf.url && pdfChoice !== 'skip' ? selectedStyle : unselectedStyle
            }`}
          >
            {selectedPdf === pdf.url && pdfChoice !== 'skip' && <Check className="w-4 h-4 flex-shrink-0" />}
            <FileText className="w-3 h-3 flex-shrink-0" />
            {pdf.label}
            {pdf === todayPdf && <span className="text-green-500 text-xs">(this week)</span>}
          </button>
        ))}

        <button
          onClick={() => { setSelectedPdf(null); setPdfChoice('skip') }}
          className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${pdfChoice === 'skip' ? selectedStyle : unselectedStyle}`}
        >
          {pdfChoice === 'skip' && <Check className="w-4 h-4 flex-shrink-0" />}
          <SkipForward className="w-3 h-3 flex-shrink-0" />
          Skip — read manually
        </button>
      </div>

      {/* Start button */}
      <Button
        onClick={handleStart}
        className="w-full bg-blue-700 hover:bg-blue-600 text-lg py-6 gap-2"
      >
        {isResuming ? 'Resume Net' : 'Start Net'}
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScriptCard } from '@/components/ScriptCard'
import { CheckinForm } from '@/components/CheckinForm'
import { StationList } from '@/components/StationList'
import { LogFeed } from '@/components/LogFeed'
import { ReportForm } from '@/components/ReportForm'
import { FullScriptModal } from '@/components/FullScriptModal'
import { getSections } from '@/lib/scripts'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  X,
  RefreshCw,
  Radio,
  Users,
  BookOpen,
  FileText,
} from 'lucide-react'
import type { Net, Station, LogEntry, NetContext } from '@/types'
import { skywarnContinuityScript } from '@/lib/scripts/skywarn'

type TabId = 'checkin' | 'report' | 'stations' | 'log'

export default function NetPage() {
  const params = useParams()
  const router = useRouter()
  const netId = params.id as string

  const [net, setNet] = useState<Net | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('checkin')
  const [fullScriptOpen, setFullScriptOpen] = useState(false)
  const [continuityText, setContinuityText] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState('')
  const logBottomRef = useRef<HTMLDivElement>(null)

  const sections = net ? getSections(net.type) : []
  const section = sections[sectionIndex]

  const ctx: NetContext = {
    net_controller: net?.net_controller || '',
    alt_net_controller: net?.alt_net_controller,
    liaison: net?.liaison,
    weather_status: net?.weather_status,
    nws_bulletin: net?.nws_bulletin,
  }

  const fetchAll = useCallback(async () => {
    const [netRes, stationsRes, logRes] = await Promise.all([
      fetch(`/api/nets/${netId}`),
      fetch(`/api/nets/${netId}/stations`),
      fetch(`/api/nets/${netId}/log`),
    ])
    if (!netRes.ok) return
    setNet(await netRes.json())
    setStations(await stationsRes.json())
    setLogEntries(await logRes.json())
  }, [netId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Live elapsed timer
  useEffect(() => {
    if (!net?.started_at) return
    const tick = () => setElapsed(formatDistanceToNow(new Date(net.started_at), { addSuffix: false }))
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [net?.started_at])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (activeTab === 'log') {
      logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logEntries, activeTab])

  async function saveSectionInputs() {
    if (!net || !section?.inputFields) return
    setSaving(true)
    const patch: Record<string, string> = {}
    const logItems: { entry_type: string; content: string }[] = []

    section.inputFields.forEach(field => {
      const val = sectionInputs[field.id]?.trim()
      if (!val) return

      if (field.id === 'alt_nc') {
        patch.alt_net_controller = val
        logItems.push({ entry_type: 'alt_nc', content: `Alternate net control: ${val}` })
      } else if (field.id === 'liaison') {
        patch.liaison = val
        logItems.push({ entry_type: 'liaison', content: `Liaison station: ${val}` })
      } else if (field.id === 'weather_status') {
        patch.weather_status = val
      } else if (field.id === 'nws_bulletin') {
        patch.nws_bulletin = val
      }
    })

    if (Object.keys(patch).length > 0) {
      await fetch(`/api/nets/${netId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    }

    for (const item of logItems) {
      await fetch(`/api/nets/${netId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
    }

    setSaving(false)
    fetchAll()
  }

  async function logContinuity() {
    if (!net) return
    const text = skywarnContinuityScript(ctx)
    setContinuityText(text)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_type: 'continuity', content: 'Continuity announcement made' }),
    })
    fetchAll()
  }

  async function closeNet() {
    if (!net) return
    setClosing(true)
    const now = new Date().toISOString()
    await fetch(`/api/nets/${netId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed_at: now }),
    })
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'net_close',
        content: `Net closed at ${format(new Date(now), 'HH:mm')} local`,
      }),
    })
    router.push(`/net/${netId}/report`)
  }

  if (!net) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const baseStations = stations.filter(s => s.station_type === 'base').length
  const mobileStations = stations.filter(s => s.station_type === 'mobile').length
  const reportEntries = logEntries.filter(e => e.entry_type === 'report').length
  const circleBackAvailable =
    (net.type === 'skywarn' || net.type === 'siren') &&
    (section?.allowCircleBack ?? false)

  const tabs: { id: TabId; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'checkin',
      label: 'Check-in',
      icon: <Users className="w-4 h-4" />,
      show: section?.allowCheckins ?? false,
    },
    {
      id: 'report',
      label: 'Report',
      icon: <FileText className="w-4 h-4" />,
      show: section?.allowReports ?? false,
    },
    {
      id: 'stations',
      label: `Stations (${stations.length})`,
      icon: <Radio className="w-4 h-4" />,
      show: true,
    },
    {
      id: 'log',
      label: `Log (${logEntries.length})`,
      icon: <BookOpen className="w-4 h-4" />,
      show: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Badge
              className={`text-white flex-shrink-0 ${
                net.type === 'ares'
                  ? 'bg-blue-700'
                  : net.type === 'skywarn'
                  ? 'bg-orange-700'
                  : 'bg-red-700'
              }`}
            >
              {net.type.toUpperCase()}
            </Badge>
            <span className="text-white font-semibold truncate">{net.net_controller}</span>
            <span className="text-gray-500 text-sm hidden sm:block">NC</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {elapsed && (
              <span className="text-gray-400 text-sm hidden md:block">
                Open: {elapsed}
              </span>
            )}
            <div className="flex gap-1 text-xs text-gray-400">
              <span className="bg-gray-800 px-2 py-1 rounded">{stations.length} stns</span>
              {net.type !== 'ares' && (
                <>
                  <span className="bg-blue-900/50 px-2 py-1 rounded">{baseStations}B</span>
                  <span className="bg-purple-900/50 px-2 py-1 rounded">{mobileStations}M</span>
                </>
              )}
              {reportEntries > 0 && (
                <span className="bg-orange-900/50 px-2 py-1 rounded">{reportEntries}R</span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFullScriptOpen(true)}
              className="border-gray-700 text-gray-300 hover:text-white gap-1"
            >
              <ScrollText className="w-4 h-4" />
              <span className="hidden sm:inline">Full Script</span>
            </Button>
            {net.type === 'skywarn' && (
              <Button
                size="sm"
                onClick={logContinuity}
                className="bg-cyan-800 hover:bg-cyan-700 text-white gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Continuity</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Continuity overlay */}
      {continuityText && (
        <div className="bg-cyan-950 border-b border-cyan-700 px-4 py-3 max-w-7xl mx-auto w-full">
          <div className="flex items-start gap-3">
            <div className="font-mono text-sm text-cyan-100 whitespace-pre-wrap flex-1">
              {continuityText}
            </div>
            <button onClick={() => setContinuityText(null)} className="text-cyan-400 hover:text-white flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4">
        {/* Left: Script */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {section && (
            <ScriptCard
              section={section}
              ctx={ctx}
              sectionIndex={sectionIndex}
              totalSections={sections.length}
            />
          )}

          {/* Section input fields */}
          {section?.inputFields && section.inputFields.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
              <h3 className="text-white font-medium text-sm">Net Control Inputs</h3>
              {section.inputFields.map(field => (
                <div key={field.id}>
                  <Label className="text-gray-400 text-xs mb-1 block">{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={sectionInputs[field.id] || ''}
                      onChange={e =>
                        setSectionInputs(prev => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="bg-gray-800 border-gray-700 text-white text-sm"
                      rows={4}
                    />
                  ) : field.type === 'select' && field.options ? (
                    <Select
                      value={sectionInputs[field.id] || ''}
                      onValueChange={v => setSectionInputs(prev => ({ ...prev, [field.id]: v } as Record<string, string>))}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {field.options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={sectionInputs[field.id] || ''}
                      onChange={e =>
                        setSectionInputs(prev => ({
                          ...prev,
                          [field.id]: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder={field.placeholder}
                      className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
                    />
                  )}
                </div>
              ))}
              <Button
                onClick={saveSectionInputs}
                disabled={saving}
                size="sm"
                className="bg-blue-700 hover:bg-blue-600"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}

          {/* Section navigation */}
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setSectionIndex(i => Math.max(0, i - 1))}
              disabled={sectionIndex === 0}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:text-white gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {section?.type === 'closenet' ? (
              <Button
                onClick={closeNet}
                disabled={closing}
                className="bg-red-700 hover:bg-red-600 font-semibold px-8"
              >
                {closing ? 'Closing...' : 'Close Net & Generate Report'}
              </Button>
            ) : (
              <Button
                onClick={() => setSectionIndex(i => Math.min(sections.length - 1, i + 1))}
                disabled={sectionIndex === sections.length - 1}
                className="bg-blue-700 hover:bg-blue-600 gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Right: Tabs panel */}
        <div className="w-full lg:w-96 flex flex-col gap-0 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700 overflow-x-auto">
            {tabs
              .filter(t => t.show)
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'checkin' && section?.allowCheckins && (
              <CheckinForm
                netId={netId}
                netType={net.type}
                onCheckin={fetchAll}
                requireStationType={false}
                showQuadrant={net.type === 'skywarn'}
                callsignOnly={
                  net.type === 'siren' && section.id === 'preamble'
                }
              />
            )}

            {activeTab === 'report' && section?.allowReports && (
              <ReportForm
                netId={netId}
                netType={net.type}
                stations={stations}
                onReport={fetchAll}
              />
            )}

            {activeTab === 'stations' && (
              <StationList
                stations={stations}
                netId={netId}
                netType={net.type}
                showCircleBack={circleBackAvailable}
                onUpdate={fetchAll}
              />
            )}

            {activeTab === 'log' && (
              <div>
                <LogFeed entries={logEntries} />
                <div ref={logBottomRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <FullScriptModal
        open={fullScriptOpen}
        onOpenChange={setFullScriptOpen}
        sections={sections}
        ctx={ctx}
      />
    </div>
  )
}

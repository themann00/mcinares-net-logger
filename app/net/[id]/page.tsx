'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ReportForm } from '@/components/ReportForm'
import { FullScriptModal } from '@/components/FullScriptModal'
import { RecentLog } from '@/components/RecentLog'
import { getSections } from '@/lib/scripts'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Home,
  ScrollText,
  X,
  RefreshCw,
  Radio,
  Users,
  BookOpen,
  FileText,
  Megaphone,
} from 'lucide-react'
import { TrafficList } from '@/components/TrafficList'
import { RollCallList } from '@/components/RollCallList'
import { SetupNet } from '@/components/SetupNet'
import type { Net, Station, LogEntry, NetContext } from '@/types'
import { skywarnContinuityScript } from '@/lib/scripts/skywarn'

type TabId = 'checkin' | 'report' | 'stations' | 'traffic' | 'log'

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
  const [setupComplete, setSetupComplete] = useState(false)
  const [setupConfig, setSetupConfig] = useState<{ prevNetId: string | null; announcementUrl: string | null } | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [localWeatherStatus, setLocalWeatherStatus] = useState<'approaching' | 'imminent' | null>(null)
  const [localBulletin, setLocalBulletin] = useState('')
  const [bulletinModalOpen, setBulletinModalOpen] = useState(false)
  const [bulletinDraft, setBulletinDraft] = useState('')
  const [fullLogOpen, setFullLogOpen] = useState(false)

  const sections = net ? getSections(net.type) : []
  const section = sections[sectionIndex]

  const ctx: NetContext = {
    net_controller: net?.net_controller || '',
    alt_net_controller: net?.alt_net_controller,
    liaison: net?.liaison,
    weather_status: localWeatherStatus,
    nws_bulletin: localBulletin || null,
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

  async function saveSectionInputs() {
    if (!net || !section?.inputFields) return
    setSaving(true)
    const patch: Record<string, string> = {}
    const logItems: { entry_type: string; content: string }[] = []

    const autoCheckins: string[] = []

    section.inputFields.forEach(field => {
      const val = sectionInputs[field.id]?.trim()
      if (!val) return

      if (field.id === 'alt_nc') {
        patch.alt_net_controller = val
        logItems.push({ entry_type: 'alt_nc', content: `Alternate net control: ${val}` })
        autoCheckins.push(val)
      } else if (field.id === 'liaison') {
        patch.liaison = val
        logItems.push({ entry_type: 'liaison', content: `Liaison station: ${val}` })
        autoCheckins.push(val)
      } else if (field.id === 'nts_liaison') {
        patch.liaison = val
        logItems.push({ entry_type: 'liaison', content: `NTS Liaison: ${val}` })
        autoCheckins.push(val)
      } else if (field.id === 'oes_station') {
        logItems.push({ entry_type: 'liaison', content: `OES Station: ${val}` })
        autoCheckins.push(val)
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

    for (const callsign of autoCheckins) {
      const already = stations.some(
        s => s.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (!already) {
        await fetch(`/api/nets/${netId}/stations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign }),
        })
      }
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

  const sectionNav = (
    <div className="flex items-center justify-between">
      <Button
        onClick={() => setSectionIndex(i => Math.max(0, i - 1))}
        disabled={sectionIndex === 0}
        variant="outline"
        className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Button>

      <span className="text-gray-500 text-sm">
        {sectionIndex + 1} / {sections.length}
      </span>

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
  )

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
      id: 'traffic',
      label: `Traffic/Ann.`,
      icon: <Megaphone className="w-4 h-4" />,
      show: net?.type === 'ares',
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
              {net.testing ? 'TEST' : net.type.toUpperCase()}
            </Badge>
            {net.testing && (
              <Badge className="bg-yellow-600 text-white flex-shrink-0">TESTING</Badge>
            )}
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
              onClick={() => router.push('/')}
              className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFullScriptOpen(true)}
              className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white gap-1"
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

      {/* Setup step for ARES */}
      {net.type === 'ares' && !setupComplete && (
        <div className="max-w-2xl mx-auto w-full p-4">
          <SetupNet
            netId={netId}
            onComplete={config => {
              setSetupConfig(config)
              setSetupComplete(true)
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4${net.type === 'ares' && !setupComplete ? ' hidden' : ''}`}>
        {/* Left: Section jump nav */}
        {sections.length > 1 && (
          <div className="hidden lg:flex flex-col gap-0.5 w-32 flex-shrink-0 pt-1">
            {sections.map((s, i) => {
              const shortLabel = s.title
                .replace('Check-ins: ', '')
                .replace(' Quadrant', '')
                .replace('Reports & ', '')
                .replace('Initial Reports', 'Reports')
                .replace('Closing', 'Close')
              return (
                <button
                  key={s.id}
                  onClick={() => setSectionIndex(i)}
                  className={`text-left px-2 py-1 text-xs rounded transition-colors truncate ${
                    i === sectionIndex
                      ? 'bg-blue-600 text-white font-semibold'
                      : i < sectionIndex
                      ? 'text-gray-300 hover:text-white hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {shortLabel}
                </button>
              )
            })}
          </div>
        )}

        {/* Center: Script */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {sectionNav}

          {net?.type === 'skywarn' && section?.id === 'preamble' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-gray-400 text-sm font-medium">Weather status:</span>
                <button
                  onClick={() => setLocalWeatherStatus(localWeatherStatus === 'approaching' ? null : 'approaching')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    localWeatherStatus === 'approaching'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  Approaching
                </button>
                <button
                  onClick={() => setLocalWeatherStatus(localWeatherStatus === 'imminent' ? null : 'imminent')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    localWeatherStatus === 'imminent'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  Imminent
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setBulletinDraft(localBulletin)
                    setBulletinModalOpen(true)
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 gap-1"
                >
                  <FileText className="w-4 h-4" />
                  {localBulletin ? 'Edit NWS Bulletin' : 'Paste current NWS Bulletin'}
                </Button>
                {localBulletin && (
                  <span className="text-green-400 text-xs">Bulletin loaded</span>
                )}
              </div>
            </div>
          )}

          {bulletinModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-5 space-y-4">
                <h3 className="text-white font-semibold">
                  NWS Bulletin
                  <a
                    href="https://www.weather.gov/ind/hazards"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-sm font-normal ml-2 underline hover:text-blue-300"
                  >
                    weather.gov/ind/hazards
                  </a>
                </h3>
                <Textarea
                  value={bulletinDraft}
                  onChange={e => setBulletinDraft(e.target.value)}
                  placeholder="Paste NWS bulletin text here..."
                  className="bg-gray-800 border-gray-700 text-white text-sm"
                  rows={8}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulletinModalOpen(false)}
                    className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                  {localBulletin && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setLocalBulletin('')
                        setBulletinDraft('')
                        setBulletinModalOpen(false)
                      }}
                      className="bg-red-800 hover:bg-red-700 text-white"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setLocalBulletin(bulletinDraft.trim())
                      setBulletinModalOpen(false)
                    }}
                    className="bg-blue-700 hover:bg-blue-600"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {section && (
            <ScriptCard
              section={section}
              ctx={ctx}
              sectionIndex={sectionIndex}
              totalSections={sections.length}
              onNext={sectionIndex < sections.length - 1 ? () => setSectionIndex(i => i + 1) : undefined}
              stationCount={stations.length}
              inlineInputs={
                section?.inputFields?.filter(f => f.inline).reduce((acc, field) => {
                  acc[field.id] = {
                    value: sectionInputs[field.id] || '',
                    placeholder: field.placeholder,
                    label: field.label,
                    onChange: (v: string) => setSectionInputs(prev => ({ ...prev, [field.id]: v })),
                    onSave: () => saveSectionInputs(),
                  }
                  return acc
                }, {} as Record<string, { value: string; placeholder?: string; label?: string; onChange: (v: string) => void; onSave: () => void }>)
              }
              onTakeReports={() => {
                setSectionIndex(i => Math.min(sections.length - 1, i + 1))
                setActiveTab('report')
              }}
              onCircleBack={() => setActiveTab('stations')}
            />
          )}

          {/* Section input fields (non-inline only) */}
          {section?.inputFields && section.inputFields.filter(f => !f.inline).length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
              <h3 className="text-white font-medium text-sm">Net Control Inputs</h3>
              {section.inputFields.filter(f => !f.inline).map(field => (
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

          {net.type === 'ares' && section?.id === 'announcements' && setupConfig?.announcementUrl && (
            <a
              href={setupConfig.announcementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-900/30 border border-blue-700 rounded-xl px-4 py-3 text-blue-300 hover:text-blue-200 hover:bg-blue-900/50 transition-colors"
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">View Announcements PDF</span>
            </a>
          )}

          {net.type === 'ares' && section?.id === 'announcements' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
              <TrafficList
                stations={stations}
                logEntries={logEntries}
                netId={netId}
                onUpdate={fetchAll}
              />
            </div>
          )}

          {sectionNav}

          <RecentLog entries={logEntries} netId={netId} onUpdate={fetchAll} reversed stations={stations} />
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
              net.type === 'ares' && section.id === 'roll_call' ? (
                <RollCallList
                  netId={netId}
                  currentStations={stations}
                  onUpdate={fetchAll}
                />
              ) : (
                <CheckinForm
                  netId={netId}
                  netType={net.type}
                  onCheckin={fetchAll}
                  requireStationType={false}
                  showQuadrant={net.type === 'skywarn'}
                  callsignOnly={
                    net.type === 'siren' && section.id === 'preamble'
                  }
                  showTrafficInputs={
                    net.type === 'ares' && section.id === 'short_time'
                  }
                />
              )
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

            {activeTab === 'traffic' && net?.type === 'ares' && (
              <TrafficList
                stations={stations}
                logEntries={logEntries}
                netId={netId}
                onUpdate={fetchAll}
              />
            )}

            {activeTab === 'log' && (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFullLogOpen(true)}
                  className="w-full mb-3 border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 gap-1"
                >
                  <BookOpen className="w-4 h-4" />
                  View full log
                </Button>
                <RecentLog
                  entries={logEntries}
                  netId={netId}
                  onUpdate={fetchAll}
                  limit={50}
                  reversed
                  stations={stations}
                />
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

      {fullLogOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">Full Net Log</h3>
              <button onClick={() => setFullLogOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <RecentLog
                entries={logEntries}
                netId={netId}
                onUpdate={fetchAll}
                limit={logEntries.length}
                reversed
                stations={stations}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

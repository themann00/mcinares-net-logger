'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  ScrollText,
  X,
  RefreshCw,
  Radio,
  Users,
  BookOpen,
  FileText,
  Megaphone,
  Plus,
  AlertTriangle,
  Download,
} from 'lucide-react'
import { TrafficList } from '@/components/TrafficList'
import { RollCallList } from '@/components/RollCallList'
import { SetupNet } from '@/components/SetupNet'
import { AnnouncementsSection } from '@/components/AnnouncementsSection'
import { TrafficSection } from '@/components/TrafficSection'
import { AddToLogModal } from '@/components/AddToLogModal'
import { SetupSkywarn } from '@/components/SetupSkywarn'
import { CheckinQueue, type QueuedCheckin } from '@/components/CheckinQueue'
import type { Net, NetConfig, DerivedStation, LogEntry, NetContext } from '@/types'
import { deriveStations, deriveNetContext } from '@/lib/deriveStations'
import type { SirenListItem } from '@/lib/sirenClient'
import { useAppState } from '@/components/AppContext'
import { getBrowserSupabase } from '@/lib/supabaseBrowser'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'

type TabId = 'checkin' | 'report' | 'stations' | 'traffic' | 'log'

// Section input fields (Alt NC, liaisons) map to log entries. The prefix
// identifies each field's entry so values prefill after refresh and re-saves
// update in place instead of duplicating.
const INPUT_FIELD_LOG: Record<string, { entryType: 'alt_nc' | 'liaison'; prefix: string }> = {
  alt_nc: { entryType: 'alt_nc', prefix: 'Alternate net control: ' },
  liaison: { entryType: 'liaison', prefix: 'Liaison station: ' },
  nts_liaison: { entryType: 'liaison', prefix: 'NTS Liaison: ' },
  oes_station: { entryType: 'liaison', prefix: 'OES Station: ' },
}

export default function NetPage() {
  const { appNow, deviceCallsign, setDeviceCallsign } = useAppState()
  const params = useParams()
  const router = useRouter()
  const netId = params.id as string

  const [net, setNet] = useState<Net | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [roster, setRoster] = useState<{ callsign: string; first_name: string | null; last_name: string | null; email: string | null }[]>([])
  const [sectionIndex, setSectionIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('checkin')
  const [fullScriptOpen, setFullScriptOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const [rollCallSkipped, setRollCallSkipped] = useState(false)
  const [elapsed, setElapsed] = useState('')
  const [sortBySuffix, setSortBySuffix] = useState(true)
  const [bulletinModalOpen, setBulletinModalOpen] = useState(false)
  const [bulletinDraft, setBulletinDraft] = useState('')
  const [fullLogOpen, setFullLogOpen] = useState(false)
  const [addToLogOpen, setAddToLogOpen] = useState(false)
  const [checkinQueue, setCheckinQueue] = useState<QueuedCheckin[]>([])
  const [committing, setCommitting] = useState(false)
  const [sirenResetConfirm, setSirenResetConfirm] = useState(false)
  const [sirenBusy, setSirenBusy] = useState(false)
  const [sirens, setSirens] = useState<SirenListItem[]>([])
  const [operatingPromptOpen, setOperatingPromptOpen] = useState(false)
  const [operatingDraft, setOperatingDraft] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false)
  const [transferBusy, setTransferBusy] = useState(false)
  const [qsyOpen, setQsyOpen] = useState(false)
  const [qsyText, setQsyText] = useState('')
  // A manual tab pick suppresses exactly the next section-change auto-switch,
  // so the operator's choice isn't yanked away mid-task.
  const userPickedTabRef = useRef(false)

  const stations: DerivedStation[] = useMemo(() => deriveStations(logEntries), [logEntries])

  const derivedCtx = useMemo(
    () => (net ? deriveNetContext(logEntries, net) : null),
    [logEntries, net]
  )

  const sections = net ? getSections(net.type) : []
  const section = sections[sectionIndex]

  // Persisted per-net UI state (weather status, bulletin, ARES setup) lives on
  // the net row so a refresh or second device keeps mid-net context.
  const netConfig: NetConfig = net?.config || {}
  const weatherStatus = netConfig.weather_status ?? null
  const bulletin = netConfig.nws_bulletin || ''
  const setupConfig = {
    prevNetId: netConfig.prev_net_id ?? null,
    announcementUrl: netConfig.announcement_url ?? null,
    checklistUrl: netConfig.checklist_url ?? null,
  }

  async function saveNetConfig(partial: Partial<NetConfig>) {
    if (!net) return
    const merged = { ...(net.config || {}), ...partial }
    setNet({ ...net, config: merged })
    await fetch(`/api/nets/${netId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: merged }),
    })
  }

  const ctx: NetContext = {
    net_controller: net?.net_controller || '',
    alt_net_controller: derivedCtx?.alt_net_controller,
    liaison: derivedCtx?.liaison,
    weather_status: weatherStatus,
    nws_bulletin: bulletin || null,
    station_count: stations.length,
    report_count: logEntries.filter(e => e.entry_type === 'report').length,
    traffic_count: logEntries.filter(e => e.entry_type === 'traffic').length,
    // Station announcements only — the NC's "read the weekly announcements"
    // entry is part of every net, not a count-worthy announcement.
    announcement_count: logEntries.filter(
      e => e.entry_type === 'announcement' && !e.content.includes('prepared weekly announcements')
    ).length,
    now_local: format(appNow(), 'HH:mm'),
  }

  const fetchAll = useCallback(async () => {
    const [netRes, logRes, rosterRes, queueRes, sirensRes] = await Promise.all([
      fetch(`/api/nets/${netId}`),
      fetch(`/api/nets/${netId}/log`),
      fetch('/api/roster'),
      fetch(`/api/nets/${netId}/queue`),
      fetch('/api/sirens'),
    ])
    if (!netRes.ok) return
    setNet(await netRes.json())
    const entries = await logRes.json()
    setLogEntries(entries)
    if (entries.length > 2) setSetupComplete(true)
    if (rosterRes.ok) setRoster(await rosterRes.json())
    if (sirensRes.ok) setSirens(await sirensRes.json())
    if (queueRes.ok) {
      const rows = await queueRes.json() as { id: string; payload: Omit<QueuedCheckin, 'id'> }[]
      setCheckinQueue(rows.map(r => ({ ...r.payload, id: r.id })))
    }
  }, [netId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Live multi-device sync: subscribe to this net's rows and refetch on any
  // change another device makes. Debounced so a burst of inserts (queue
  // commit) triggers one refetch. Falls back silently to manual-refresh
  // behavior when the browser client is unavailable.
  useEffect(() => {
    const sb = getBrowserSupabase()
    if (!sb) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fetchAll(), 400)
    }
    const channel = sb
      .channel(`net-${netId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcinares_log_entries', filter: `net_id=eq.${netId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcinares_checkin_queue', filter: `net_id=eq.${netId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcinares_nets', filter: `id=eq.${netId}` }, refresh)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      sb.removeChannel(channel)
    }
  }, [netId, fetchAll])

  // Live elapsed timer - derive started_at from first net_open log entry
  const startedAt = derivedCtx?.started_at ?? null
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(formatDistanceToNow(new Date(startedAt), { addSuffix: false }))
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [startedAt])

  useEffect(() => {
    const id = section?.id
    if (!id) return
    if (userPickedTabRef.current) {
      userPickedTabRef.current = false
      return
    }
    if (id === 'initial_reports' || id === 'continuity' || id === 'post_siren') setActiveTab('report')
    else if (id === 'reports_and_circleback') setActiveTab('stations')
    else if (id.startsWith('checkin_') || id === 'preamble' || id === 'additional_checkins') setActiveTab('checkin')
  }, [section?.id])

  // Ask once per device who is operating it; skippable for pure watchers.
  useEffect(() => {
    if (!net || deviceCallsign) return
    if (sessionStorage.getItem('operatingSkip') === '1') return
    setOperatingPromptOpen(true)
  }, [net, deviceCallsign])

  const loggedInputs = useMemo(() => {
    const map: Record<string, { entryId: string; value: string }> = {}
    for (const e of logEntries) {
      for (const [fieldId, def] of Object.entries(INPUT_FIELD_LOG)) {
        if (e.entry_type !== def.entryType) continue
        if (!e.content.toUpperCase().startsWith(def.prefix.toUpperCase())) continue
        map[fieldId] = { entryId: e.id, value: e.content.slice(def.prefix.length).trim() }
      }
    }
    return map
  }, [logEntries])

  // Prefill each field once from its logged value so a refresh mid-net does
  // not present empty inputs.
  const prefilledRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    setSectionInputs(prev => {
      let changed = false
      const next = { ...prev }
      for (const [fieldId, logged] of Object.entries(loggedInputs)) {
        if (!prefilledRef.current.has(fieldId) && !next[fieldId]) {
          next[fieldId] = logged.value
          changed = true
        }
        prefilledRef.current.add(fieldId)
      }
      return changed ? next : prev
    })
  }, [loggedInputs])

  const inputSaved = (fieldId: string) => {
    const logged = loggedInputs[fieldId]
    const val = sectionInputs[fieldId]?.trim()
    return !!logged && !!val && logged.value.toUpperCase() === val.toUpperCase()
  }

  async function saveSectionInputs() {
    if (!net || !section?.inputFields) return
    setSaving(true)

    const autoCheckins: string[] = []

    for (const field of section.inputFields) {
      const val = sectionInputs[field.id]?.trim()
      const def = INPUT_FIELD_LOG[field.id]
      if (!val || !def) continue

      const logged = loggedInputs[field.id]
      if (logged && logged.value.toUpperCase() === val.toUpperCase()) continue

      if (logged) {
        // Value changed: update the existing entry instead of duplicating it.
        await fetch(`/api/nets/${netId}/log`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: logged.entryId, content: `${def.prefix}${val}` }),
        })
      } else {
        await fetch(`/api/nets/${netId}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_type: def.entryType, content: `${def.prefix}${val}` }),
        })
      }
      autoCheckins.push(val)
    }

    for (const callsign of autoCheckins) {
      const already = stations.some(
        s => s.callsign.toUpperCase() === callsign.toUpperCase()
      )
      if (!already) {
        await fetch(`/api/nets/${netId}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign }),
        })
      }
    }

    setSaving(false)
    fetchAll()
  }

  const queueSections = ['short_time', 'mobile', 'checkin_a_h', 'checkin_i_q', 'checkin_r_z', 'checkin_remaining', 'late_checkins']
  const skywarnQueueSections = ['checkin_sw', 'checkin_nw', 'checkin_ne', 'checkin_se']
  const useQueue =
    (net?.type === 'ares' && queueSections.includes(section?.id || '')) ||
    (net?.type === 'skywarn' && skywarnQueueSections.includes(section?.id || '')) ||
    (net?.type === 'siren' && section?.id === 'preamble')

  async function addToQueue(entry: { callsign: string; firstName: string; lastName: string; stationType: string; location: string; quadrant: string; hasTraffic: boolean; hasAnnouncement: boolean; trafficText: string; announcementText: string; trafficTimestamp?: string; announcementTimestamp?: string; forceManual?: boolean }) {
    const payload: Omit<QueuedCheckin, 'id'> = {
      callsign: entry.callsign,
      firstName: entry.firstName,
      lastName: entry.lastName,
      stationType: entry.stationType as QueuedCheckin['stationType'],
      location: entry.location,
      quadrant: entry.quadrant as QueuedCheckin['quadrant'],
      sirenNumbers: [],
      moved: false,
      hasTraffic: entry.hasTraffic,
      hasAnnouncement: entry.hasAnnouncement,
      trafficText: entry.trafficText,
      announcementText: entry.announcementText,
      timestamp: appNow().toISOString(),
      trafficTimestamp: entry.trafficTimestamp,
      announcementTimestamp: entry.announcementTimestamp,
      forceManual: entry.forceManual,
      late: section?.id === 'late_checkins' || undefined,
    }
    // Optimistic append with a temporary id; swap in the DB row id when the
    // insert lands so later edits/deletes address the right row.
    const tempId = `q-tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setCheckinQueue(prev => [...prev, { ...payload, id: tempId }])
    const res = await fetch(`/api/nets/${netId}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    })
    if (res.ok) {
      const row = await res.json()
      setCheckinQueue(prev => prev.map(q => q.id === tempId ? { ...q, id: row.id } : q))
    }
  }

  // Persist queue edits/deletes coming back from the CheckinQueue component:
  // diff against current state, PATCH changed rows, DELETE removed ones.
  function syncQueue(next: QueuedCheckin[]) {
    const prev = checkinQueue
    setCheckinQueue(next)
    const nextIds = new Set(next.map(q => q.id))
    for (const item of prev) {
      if (!nextIds.has(item.id) && !item.id.startsWith('q-tmp-')) {
        fetch(`/api/nets/${netId}/queue`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: item.id }),
        })
      }
    }
    for (const item of next) {
      const before = prev.find(q => q.id === item.id)
      if (before && before !== item && !item.id.startsWith('q-tmp-')) {
        const payload: Record<string, unknown> = { ...item }
        delete payload.id
        fetch(`/api/nets/${netId}/queue`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: item.id, payload }),
        })
      }
    }
  }

  async function commitQueue() {
    if (checkinQueue.length === 0) return
    setCommitting(true)

    type QEvent = { type: 'checkin' | 'traffic' | 'announcement'; item: typeof checkinQueue[0]; timestamp: string }
    const events: QEvent[] = []

    for (const item of checkinQueue) {
      events.push({ type: 'checkin', item, timestamp: item.timestamp })
      if (item.hasTraffic && item.trafficText) {
        events.push({ type: 'traffic', item, timestamp: item.trafficTimestamp || new Date(new Date(item.timestamp).getTime() + 500).toISOString() })
      }
      if (item.hasAnnouncement && item.announcementText) {
        events.push({ type: 'announcement', item, timestamp: item.announcementTimestamp || new Date(new Date(item.timestamp).getTime() + 1000).toISOString() })
      }
    }

    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const stationIds: Record<string, string> = {}

    for (const evt of events) {
      if (evt.type === 'checkin') {
        const res = await fetch(`/api/nets/${netId}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callsign: evt.item.callsign,
            first_name: evt.item.firstName || undefined,
            last_name: evt.item.lastName || undefined,
            station_type: evt.item.stationType || undefined,
            location: evt.item.location || undefined,
            quadrant: evt.item.quadrant || undefined,
            siren_numbers: evt.item.sirenNumbers.map(s => s.trim()).filter(Boolean),
            has_traffic: evt.item.hasTraffic,
            has_announcements: evt.item.hasAnnouncement,
            checked_in_at: evt.timestamp,
            manual_prefix: evt.item.forceManual ? 'MANUAL: ' : '',
            entry_type: evt.item.late ? 'late_checkin' : undefined,
          }),
        })
        if (res.ok) {
          const logEntry = await res.json()
          stationIds[evt.item.callsign] = logEntry.id
        }
        if (evt.item.moved) {
          await fetch(`/api/nets/${netId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry_type: 'station_moved',
              content: `${evt.item.callsign} moved${evt.item.location ? ' to ' + evt.item.location : ''}`,
              callsign: evt.item.callsign,
            }),
          })
        }
      } else {
        await fetch(`/api/nets/${netId}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_type: evt.type,
            content: `${evt.item.callsign}: ${evt.type === 'traffic' ? evt.item.trafficText : evt.item.announcementText}`,
            metadata: { callsign: evt.item.callsign },
            timestamp: evt.timestamp,
          }),
        })
      }
    }

    await fetch(`/api/nets/${netId}/queue`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setCheckinQueue([])
    setCommitting(false)
    fetchAll()
  }

  // Siren start/stop status lives in the log as note entries; the button
  // state persists across pages because it derives from logEntries.
  const sirenStartEntry = logEntries.find(e => e.entry_type === 'note' && (e.metadata as Record<string, unknown> | null)?.siren_event === 'started')
  const sirenStopEntry = logEntries.find(e => e.entry_type === 'note' && (e.metadata as Record<string, unknown> | null)?.siren_event === 'stopped')

  async function logSirenEvent(event: 'started' | 'stopped') {
    if (!net) return
    setSirenBusy(true)
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'note',
        content: `Sirens ${event} — logged by ${net.net_controller}`,
        metadata: { siren_event: event },
      }),
    })
    setSirenBusy(false)
    fetchAll()
  }

  async function resetSirenStatus() {
    setSirenBusy(true)
    for (const entry of [sirenStartEntry, sirenStopEntry]) {
      if (!entry) continue
      await fetch(`/api/nets/${netId}/log`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entry.id }),
      })
    }
    setSirenBusy(false)
    setSirenResetConfirm(false)
    fetchAll()
  }

  // Skywarn NC handoff: PATCH the net record, log the handoff, and make sure
  // the incoming NC is checked in. Scripts pick up the new callsign from the
  // net record; other devices see it via realtime.
  async function transferNetControl(to: string) {
    if (!net) return
    const target = to.toUpperCase().trim()
    if (!target || target === net.net_controller.toUpperCase()) return
    setTransferBusy(true)
    const from = net.net_controller
    await fetch(`/api/nets/${netId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ net_controller: target }),
    })
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'note',
        content: `Net control transferred from ${from} to ${target}`,
        callsign: target,
        metadata: { nc_handoff: { from, to: target } },
      }),
    })
    if (!stations.some(s => s.callsign.toUpperCase() === target)) {
      await fetch(`/api/nets/${netId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: target }),
      })
    }
    setTransferBusy(false)
    setTransferOpen(false)
    setTakeConfirmOpen(false)
    setTransferTarget('')
    fetchAll()
  }

  async function logQsy() {
    if (!qsyText.trim()) return
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'note',
        content: `QSY: net moving to ${qsyText.trim()}`,
        metadata: { qsy: true },
      }),
    })
    setQsyOpen(false)
    setQsyText('')
    fetchAll()
  }

  function openQsy() {
    if (!net) return
    setQsyText(
      net.type === 'ares'
        ? '147.120 MHz repeater (88.5 PL)'
        : net.type === 'skywarn'
        ? '443.250 repeater (100 PL)'
        : ''
    )
    setQsyOpen(true)
  }

  async function closeNet() {
    if (!net) return
    setClosing(true)
    const now = appNow().toISOString()
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'net_close',
        content: `Net closed at ${format(new Date(now), 'HH:mm')} local`,
      }),
    })
    await fetch(`/api/nets/${netId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    })
    router.push(`/net/${netId}/report`)
  }

  if (!net) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-fg-3">Loading...</div>
      </div>
    )
  }

  const isNC = !!deviceCallsign && deviceCallsign === net.net_controller.toUpperCase()
  const baseStations = stations.filter(s => s.station_type === 'base').length
  const mobileStations = stations.filter(s => s.station_type === 'mobile').length
  const reportEntries = logEntries.filter(e => e.entry_type === 'report').length
  const circleBackAvailable = net.type === 'skywarn' || net.type === 'siren'
  // Siren nets: a station is complete once it has a location or at least one
  // siren number. Skywarn still needs base/mobile and location.
  const isIncomplete = (s: DerivedStation) =>
    net.type === 'siren'
      ? !s.location && s.siren_numbers.length === 0
      : !s.station_type || !s.location
  const incompleteStations = (net.type === 'skywarn' || net.type === 'siren')
    ? stations.filter(isIncomplete).length
    : 0

  const sectionNav = (position: 'top' | 'bottom' = 'bottom') => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setSectionIndex(i => Math.max(0, i - 1))}
          disabled={sectionIndex === 0}
          variant="outline"
          className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        {position === 'top' && (net?.type === 'ares' || net?.type === 'skywarn') && (
          <Button
            onClick={() => setSetupComplete(false)}
            size="sm"
            variant="outline"
            className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg text-xs"
          >
            Change Setup
          </Button>
        )}
      </div>

      <span className="text-fg-4 text-sm">
        {sectionIndex + 1} / {sections.length}
      </span>

      <div className="flex items-center gap-2">
        {net?.type === 'siren' && (
          !sirenStartEntry ? (
            <Button
              onClick={() => logSirenEvent('started')}
              disabled={sirenBusy}
              className="bg-green-700 hover:bg-green-600 font-semibold"
            >
              SIRENS STARTED
            </Button>
          ) : !sirenStopEntry ? (
            <Button
              onClick={() => logSirenEvent('stopped')}
              disabled={sirenBusy}
              className="bg-red-700 hover:bg-red-600 font-semibold"
            >
              SIRENS STOPPED
            </Button>
          ) : (
            <Button
              onClick={() => setSirenResetConfirm(true)}
              disabled={sirenBusy}
              className="bg-surface-4 hover:bg-surface-5 font-semibold"
            >
              RESET SIREN STATUS
            </Button>
          )
        )}

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
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <div className="bg-surface-1 border-b border-surface-2 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Badge
              className={`text-fg flex-shrink-0 ${
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
            <span className="text-fg font-semibold truncate">{net.net_controller}</span>
            <span className="text-fg-4 text-sm hidden sm:block">NC</span>
            <button
              onClick={() => { setOperatingDraft(deviceCallsign); setOperatingPromptOpen(true) }}
              className="text-xs px-2 py-1 rounded border border-surface-3 bg-surface-2 text-fg-3 hover:text-fg-1 hidden sm:block"
              title="Who is operating this device"
            >
              {deviceCallsign ? `You: ${deviceCallsign}${isNC ? ' (NC)' : ''}` : 'Set operator'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {net.type === 'skywarn' && !net.closed && (
              isNC ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setTransferTarget(''); setTransferOpen(true) }}
                  className="border-orange-700 bg-orange-950/40 text-orange-300 hover:bg-orange-900/50 hover:text-orange-200"
                >
                  Transfer NC
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!deviceCallsign) { setOperatingDraft(''); setOperatingPromptOpen(true); return }
                    setTakeConfirmOpen(true)
                  }}
                  className="border-orange-700 bg-orange-950/40 text-orange-300 hover:bg-orange-900/50 hover:text-orange-200"
                >
                  Take Net Control
                </Button>
              )
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={openQsy}
              className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg hidden sm:inline-flex"
              title="Log a frequency/repeater change"
            >
              QSY
            </Button>
            {elapsed && (
              <span className="text-fg-3 text-sm hidden md:block">
                Open: {elapsed}
              </span>
            )}
            <button
              onClick={() => setSortBySuffix(!sortBySuffix)}
              className={`text-xs px-2 py-1 rounded border transition-colors hidden sm:block ${
                sortBySuffix
                  ? 'bg-blue-600/20 border-blue-600 text-blue-300'
                  : 'bg-surface-2 border-surface-3 text-fg-3'
              }`}
              title="Toggle callsign sort order"
            >
              {sortBySuffix ? 'Suffix' : 'Call'}
            </button>
            <div className="flex gap-1 text-xs text-fg-3">
              <span className="bg-surface-2 px-2 py-1 rounded">{stations.length} stns</span>
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
              className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg gap-1"
            >
              <ScrollText className="w-4 h-4" />
              <span className="hidden sm:inline">Full Script</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Setup step for ARES */}
      {net.type === 'ares' && !setupComplete && (
        <div className="max-w-2xl mx-auto w-full p-4">
          <SetupNet
            netId={netId}
            initialConfig={net.config ? setupConfig : null}
            isResuming={logEntries.length > 0}
            onComplete={async config => {
              await saveNetConfig({
                prev_net_id: config.prevNetId,
                announcement_url: config.announcementUrl,
                checklist_url: config.checklistUrl,
              })
              if (logEntries.length === 0) {
                await fetch(`/api/nets/${netId}/start`, { method: 'POST' })
                await fetchAll()
              }
              setSetupComplete(true)
            }}
          />
        </div>
      )}

      {/* Setup step for Skywarn */}
      {net.type === 'skywarn' && !setupComplete && (
        <div className="max-w-2xl mx-auto w-full p-4">
          <SetupSkywarn
            initialWeatherStatus={weatherStatus}
            initialBulletin={bulletin}
            isResuming={logEntries.length > 0}
            onComplete={async config => {
              await saveNetConfig({
                weather_status: config.weatherStatus,
                nws_bulletin: config.bulletin || null,
              })
              if (logEntries.length === 0) {
                await fetch(`/api/nets/${netId}/start`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nc_quadrant: config.ncQuadrant || null }),
                })
                await fetchAll()
              }
              setSetupComplete(true)
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 max-w-7xl mx-auto w-full p-4 flex flex-col lg:flex-row gap-4${(net.type === 'ares' || net.type === 'skywarn') && !setupComplete ? ' hidden' : ''}`}>
        {/* Left: Section jump nav */}
        {sections.length > 1 && (
          <div className="hidden lg:flex flex-col gap-0.5 w-32 flex-shrink-0 pt-1">
            {sections.map((s, i) => {
              const shortLabel = s.title
                .replace('Check-ins: ', '')
                .replace(' Quadrant', '')
                .replace('Closing', 'Close')
                .replace('Continue Running the Net', 'Continue...')
              return (
                <button
                  key={s.id}
                  onClick={() => setSectionIndex(i)}
                  className={`text-left px-2 py-1 text-xs rounded transition-colors truncate ${
                    i === sectionIndex
                      ? 'bg-blue-600 text-white font-semibold'
                      : i < sectionIndex
                      ? 'text-fg-2 hover:text-fg hover:bg-surface-2'
                      : 'text-fg-4 hover:text-fg-2 hover:bg-surface-2'
                  }`}
                >
                  {shortLabel}
                  {s.id === 'reports_and_circleback' && incompleteStations > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 ml-1 text-amber-400 inline-block flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Center: Script */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {sectionNav('top')}

          {net?.type === 'skywarn' && (
            <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 flex items-center gap-x-6 gap-y-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-fg-3 text-sm font-medium">Weather status:</span>
                <button
                  onClick={() => saveNetConfig({ weather_status: weatherStatus === 'approaching' ? null : 'approaching' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    weatherStatus === 'approaching'
                      ? 'bg-orange-600 text-white'
                      : 'bg-surface-2 text-fg-3 hover:text-fg-1 border border-surface-3'
                  }`}
                >
                  Approaching
                </button>
                <button
                  onClick={() => saveNetConfig({ weather_status: weatherStatus === 'imminent' ? null : 'imminent' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    weatherStatus === 'imminent'
                      ? 'bg-red-600 text-white'
                      : 'bg-surface-2 text-fg-3 hover:text-fg-1 border border-surface-3'
                  }`}
                >
                  Imminent
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setBulletinDraft(bulletin)
                    setBulletinModalOpen(true)
                  }}
                  className="bg-surface-2 hover:bg-surface-3 text-fg-1 border border-surface-3 gap-1"
                >
                  <FileText className="w-4 h-4" />
                  {bulletin ? 'Edit NWS Bulletin' : 'Paste current NWS Bulletin'}
                </Button>
                {bulletin && (
                  <span className="text-green-400 text-xs">Bulletin loaded</span>
                )}
              </div>
            </div>
          )}

          {bulletinModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-lg p-5 space-y-4">
                <h3 className="text-fg font-semibold">
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
                  className="bg-surface-2 border-surface-3 text-fg text-sm"
                  rows={8}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulletinModalOpen(false)}
                    className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
                  >
                    Cancel
                  </Button>
                  {bulletin && (
                    <Button
                      size="sm"
                      onClick={() => {
                        saveNetConfig({ nws_bulletin: null })
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
                      saveNetConfig({ nws_bulletin: bulletinDraft.trim() || null })
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

          {net.type === 'ares' && section?.id === 'announcements' && (
            <div className="bg-surface-1 rounded-xl border border-surface-3 p-4">
              <div className="bg-surface-0 rounded-lg p-4 font-mono text-base leading-7 text-fg-1 whitespace-pre-wrap border border-surface-2">
                This is {net.net_controller} for the Marion County ARES Net.
              </div>
            </div>
          )}

          {net.type === 'ares' && section?.id === 'announcements' && (
            <AnnouncementsSection
              stations={stations}
              logEntries={logEntries}
              netId={netId}
              announcementUrl={setupConfig?.announcementUrl || null}
              onUpdate={fetchAll}
            />
          )}

          {net.type === 'ares' && section?.id === 'roll_call' && setupConfig?.checklistUrl && (
            <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 space-y-3">
              <p className="text-fg-3 italic font-mono text-sm">
                Read the previously downloaded Check-In spreadsheet from the previous net.
              </p>
              <a
                href={setupConfig.checklistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
              >
                <Download className="w-4 h-4" />
                Download again
              </a>
            </div>
          )}

          {net.type === 'ares' && section?.id === 'traffic' && (
            <TrafficSection
              stations={stations}
              logEntries={logEntries}
              netId={netId}
              roster={roster}
              onUpdate={fetchAll}
            />
          )}

          {section?.id === 'reports_and_circleback' && incompleteStations > 0 && (
            <div className="flex items-center gap-2 text-amber-400/80 text-sm bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              There are {incompleteStations} station{incompleteStations > 1 ? 's' : ''} with incomplete information.
            </div>
          )}

          {section?.type === 'closenet' && (net.type === 'skywarn' || net.type === 'siren') && (() => {
            const incomplete = stations.filter(isIncomplete).length
            if (incomplete === 0) return null
            const circleBackIdx = sections.findIndex(s => s.id === 'reports_and_circleback' || s.id === 'post_siren')
            return (
              <div className="bg-red-950/40 border border-red-700 rounded-xl p-4 space-y-2">
                <div className="text-red-300 text-sm font-medium">
                  WARNING: INCOMPLETE DATA. There are {incomplete} station{incomplete > 1 ? 's' : ''} that require additional information such as Base/Mobile, or their Location. Please Circle Back to collect before closing the net.
                </div>
                {circleBackIdx >= 0 && (
                  <Button
                    size="sm"
                    onClick={() => setSectionIndex(circleBackIdx)}
                    className="bg-amber-700 hover:bg-amber-600 text-white gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Go to Circle Back
                  </Button>
                )}
              </div>
            )
          })()}

          {section && !(net.type === 'ares' && (section.id === 'announcements' || section.id === 'traffic')) && (
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
                    saved: inputSaved(field.id),
                    onChange: (v: string) => setSectionInputs(prev => ({ ...prev, [field.id]: v })),
                    onSave: () => saveSectionInputs(),
                    roster: roster.map(r => ({ callsign: r.callsign, first_name: r.first_name, last_name: r.last_name, source: 'roster' as const })),
                  }
                  return acc
                }, {} as Record<string, { value: string; placeholder?: string; label?: string; saved?: boolean; onChange: (v: string) => void; onSave: () => void; roster?: { callsign: string; first_name?: string | null; last_name?: string | null; source: 'roster' }[] }>)
              }
              onTakeReports={() => {
                setSectionIndex(i => Math.min(sections.length - 1, i + 1))
                setActiveTab('report')
              }}
              incompleteStations={incompleteStations}
              onCircleBack={() => setActiveTab('stations')}
              onContinuityLog={async () => {
                await fetch(`/api/nets/${netId}/log`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entry_type: 'continuity', content: 'Continuity announcement made' }),
                })
                fetchAll()
              }}
            />
          )}

          {/* Section input fields (non-inline only) */}
          {section?.inputFields && section.inputFields.filter(f => !f.inline).length > 0 && (
            <div className="bg-surface-1 rounded-xl border border-surface-3 p-4 space-y-3">
              <h3 className="text-fg font-medium text-sm">Net Control Inputs</h3>
              {section.inputFields.filter(f => !f.inline).map(field => (
                <div key={field.id}>
                  <Label className="text-fg-3 text-xs mb-1 block">{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={sectionInputs[field.id] || ''}
                      onChange={e =>
                        setSectionInputs(prev => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="bg-surface-2 border-surface-3 text-fg text-sm"
                      rows={4}
                    />
                  ) : field.type === 'select' && field.options ? (
                    <Select
                      value={sectionInputs[field.id] || ''}
                      onValueChange={v => setSectionInputs(prev => ({ ...prev, [field.id]: v } as Record<string, string>))}
                    >
                      <SelectTrigger className="bg-surface-2 border-surface-3 text-fg">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-2 border-surface-3">
                        {field.options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-fg">
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
                      className="bg-surface-2 border-surface-3 text-fg uppercase font-mono"
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

          {sectionNav('bottom')}

          <RecentLog entries={logEntries} netId={netId} onUpdate={fetchAll} reversed stations={stations} roster={roster} netType={net.type} sirens={sirens} />
        </div>

        {/* Right: Tabs panel */}
        <div className="w-full lg:w-96 flex flex-col gap-0 bg-surface-1 rounded-xl border border-surface-3 overflow-hidden">
          {/* Tab bar */}
          <div className="flex flex-wrap border-b border-surface-3">
            {tabs
              .filter(t => t.show)
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { userPickedTabRef.current = true; setActiveTab(tab.id) }}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-fg'
                      : 'border-transparent text-fg-3 hover:text-fg-1'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            <button
              onClick={() => setAddToLogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 border-transparent text-green-400 hover:text-green-300 ml-auto"
            >
              <Plus className="w-4 h-4" />
              Add to Log
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'checkin' && section?.allowCheckins && (
              net.type === 'ares' && section.id === 'roll_call' && !rollCallSkipped && setupConfig.prevNetId ? (
                <RollCallList
                  netId={netId}
                  prevNetId={setupConfig.prevNetId}
                  currentStations={stations}
                  onUpdate={fetchAll}
                  onSkip={() => setRollCallSkipped(true)}
                  sortBySuffix={sortBySuffix}
                />
              ) : (
                <>
                  <CheckinForm
                    netId={netId}
                    netType={net.type}
                    onCheckin={fetchAll}
                    requireStationType={false}
                    showQuadrant={net.type === 'skywarn'}
                    defaultQuadrant={
                      section?.id === 'checkin_sw' ? 'SW' :
                      section?.id === 'checkin_nw' ? 'NW' :
                      section?.id === 'checkin_ne' ? 'NE' :
                      section?.id === 'checkin_se' ? 'SE' : ''
                    }
                    callsignOnly={
                      net.type === 'siren' && section.id === 'preamble'
                    }
                    showTrafficInputs={
                      net.type === 'ares' && section.id === 'short_time'
                    }
                    late={net.type === 'ares' && section.id === 'late_checkins'}
                    roster={roster}
                    currentStations={stations}
                    onQueue={useQueue ? addToQueue : undefined}
                  />
                  {(useQueue || checkinQueue.length > 0) && (
                    <CheckinQueue
                      queue={checkinQueue}
                      onUpdate={syncQueue}
                      onCommit={commitQueue}
                      committing={committing}
                      showTrafficInputs={net.type === 'ares' && section.id === 'short_time'}
                      showFlags={net.type === 'ares'}
                      roster={roster}
                      netType={net.type}
                      stations={stations}
                      sirens={sirens}
                    />
                  )}
                </>
              )
            )}

            {activeTab === 'report' && section?.allowReports && (
              <ReportForm
                netId={netId}
                netType={net.type}
                stations={stations}
                onReport={fetchAll}
                roster={roster}
                logEntries={logEntries}
                testing={net.testing}
                sirens={sirens}
              />
            )}

            {activeTab === 'stations' && (
              <StationList
                stations={stations}
                netId={netId}
                netType={net.type}
                showCircleBack={circleBackAvailable}
                onUpdate={fetchAll}
                roster={roster}
                sirens={sirens}
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
                  className="w-full mb-3 border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 gap-1"
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
                  roster={roster}
                  netType={net.type}
                  sirens={sirens}
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
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-3">
              <h3 className="text-fg font-semibold">Full Net Log</h3>
              <button onClick={() => setFullLogOpen(false)} className="text-fg-3 hover:text-fg">
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
                roster={roster}
                netType={net.type}
                sirens={sirens}
              />
            </div>
          </div>
        </div>
      )}

      {sirenResetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-fg font-semibold">Reset Siren Status</h3>
            <p className="text-fg-2 text-sm">
              This removes both the sirens started and sirens stopped log entries. Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSirenResetConfirm(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={resetSirenStatus}
                disabled={sirenBusy}
                className="bg-red-700 hover:bg-red-600"
              >
                {sirenBusy ? 'Removing...' : 'Yes, Remove Entries'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {operatingPromptOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-fg font-semibold">Who is operating this device?</h3>
            <p className="text-fg-3 text-sm">
              Remembered on this device. Lets the app tell net control apart from stations watching along.
            </p>
            <CallsignAutocomplete
              value={operatingDraft}
              onChange={setOperatingDraft}
              onSelect={s => setOperatingDraft(s.callsign)}
              roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
              placeholder="Your callsign"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem('operatingSkip', '1')
                  setOperatingPromptOpen(false)
                }}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Skip — just watching
              </Button>
              <Button
                size="sm"
                disabled={!operatingDraft.trim()}
                onClick={() => {
                  setDeviceCallsign(operatingDraft)
                  setOperatingPromptOpen(false)
                }}
                className="bg-blue-700 hover:bg-blue-600"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {transferOpen && net && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-fg font-semibold">Transfer Net Control</h3>
            <p className="text-fg-3 text-sm">
              Hands the net from {net.net_controller} to the callsign below. All scripts switch to the new NC and the handoff is logged.
            </p>
            <CallsignAutocomplete
              value={transferTarget}
              onChange={setTransferTarget}
              onSelect={s => setTransferTarget(s.callsign)}
              stations={stations.map(s => ({ callsign: s.callsign, first_name: s.first_name, last_name: s.last_name, source: 'station' as const }))}
              roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
              placeholder="New NC callsign"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTransferOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={transferBusy || !transferTarget.trim()}
                onClick={() => transferNetControl(transferTarget)}
                className="bg-orange-700 hover:bg-orange-600"
              >
                {transferBusy ? 'Transferring...' : 'Transfer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {takeConfirmOpen && net && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-fg font-semibold">Take Net Control</h3>
            <p className="text-fg-2 text-sm">
              Take over as net control from {net.net_controller}, operating as {deviceCallsign}? The handoff is logged and scripts switch to your callsign.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTakeConfirmOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={transferBusy}
                onClick={() => transferNetControl(deviceCallsign)}
                className="bg-orange-700 hover:bg-orange-600"
              >
                {transferBusy ? 'Taking over...' : 'Yes, Take Net Control'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {qsyOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-surface-3 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-fg font-semibold">Log QSY</h3>
            <p className="text-fg-3 text-sm">Repeater failure or frequency change. Logs where the net is moving.</p>
            <Input
              value={qsyText}
              onChange={e => setQsyText(e.target.value)}
              placeholder="e.g. 147.120 MHz repeater (88.5 PL)"
              className="bg-surface-2 border-surface-3 text-fg"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQsyOpen(false)}
                className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!qsyText.trim()}
                onClick={logQsy}
                className="bg-blue-700 hover:bg-blue-600"
              >
                Log QSY
              </Button>
            </div>
          </div>
        </div>
      )}

      {addToLogOpen && (
        <AddToLogModal
          netId={netId}
          stations={stations}
          roster={roster}
          onSave={() => { setAddToLogOpen(false); fetchAll() }}
          onClose={() => setAddToLogOpen(false)}
        />
      )}
    </div>
  )
}

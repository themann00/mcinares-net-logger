'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus } from 'lucide-react'
import { CallsignAutocomplete } from '@/components/CallsignAutocomplete'
import { useAppState } from '@/components/AppContext'
import type { NetType, Quadrant, StationType } from '@/types'

interface RosterEntry {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

interface CheckinFormProps {
  netId: string
  netType: NetType
  onCheckin: () => void
  requireStationType?: boolean
  showQuadrant?: boolean
  defaultQuadrant?: Quadrant | ''
  callsignOnly?: boolean
  showTrafficInputs?: boolean
  /** Log as late_checkin instead of checkin (ARES late check-ins section) */
  late?: boolean
  roster?: RosterEntry[]
  currentStations?: { callsign: string }[]
  /** Callsigns already sitting in the uncommitted check-in queue */
  queuedCallsigns?: string[]
  onQueue?: (entry: { callsign: string; firstName: string; lastName: string; stationType: string; location: string; quadrant: string; hasTraffic: boolean; hasAnnouncement: boolean; trafficText: string; announcementText: string; trafficTimestamp?: string; announcementTimestamp?: string; forceManual?: boolean }) => void
}

export function CheckinForm({
  netId,
  netType,
  onCheckin,
  requireStationType = false,
  showQuadrant = false,
  defaultQuadrant = '',
  callsignOnly = false,
  showTrafficInputs = false,
  late = false,
  roster = [],
  currentStations = [],
  queuedCallsigns = [],
  onQueue,
}: CheckinFormProps) {
  const { appNow } = useAppState()
  const callsignRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // Fast-submit: Enter selects the highlighted station and logs immediately.
  // On by default; toggle off to make Enter only pick the suggestion.
  const [fastSubmit, setFastSubmit] = useState(true)
  const [callsign, setCallsignRaw] = useState('')
  const [dupeWarning, setDupeWarning] = useState(false)
  const setCallsign = (v: string) => { setCallsignRaw(v); if (dupeWarning) setDupeWarning(false) }
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [stationType, setStationType] = useState<StationType | ''>('')
  const [location, setLocation] = useState('')
  const [quadrant, setQuadrant] = useState<Quadrant | ''>(defaultQuadrant)
  const [report, setReport] = useState('')
  const [hasTraffic, setHasTraffic] = useState(false)
  const [hasAnnouncement, setHasAnnouncement] = useState(false)
  const [trafficStarted, setTrafficStarted] = useState<string | null>(null)
  const [announcementStarted, setAnnouncementStarted] = useState<string | null>(null)
  const [trafficText, setTrafficText] = useState('')
  const [announcementText, setAnnouncementText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setQuadrant(defaultQuadrant)
  }, [defaultQuadrant])

  const isAres = netType === 'ares'
  const isSkywarn = netType === 'skywarn'

  // First check-in on record: callsign looks complete and the roster (which
  // accumulates every station ever checked in) has never seen it. Informational
  // only — the roster is still being built, so no action required.
  const cs_ = callsign.trim().toUpperCase()
  const looksLikeCallsign = /^[A-Z]{1,2}\d[A-Z]{1,4}$/.test(cs_)
  const isFirstTimer =
    looksLikeCallsign &&
    roster.length > 0 &&
    !roster.some(r => r.callsign.toUpperCase() === cs_) &&
    !currentStations.some(s => s.callsign.toUpperCase() === cs_)

  function resetForm() {
    setCallsignRaw('')
    setFirstName('')
    setLastName('')
    setStationType('')
    setLocation('')
    setQuadrant(defaultQuadrant)
    setReport('')
    setHasTraffic(false)
    setHasAnnouncement(false)
    setTrafficText('')
    setAnnouncementText('')
    setTrafficStarted(null)
    setAnnouncementStarted(null)
    setDupeWarning(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callsign.trim()) return
    if (requireStationType && !stationType) {
      setError('Please select Base or Mobile.')
      return
    }

    const cs = callsign.trim().toUpperCase()
    const alreadyIn = currentStations.some(s => s.callsign.toUpperCase() === cs)
    const alreadyQueued = queuedCallsigns.some(q => q.toUpperCase().trim() === cs)

    if ((alreadyIn || alreadyQueued) && !dupeWarning) {
      setDupeWarning(true)
      return
    }

    if (onQueue) {
      onQueue({
        callsign: cs,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        stationType: stationType,
        location: location.trim(),
        quadrant: quadrant,
        hasTraffic,
        hasAnnouncement,
        trafficText: trafficText.trim(),
        announcementText: announcementText.trim(),
        trafficTimestamp: trafficStarted || undefined,
        announcementTimestamp: announcementStarted || undefined,
        forceManual: alreadyIn,
      })
      resetForm()
      setDupeWarning(false)
      setTimeout(() => callsignRef.current?.querySelector('input')?.focus(), 50)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/nets/${netId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign: callsign.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          station_type: stationType || undefined,
          location: location.trim() || undefined,
          quadrant: quadrant || undefined,
          has_traffic: hasTraffic,
          has_announcements: hasAnnouncement,
          report: report.trim() || undefined,
          entry_type: late ? 'late_checkin' : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to add station')
      }

      if (showTrafficInputs) {
        if (hasTraffic) {
          await fetch(`/api/nets/${netId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry_type: 'traffic',
              content: `${callsign.trim().toUpperCase()}: ${trafficText.trim() || 'N/A'}`,
              callsign: callsign.trim().toUpperCase(),
            }),
          })
        }
        if (hasAnnouncement) {
          await fetch(`/api/nets/${netId}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry_type: 'announcement',
              content: `${callsign.trim().toUpperCase()}: ${announcementText.trim() || 'N/A'}`,
              callsign: callsign.trim().toUpperCase(),
            }),
          })
        }
      }

      setCallsign('')
      setFirstName('')
      setLastName('')
      setStationType('')
      setLocation('')
      setQuadrant(defaultQuadrant)
      setReport('')
      setHasTraffic(false)
      setHasAnnouncement(false)
      setTrafficText('')
      setAnnouncementText('')
      onCheckin()
      setTimeout(() => callsignRef.current?.querySelector('input')?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1" ref={callsignRef}>
          <Label className="text-fg-3 text-xs mb-1 block">Callsign *</Label>
          <CallsignAutocomplete
            value={callsign}
            onChange={setCallsign}
            onSelect={s => {
              setCallsign(s.callsign)
              if (s.first_name) setFirstName(s.first_name)
              if (s.last_name) setLastName(s.last_name)
            }}
            roster={roster.map(r => ({ ...r, source: 'roster' as const }))}
            autoFocus
            onEnter={fastSubmit ? () => formRef.current?.requestSubmit() : undefined}
          />
          {isFirstTimer && (
            <p className="text-amber-400/90 text-xs mt-1">
              NEW — first check-in on record. Grab their name if you can.
            </p>
          )}
        </div>
        {!callsignOnly && (netType === 'skywarn' || netType === 'siren') && (
          <div className="w-32">
            <Label className="text-fg-3 text-xs mb-1 block">
              Type {requireStationType ? '*' : ''}
            </Label>
            <Select value={stationType} onValueChange={v => setStationType(v as StationType)}>
              <SelectTrigger
                className="bg-surface-2 border-surface-3 text-fg"
                onKeyDown={e => {
                  if (e.key === 'Enter' && stationType) {
                    e.preventDefault()
                    e.currentTarget.closest('form')?.requestSubmit()
                  }
                }}
              >
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-surface-3">
                <SelectItem value="base" className="text-fg">Base</SelectItem>
                <SelectItem value="mobile" className="text-fg">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!callsignOnly && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">First Name</Label>
              <Input
                value={firstName}
                onChange={e => { const v = e.target.value; setFirstName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                placeholder="Optional"
                className="bg-surface-2 border-surface-3 text-fg"
              />
            </div>
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Last Name</Label>
              <Input
                value={lastName}
                onChange={e => { const v = e.target.value; setLastName(v.charAt(0).toUpperCase() + v.slice(1)) }}
                placeholder="Optional"
                className="bg-surface-2 border-surface-3 text-fg"
              />
            </div>
          </div>

          {showQuadrant && (
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">Quadrant</Label>
              <Select value={quadrant} onValueChange={v => setQuadrant(v as Quadrant)}>
                <SelectTrigger
                  className="bg-surface-2 border-surface-3 text-fg"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && quadrant) {
                      e.preventDefault()
                      e.currentTarget.closest('form')?.requestSubmit()
                    }
                  }}
                >
                  <SelectValue placeholder="Select quadrant..." />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-surface-3">
                  <SelectItem value="SW" className="text-fg">SW — S of Washington, W of Meridian</SelectItem>
                  <SelectItem value="NW" className="text-fg">NW — N of Washington, W of Meridian</SelectItem>
                  <SelectItem value="NE" className="text-fg">NE — N of Washington, E of Meridian</SelectItem>
                  <SelectItem value="SE" className="text-fg">SE — S of Washington, E of Meridian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-fg-3 text-xs mb-1 block">Location</Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={netType === 'siren' ? 'Siren # or cross street...' : 'Optional'}
              className="bg-surface-2 border-surface-3 text-fg"
            />
          </div>

          {(isSkywarn || netType === 'siren') && (
            <div>
              <Label className="text-fg-3 text-xs mb-1 block">
                {netType === 'siren' ? 'Siren Report' : 'Weather Report'}
              </Label>
              <Textarea
                value={report}
                onChange={e => setReport(e.target.value)}
                placeholder="Optional — report at check-in"
                className="bg-surface-2 border-surface-3 text-fg text-sm"
                rows={2}
              />
            </div>
          )}

          {isAres && (
            <div className="space-y-2">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-fg-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasTraffic}
                    onChange={e => setHasTraffic(e.target.checked)}
                    className="rounded"
                  />
                  Has Traffic
                </label>
                <label className="flex items-center gap-2 text-fg-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAnnouncement}
                    onChange={e => setHasAnnouncement(e.target.checked)}
                    className="rounded"
                  />
                  Has Announcement
                </label>
              </div>
              {showTrafficInputs && hasTraffic && (
                <div>
                  <Label className="text-yellow-400 text-xs mb-1 block">Traffic Summary</Label>
                  <Textarea
                    value={trafficText}
                    onChange={e => { if (!trafficStarted && e.target.value) setTrafficStarted(appNow().toISOString()); setTrafficText(e.target.value) }}
                    placeholder="Summarize traffic..."
                    className="bg-surface-2 border-surface-3 text-fg text-sm"
                    rows={2}
                  />
                </div>
              )}
              {showTrafficInputs && hasAnnouncement && (
                <div>
                  <Label className="text-teal-400 text-xs mb-1 block">Announcement Summary</Label>
                  <Textarea
                    value={announcementText}
                    onChange={e => { if (!announcementStarted && e.target.value) setAnnouncementStarted(appNow().toISOString()); setAnnouncementText(e.target.value) }}
                    placeholder="Summarize announcement..."
                    className="bg-surface-2 border-surface-3 text-fg text-sm"
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {dupeWarning && (
        <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-3 space-y-2">
          <p className="text-amber-300 text-sm font-medium">
            {callsign.trim().toUpperCase()} is already{' '}
            {currentStations.some(s => s.callsign.toUpperCase() === cs_)
              ? 'checked in.'
              : 'in the check-in queue.'}
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="bg-amber-700 hover:bg-amber-600"
            >
              {currentStations.some(s => s.callsign.toUpperCase() === cs_)
                ? 'Force Manual Check-in'
                : 'Queue Anyway'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setDupeWarning(false); resetForm(); setTimeout(() => callsignRef.current?.querySelector('input')?.focus(), 50) }}
              className="border-surface-4 bg-surface-2 text-fg-1 hover:bg-surface-3 hover:text-fg"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!dupeWarning && (
        <Button
          type="submit"
          disabled={loading || !callsign.trim()}
          className="w-full bg-green-700 hover:bg-green-600"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {loading ? 'Logging...' : 'Log Check-in'}
        </Button>
      )}

      {!dupeWarning && (
        <div className="space-y-2 pt-1">
          <p className="text-fg-4 text-xs leading-relaxed">
            <span className="text-fg-3 font-medium">Tab</span> selects the highlighted station and moves to the next field.{' '}
            <span className="text-fg-3 font-medium">Enter</span>{' '}
            {fastSubmit
              ? 'selects the highlighted station and logs the check-in right away.'
              : 'only selects the highlighted station.'}
          </p>
          <label className="flex items-center gap-2 text-fg-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={fastSubmit}
              onChange={e => setFastSubmit(e.target.checked)}
              className="rounded"
            />
            Enter logs the check-in immediately (fast submit)
          </label>
        </div>
      )}
    </form>
  )
}

'use client'

import { useState } from 'react'
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
import type { NetType, Quadrant, StationType } from '@/types'

interface CheckinFormProps {
  netId: string
  netType: NetType
  onCheckin: () => void
  requireStationType?: boolean
  showQuadrant?: boolean
  callsignOnly?: boolean
}

export function CheckinForm({
  netId,
  netType,
  onCheckin,
  requireStationType = false,
  showQuadrant = false,
  callsignOnly = false,
}: CheckinFormProps) {
  const [callsign, setCallsign] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [stationType, setStationType] = useState<StationType | ''>('')
  const [location, setLocation] = useState('')
  const [quadrant, setQuadrant] = useState<Quadrant | ''>('')
  const [report, setReport] = useState('')
  const [hasTraffic, setHasTraffic] = useState(false)
  const [hasAnnouncement, setHasAnnouncement] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAres = netType === 'ares'
  const isSkywarn = netType === 'skywarn'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callsign.trim()) return
    if (requireStationType && !stationType) {
      setError('Please select Base or Mobile.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/nets/${netId}/stations`, {
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
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to add station')
      }
      // Reset form
      setCallsign('')
      setFirstName('')
      setLastName('')
      setStationType('')
      setLocation('')
      setQuadrant('')
      setReport('')
      setHasTraffic(false)
      setHasAnnouncement(false)
      onCheckin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-gray-400 text-xs mb-1 block">Callsign *</Label>
          <Input
            value={callsign}
            onChange={e => setCallsign(e.target.value.toUpperCase())}
            placeholder="W9ABC"
            className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
            required
            autoFocus
          />
        </div>
        {!callsignOnly && (netType === 'skywarn' || netType === 'siren') && (
          <div className="w-32">
            <Label className="text-gray-400 text-xs mb-1 block">
              Type {requireStationType ? '*' : ''}
            </Label>
            <Select value={stationType} onValueChange={v => setStationType(v as StationType)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="base" className="text-white">Base</SelectItem>
                <SelectItem value="mobile" className="text-white">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!callsignOnly && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">First Name</Label>
              <Input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Optional"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Last Name</Label>
              <Input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Optional"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          {showQuadrant && (
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Quadrant</Label>
              <Select value={quadrant} onValueChange={v => setQuadrant(v as Quadrant)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select quadrant..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="SW" className="text-white">SW — S of Washington, W of Meridian</SelectItem>
                  <SelectItem value="NW" className="text-white">NW — N of Washington, W of Meridian</SelectItem>
                  <SelectItem value="NE" className="text-white">NE — N of Washington, E of Meridian</SelectItem>
                  <SelectItem value="SE" className="text-white">SE — S of Washington, E of Meridian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-gray-400 text-xs mb-1 block">Location</Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={netType === 'siren' ? 'Siren # or cross street...' : 'Optional'}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {(isSkywarn || netType === 'siren') && (
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">
                {netType === 'siren' ? 'Siren Report' : 'Weather Report'}
              </Label>
              <Textarea
                value={report}
                onChange={e => setReport(e.target.value)}
                placeholder="Optional — report at check-in"
                className="bg-gray-800 border-gray-700 text-white text-sm"
                rows={2}
              />
            </div>
          )}

          {isAres && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTraffic}
                  onChange={e => setHasTraffic(e.target.checked)}
                  className="rounded"
                />
                Has Traffic
              </label>
              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAnnouncement}
                  onChange={e => setHasAnnouncement(e.target.checked)}
                  className="rounded"
                />
                Has Announcement
              </label>
            </div>
          )}
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !callsign.trim()}
        className="w-full bg-green-700 hover:bg-green-600"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {loading ? 'Logging...' : 'Log Check-in'}
      </Button>
    </form>
  )
}

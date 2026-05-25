'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'
import type { NetType } from '@/types'

interface ReportFormProps {
  netId: string
  netType: NetType
  stations: { id: string; callsign: string }[]
  onReport: () => void
}

export function ReportForm({ netId, netType, stations, onReport }: ReportFormProps) {
  const [callsign, setCallsign] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)

    const prefix = callsign.trim() ? `${callsign.toUpperCase()}: ` : ''
    await fetch(`/api/nets/${netId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_type: 'report',
        content: `${prefix}${content.trim()}`,
        station_id: stations.find(s => s.callsign === callsign.toUpperCase())?.id,
      }),
    })

    setCallsign('')
    setContent('')
    setLoading(false)
    onReport()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="text-gray-400 text-xs mb-1 block">Station Callsign</Label>
        <Input
          value={callsign}
          onChange={e => setCallsign(e.target.value.toUpperCase())}
          placeholder="W9ABC (or type to match)"
          list="station-calls"
          className="bg-gray-800 border-gray-700 text-white uppercase font-mono"
        />
        <datalist id="station-calls">
          {stations.map(s => (
            <option key={s.id} value={s.callsign} />
          ))}
        </datalist>
      </div>
      <div>
        <Label className="text-gray-400 text-xs mb-1 block">
          {netType === 'siren' ? 'Siren Report' : 'Weather Report'} *
        </Label>
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={
            netType === 'siren'
              ? 'Siren #, location, rotation, damage/repair notes...'
              : 'Location, event type, measurement, time...'
          }
          className="bg-gray-800 border-gray-700 text-white"
          rows={3}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full bg-orange-700 hover:bg-orange-600"
      >
        <FileText className="w-4 h-4 mr-2" />
        {loading ? 'Logging...' : 'Log Report'}
      </Button>
    </form>
  )
}

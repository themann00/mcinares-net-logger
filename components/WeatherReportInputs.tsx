'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const REPORT_TYPES = [
  'Tornado', 'Funnel Cloud', 'Rotating Wall Clouds', 'Hail',
  'Wind', 'Flooding', 'Damage', 'Rainfall', 'Other',
] as const
export type ReportType = typeof REPORT_TYPES[number]

const HAIL_SIZES = [
  { name: 'Pea', size: '1/4"' },
  { name: 'Mothball', size: '1/2"' },
  { name: 'Penny', size: '3/4"' },
  { name: 'Nickel', size: '7/8"' },
  { name: 'Quarter', size: '1"' },
  { name: 'Ping Pong', size: '1.5"' },
  { name: 'Golf Ball', size: '1.75"' },
  { name: 'Hen Egg', size: '2"' },
  { name: 'Tennis Ball', size: '2.5"' },
  { name: 'Baseball', size: '2.75"' },
  { name: 'Softball', size: '4"' },
  { name: 'Grapefruit', size: '4.5"' },
  { name: 'End-of-the-world', size: '5+"' },
].map(h => ({ ...h, value: `${h.name} ${h.size}` }))

const BEAUFORT_SCALE = [
  { value: '12', label: '12 — Hurricane — 73+ mph — Widespread destruction' },
  { value: '11', label: '11 — Violent Storm — 64-72 mph — Widespread damage' },
  { value: '10', label: '10 — Storm — 55-63 mph — Trees uprooted, structural damage' },
  { value: '9', label: '9 — Strong Gale — 47-54 mph — Slight structural damage' },
  { value: '8', label: '8 — Fresh Gale — 39-46 mph — Twigs break from trees' },
  { value: '7', label: '7 — Near Gale — 32-38 mph — Whole trees in motion' },
  { value: '6', label: '6 — Strong Breeze — 25-31 mph — Large branches in motion' },
]

const FLOOD_SOURCES = ['Creek', 'Stream', 'River', 'Road']
const FLOOD_FLOW = ['Standing', 'Flowing']
const FLOOD_TREND = ['Rising', 'Steady', 'Receding']
const DAMAGE_TARGETS = ['Trees', 'Power Lines', 'Structures', 'Other']

interface WeatherReportInputsProps {
  onChange: (data: { reportType: ReportType; formatted: string; freeText: string; valid: boolean }) => void
  resetKey?: number
  compact?: boolean
}

export function WeatherReportInputs({ onChange, resetKey = 0, compact = false }: WeatherReportInputsProps) {
  const [reportType, setReportType] = useState<ReportType>('Other')
  const [freeText, setFreeText] = useState('')

  const [hailSize, setHailSize] = useState('')
  const [windForce, setWindForce] = useState('')
  const [floodSource, setFloodSource] = useState('')
  const [floodDepth, setFloodDepth] = useState('')
  const [floodFlow, setFloodFlow] = useState('')
  const [floodTrend, setFloodTrend] = useState('')
  const [damageTarget, setDamageTarget] = useState('Other')

  useEffect(() => {
    setReportType('Other')
    setFreeText('')
    setHailSize('')
    setWindForce('')
    setFloodSource('')
    setFloodDepth('')
    setFloodFlow('')
    setFloodTrend('')
    setDamageTarget('Other')
  }, [resetKey])

  useEffect(() => {
    const parts: string[] = []

    if (reportType === 'Hail' && hailSize) parts.push(hailSize)
    if (reportType === 'Wind' && windForce) {
      const entry = BEAUFORT_SCALE.find(b => b.value === windForce)
      if (entry) parts.push(entry.label)
    }
    if (reportType === 'Flooding') {
      if (floodSource) parts.push(floodSource)
      if (floodDepth) parts.push(`${floodDepth} inches`)
      if (floodFlow) parts.push(floodFlow)
      if (floodTrend) parts.push(floodTrend)
    }
    if (reportType === 'Damage' && damageTarget && damageTarget !== 'Other') parts.push(damageTarget)

    const prefix = parts.length > 0 ? parts.join(', ') + '. ' : ''
    const typePrefix = reportType !== 'Other' ? `${reportType.toUpperCase()}: ` : ''
    const formatted = `${typePrefix}${prefix}${freeText.trim()}`

    const hasFreeText = !!freeText.trim()
    const floodDropdownCount = [floodSource, floodDepth, floodFlow, floodTrend].filter(Boolean).length

    let valid = false
    if (reportType === 'Tornado' || reportType === 'Funnel Cloud' || reportType === 'Rotating Wall Clouds' || reportType === 'Other' || reportType === 'Rainfall') {
      valid = hasFreeText
    } else if (reportType === 'Hail') {
      valid = !!hailSize || hasFreeText
    } else if (reportType === 'Wind') {
      valid = !!windForce || hasFreeText
    } else if (reportType === 'Flooding') {
      valid = floodDropdownCount >= 2 || hasFreeText
    } else if (reportType === 'Damage') {
      valid = hasFreeText
    }

    onChange({ reportType, formatted, freeText, valid })
  }, [reportType, freeText, hailSize, windForce, floodSource, floodDepth, floodFlow, floodTrend, damageTarget])

  const rows = compact ? 2 : 3

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-gray-400 text-xs mb-1 block">Report Type</Label>
        <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {REPORT_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reportType === 'Hail' && (
        <div>
          <Label className="text-gray-400 text-xs mb-1 block">Hail Size</Label>
          <Select value={hailSize} onValueChange={v => setHailSize(v || '')}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select size...">
                {(value: string) => {
                  const h = HAIL_SIZES.find(x => x.value === value)
                  if (!h) return <span className="text-muted-foreground">Select size...</span>
                  return (
                    <>
                      <span className="flex-1">{h.name}</span>
                      <span className="text-gray-400">{h.size}</span>
                    </>
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
              {HAIL_SIZES.map(s => (
                <SelectItem key={s.value} value={s.value} className="text-white">
                  <span className="flex-1">{s.name}</span>
                  <span className="text-gray-400">{s.size}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {reportType === 'Wind' && (
        <div>
          <Label className="text-gray-400 text-xs mb-1 block">Beaufort Scale</Label>
          <Select value={windForce} onValueChange={v => setWindForce(v || '')}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select wind force..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 max-h-60">
              {BEAUFORT_SCALE.map(b => (
                <SelectItem key={b.value} value={b.value} className="text-white text-xs">{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {reportType === 'Flooding' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">What is flooding</Label>
              <Select value={floodSource} onValueChange={v => setFloodSource(v || '')}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {FLOOD_SOURCES.map(s => (
                    <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Depth (inches)</Label>
              <Input
                value={floodDepth}
                onChange={e => setFloodDepth(e.target.value)}
                placeholder="e.g. 6"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Water type</Label>
              <Select value={floodFlow} onValueChange={v => setFloodFlow(v || '')}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {FLOOD_FLOW.map(f => (
                    <SelectItem key={f} value={f} className="text-white">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs mb-1 block">Trend</Label>
              <Select value={floodTrend} onValueChange={v => setFloodTrend(v || '')}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {FLOOD_TREND.map(t => (
                    <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {reportType === 'Damage' && (
        <div>
          <Label className="text-gray-400 text-xs mb-1 block">Damage to</Label>
          <Select value={damageTarget} onValueChange={v => setDamageTarget(v || '')}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {DAMAGE_TARGETS.map(d => (
                <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-gray-400 text-xs mb-1 block">Details</Label>
        <Textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          placeholder="Location, time, additional details..."
          className="bg-gray-800 border-gray-700 text-white text-sm"
          rows={rows}
        />
      </div>
    </div>
  )
}

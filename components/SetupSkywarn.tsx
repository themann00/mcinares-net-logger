'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChevronRight, FileText, Info } from 'lucide-react'

const QUADRANTS = [
  { value: 'SW', label: 'SW — S of Washington, W of Meridian' },
  { value: 'NW', label: 'NW — N of Washington, W of Meridian' },
  { value: 'NE', label: 'NE — N of Washington, E of Meridian' },
  { value: 'SE', label: 'SE — S of Washington, E of Meridian' },
] as const

interface SetupSkywarnProps {
  onComplete: (config: { weatherStatus: 'approaching' | 'imminent' | null; bulletin: string; ncQuadrant: string }) => void
  initialWeatherStatus?: 'approaching' | 'imminent' | null
  initialBulletin?: string
  isResuming?: boolean
}

export function SetupSkywarn({ onComplete, initialWeatherStatus = null, initialBulletin = '', isResuming = false }: SetupSkywarnProps) {
  const [weatherStatus, setWeatherStatus] = useState<'approaching' | 'imminent' | null>(initialWeatherStatus)
  const [bulletin, setBulletin] = useState(initialBulletin)
  const [ncQuadrant, setNcQuadrant] = useState('')

  return (
    <div className="space-y-4">
      <div className="bg-surface-1 rounded-xl border border-surface-3 p-5 space-y-3">
        <h3 className="text-fg font-semibold mb-3">Weather Status</h3>
        <p className="text-fg-3 text-sm">Select the current severe weather status. If unsure, skip and update during the net.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setWeatherStatus(weatherStatus === 'approaching' ? null : 'approaching')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              weatherStatus === 'approaching'
                ? 'bg-orange-600 text-white'
                : 'bg-surface-2 text-fg-3 hover:text-fg-1 border border-surface-3'
            }`}
          >
            Approaching
          </button>
          <button
            onClick={() => setWeatherStatus(weatherStatus === 'imminent' ? null : 'imminent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              weatherStatus === 'imminent'
                ? 'bg-red-600 text-white'
                : 'bg-surface-2 text-fg-3 hover:text-fg-1 border border-surface-3'
            }`}
          >
            Imminent
          </button>
          {weatherStatus && (
            <button
              onClick={() => setWeatherStatus(null)}
              className="text-fg-4 hover:text-fg-2 text-xs underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!isResuming && (
        <div className="bg-surface-1 rounded-xl border border-surface-3 p-5 space-y-3">
          <h3 className="text-fg font-semibold">Your Quadrant</h3>
          <p className="text-fg-3 text-sm">Where is net control operating from? Keeps you out of the Unknown group on the station list.</p>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANTS.map(q => (
              <button
                key={q.value}
                onClick={() => setNcQuadrant(ncQuadrant === q.value ? '' : q.value)}
                className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  ncQuadrant === q.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-2 text-fg-3 hover:text-fg-1 border border-surface-3'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-1 rounded-xl border border-surface-3 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-fg font-semibold">NWS Bulletin</h3>
          <a
            href="https://www.weather.gov/ind/hazards"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 text-sm underline hover:text-blue-300"
          >
            weather.gov/ind/hazards
          </a>
        </div>
        <p className="text-fg-3 text-sm">Paste the current NWS bulletin text, or leave blank to read from external source during the net.</p>
        <Textarea
          value={bulletin}
          onChange={e => setBulletin(e.target.value)}
          placeholder="Paste NWS bulletin text here..."
          className="bg-surface-2 border-surface-3 text-fg text-sm"
          rows={6}
        />
        {bulletin.trim() && (
          <div className="flex items-center gap-2 text-green-400 text-xs">
            <FileText className="w-3 h-3" />
            Bulletin loaded ({bulletin.trim().split('\n').length} lines)
          </div>
        )}
      </div>

      <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <span className="text-amber-400/80 text-sm">Go to the 443.250 Repeater to link with 146.760 via DTMF Codes</span>
      </div>

      <Button
        onClick={() => onComplete({ weatherStatus, bulletin: bulletin.trim(), ncQuadrant })}
        className="w-full bg-blue-700 hover:bg-blue-600 text-lg py-6 gap-2"
      >
        {isResuming ? 'Resume Net' : 'Start Net'}
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  )
}

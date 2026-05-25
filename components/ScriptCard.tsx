'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Info, ChevronRight, RefreshCw } from 'lucide-react'
import type { ScriptSection, NetContext } from '@/types'

function resolveScript(section: ScriptSection, ctx: NetContext): string {
  if (typeof section.script === 'function') return section.script(ctx)
  return section.script
}

const NWS_URL = 'https://www.weather.gov/ind/hazards'

interface RenderOpts {
  onNext?: () => void
  hideNoCheckins?: boolean
  inlineInputs?: Record<string, { value: string; placeholder?: string; label?: string; onChange: (v: string) => void; onSave: () => void }>
  onCircleBack?: () => void
}

function renderScriptText(text: string, opts: RenderOpts = {}) {
  const parts: React.ReactNode[] = []
  const regex = /(\[[^\]]+\])|(NWS [Bb]ulletin)|(\{\{take-reports\}\})|(\{\{no-checkins\}\})|(\{\{input:(\w+)\}\})|(\{\{circle-back\}\})/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      parts.push(
        <em key={match.index} className="text-gray-400">
          {match[1]}
        </em>
      )
    } else if (match[2]) {
      parts.push(
        <a
          key={match.index}
          href={NWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
        >
          {match[2]}
        </a>
      )
    } else if (match[3] && opts.onNext) {
      parts.push(
        <Button
          key={match.index}
          onClick={opts.onNext}
          size="sm"
          className="bg-orange-700 hover:bg-orange-600 text-white gap-1 my-1"
        >
          Take reports
          <ChevronRight className="w-4 h-4" />
        </Button>
      )
    } else if (match[4] && opts.onNext && !opts.hideNoCheckins) {
      parts.push(
        <Button
          key={match.index}
          onClick={opts.onNext}
          size="sm"
          variant="outline"
          className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 gap-1 my-1"
        >
          No check-ins
          <ChevronRight className="w-4 h-4" />
        </Button>
      )
    } else if (match[5] && match[6] && opts.inlineInputs?.[match[6]]) {
      const field = opts.inlineInputs[match[6]]
      parts.push(
        <span key={match.index} className="flex items-center gap-2 my-2">
          {field.label && <span className="text-gray-400 text-sm">{field.label}:</span>}
          <Input
            value={field.value}
            onChange={e => field.onChange(e.target.value.toUpperCase())}
            placeholder={field.placeholder}
            className="bg-gray-800 border-gray-600 text-white uppercase font-mono w-40 h-8 text-sm inline-flex"
            onKeyDown={e => { if (e.key === 'Enter') field.onSave() }}
          />
          <Button
            size="sm"
            onClick={field.onSave}
            className="bg-blue-700 hover:bg-blue-600 h-8 text-xs"
          >
            Save
          </Button>
        </span>
      )
    } else if (match[7] && opts.onCircleBack) {
      parts.push(
        <Button
          key={match.index}
          onClick={opts.onCircleBack}
          size="sm"
          className="bg-amber-700 hover:bg-amber-600 text-white gap-1 my-1"
        >
          <RefreshCw className="w-4 h-4" />
          Circle back
        </Button>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  read: { label: 'READ ALOUD', color: 'bg-blue-700' },
  checkin: { label: 'CHECK-INS', color: 'bg-green-700' },
  input: { label: 'INPUT NEEDED', color: 'bg-yellow-700' },
  report: { label: 'REPORTS', color: 'bg-orange-700' },
  closenet: { label: 'CLOSING', color: 'bg-red-700' },
}

interface ScriptCardProps {
  section: ScriptSection
  ctx: NetContext
  sectionIndex: number
  totalSections: number
  onNext?: () => void
  stationCount?: number
  inlineInputs?: Record<string, { value: string; placeholder?: string; label?: string; onChange: (v: string) => void; onSave: () => void }>
  onCircleBack?: () => void
}

export function ScriptCard({ section, ctx, sectionIndex, totalSections, onNext, stationCount = 0, inlineInputs, onCircleBack }: ScriptCardProps) {
  const scriptText = resolveScript(section, ctx)
  const typeInfo = TYPE_LABELS[section.type] || TYPE_LABELS.read

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">
            {sectionIndex + 1} / {totalSections}
          </span>
          <h2 className="text-white font-semibold text-lg">{section.title}</h2>
        </div>
        <Badge className={`${typeInfo.color} text-white text-xs`}>{typeInfo.label}</Badge>
      </div>

      <div className="p-5">
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-base leading-7 text-gray-100 whitespace-pre-wrap border border-gray-800">
          {renderScriptText(scriptText, { onNext, hideNoCheckins: stationCount > 1, inlineInputs, onCircleBack })}
        </div>

        {section.notes && (
          <div className="mt-4 flex gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{section.notes}</span>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import type { ScriptSection, NetContext } from '@/types'

function resolveScript(section: ScriptSection, ctx: NetContext): string {
  if (typeof section.script === 'function') return section.script(ctx)
  return section.script
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
}

export function ScriptCard({ section, ctx, sectionIndex, totalSections }: ScriptCardProps) {
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
          {scriptText}
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

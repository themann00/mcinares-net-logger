'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollText } from 'lucide-react'
import type { ScriptSection, NetContext } from '@/types'

function resolveScript(section: ScriptSection, ctx: NetContext): string {
  if (typeof section.script === 'function') return section.script(ctx)
  return section.script
}

interface FullScriptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: ScriptSection[]
  ctx: NetContext
}

export function FullScriptModal({ open, onOpenChange, sections, ctx }: FullScriptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-surface-3 max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden" style={{ resize: 'horizontal', minWidth: '320px' }}>
        <DialogHeader>
          <DialogTitle className="text-fg flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Full Script
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {sections.map((section, i) => (
            <div key={section.id}>
              <div className="text-xs font-semibold text-fg-3 uppercase tracking-widest mb-2">
                {i + 1}. {section.title}
              </div>
              <div className="bg-surface-0 rounded-lg p-4 font-mono text-sm leading-7 text-fg-1 whitespace-pre-wrap border border-surface-2">
                {resolveScript(section, ctx)}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

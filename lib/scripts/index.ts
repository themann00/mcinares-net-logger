import type { NetType, ScriptSection } from '@/types'
import { aresSections } from './ares'
import { skywarnSections } from './skywarn'
import { sirenSections } from './siren'

export { aresSections } from './ares'
export { skywarnSections, skywarnContinuityScript } from './skywarn'
export { sirenSections } from './siren'

export function getSections(type: NetType): ScriptSection[] {
  switch (type) {
    case 'ares':
      return aresSections
    case 'skywarn':
      return skywarnSections
    case 'siren':
      return sirenSections
  }
}

export function resolveScript(section: ScriptSection, ctx: import('@/types').NetContext): string {
  if (typeof section.script === 'function') return section.script(ctx)
  return section.script
}

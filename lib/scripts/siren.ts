import type { ScriptSection, NetContext } from '@/types'

export const sirenSections: ScriptSection[] = [
  {
    id: 'preamble',
    title: 'Preamble & Early Check-ins (~10:55 AM)',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `CQ net CQ net CQ net. This is ${ctx.net_controller}, net control activating the Marion County Siren Check Net. We hold this net on the first Friday of the month to coincide with the county siren test at 11 AM. "Eyes on" the siren reports are preferred but all check-ins and reports are welcome.

When you make your report please provide the siren number if possible using the map at the bottom of www.mcinares.org/skywarn. If you do not have the number, the closest cross street to the siren will be fine.

At this time we will take early check-ins — callsign only at this time, please call ${ctx.net_controller}.`,
    notes:
      'Take early check-ins (callsign only) before 11 AM. If too many come in before 11 AM, pause and announce you will take more after the sirens go off.',
  },
  {
    id: 'post_siren',
    title: 'Post-Siren (11:00 AM)',
    type: 'read',
    script: (ctx: NetContext) =>
      `This is ${ctx.net_controller} net control for the Siren Check Net.

I will take additional check-ins in a moment. First I will now go through the current list: when called upon please report the siren number using the map at the bottom of www.mcinares.org/skywarn if possible, or the siren location to the best of your knowledge, if it sounded with rotation, as well as any visual reports such as damage or repair needed.`,
    notes:
      'Read after the sirens go off at 11 AM. Then move to the List Review section.',
  },
  {
    id: 'list_review',
    title: 'List Review',
    type: 'report',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: (ctx: NetContext) =>
      `This is ${ctx.net_controller} net control for the Siren Net.

(Go through each station on the check-in list. When called upon, each station should report:)
  • Siren number or nearest cross street
  • Whether it sounded with rotation
  • Any visual observations — damage or repair needed`,
    notes:
      'Call each station on the list. Log their siren report. Use circle-back to fill in missing location or station type.',
  },
  {
    id: 'additional_checkins',
    title: 'Additional Check-ins & Reports',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: (ctx: NetContext) =>
      `Are there any additional stations wishing to check in, with or without a siren report?`,
    notes:
      'New stations add to unique station count and base/mobile totals.',
  },
  {
    id: 'closing',
    title: 'Closing',
    type: 'closenet',
    script: (ctx: NetContext) =>
      `This is ${ctx.net_controller} net control for the Marion County Siren Test Net. At this time we are closing the net and would like to thank all amateurs who have participated today.

We would like to also thank the Indianapolis Repeater Association for the use of the repeater. This net is now closed at ______ local time. This is ${ctx.net_controller} clear.`,
  },
]

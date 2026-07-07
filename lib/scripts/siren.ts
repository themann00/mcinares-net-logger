import type { ScriptSection, NetContext } from '@/types'

export const sirenSections: ScriptSection[] = [
  {
    id: 'preamble',
    title: 'Preamble (~10:55)',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `CQ net CQ net CQ net. This is ${ctx.net_controller}, net control activating the Marion County Siren Check Net. We hold this net on the first Friday of the month to coincide with the county siren test at 11 AM. "Eyes on" the siren reports are preferred but all check-ins and reports are welcome.

When you make your report please provide the siren number if possible using the map at the bottom of www.mcinares.org/skywarn. If you do not have the number, the closest cross street to the siren will be fine.

At this time we will take early check-ins — callsign only at this time, please call ${ctx.net_controller}.`,
  },
  {
    id: 'post_siren',
    title: 'Post-Siren (11:00)',
    type: 'report',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will take additional check-ins in a moment. First I will go through the current list: when called upon please report the siren number using the map at the bottom of www.mcinares.org/skywarn if possible, or the siren location to the best of your knowledge. Each station should report:
  • Siren number or nearest cross street
  • Whether it sounded with rotation
  • Any visual observations — damage or repair needed

Log reports using the Report tab.

{{circle-back}}`,
  },
  {
    id: 'additional_checkins',
    title: 'Additional',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `Are there any additional stations wishing to check in, with or without a siren report?

{{no-checkins}}`,
  },
  {
    id: 'closing',
    title: 'Closing',
    type: 'closenet',
    script: (ctx: NetContext) => {
      const statsLine =
        ctx.station_count !== undefined
          ? `During this net we had ${ctx.station_count} station${ctx.station_count === 1 ? '' : 's'} check in and took ${ctx.report_count ?? 0} siren report${ctx.report_count === 1 ? '' : 's'}.`
          : ''

      return `This is ${ctx.net_controller} net control for the Marion County Siren Test Net. At this time we are closing the net and would like to thank all amateurs who have participated today.

${statsLine}

We would like to also thank the Indianapolis Repeater Association for the use of the repeater. This net is now closed at ${ctx.now_local || '______'} local time. This is ${ctx.net_controller} clear.`
    },
  },
]

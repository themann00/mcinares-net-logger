import type { ScriptSection, NetContext } from '@/types'

export const skywarnSections: ScriptSection[] = [
  {
    id: 'preamble',
    title: 'Preamble',
    type: 'read',
    script: (ctx: NetContext) => {
      const weatherLine = ctx.weather_status
        ? ctx.weather_status === 'imminent'
          ? 'imminent in the area.'
          : 'approaching the area.'
        : '[approaching the area / imminent in the area].'

      const bulletinLine = ctx.nws_bulletin
        ? `[Here is the current information from the National Weather Service:\n${ctx.nws_bulletin}]`
        : '[Read NWS bulletin / watch / warning if available]'

      return `CQ net CQ net CQ net. This is ${ctx.net_controller}, net control activating the Marion County Skywarn Severe Weather net.

At this time severe weather is ${weatherLine}

Amateurs are asked to watch for signs of deteriorating conditions and provide appropriate reports to net control. This is a directed net and all stations are asked to transmit only when recognized by net control.

Please remember that the 146.760 repeater requires a 151.4 PL tone and the 443.250 repeater requires a 100 PL tone. Always key up for a second before speaking to ensure your transmission is not clipped.

${bulletinLine}

The National Weather Service is looking for reports of weather events which you have personally observed that meet the following criteria:

  • Tornadoes, funnel clouds, or rotating wall clouds
  • Hail including the size of the hail
  • Winds in excess of 50 miles per hour
  • Flooding of creeks, streams, rivers, roads, or streets
  • Damage to trees, power lines, or structures caused by wind

When you make your report, please give your exact location, if measurements are estimated or actual, and the time the event occurred especially if your report is delayed.

At this time are there any reports that meet these criteria?

{{take-reports}}`
    },
    allowReports: true,
  },
  {
    id: 'initial_reports',
    title: 'Initial Reports',
    type: 'report',
    allowReports: true,
    allowCheckins: true,
    notes: 'report-hint',
    script: (ctx: NetContext) =>
      `I will now take any urgent or immediate reports of severe storm damage or storm reports before moving on to liaison and general check-ins. Only critical reports where life or property are in imminent danger. Please call ${ctx.net_controller}.

{{no-checkins}}`,
  },
  {
    id: 'liaison',
    title: 'Liaison',
    type: 'input',
    script: (ctx: NetContext) =>
      `Do we have a station available to take over as liaison at this time?

{{input:liaison}}

Thank you ${ctx.liaison || '________'} for volunteering. Please be sure you are able to listen to this net, in addition to the Central Indiana Skywarn net on 146.97 or 442.65 repeater — both of those have a 77.0 PL tone. Please check in with them to let them know you are (taking over as) the liaison for Marion County, and that we have a net up and running.`,
    inputFields: [
      {
        id: 'liaison',
        label: 'Liaison Station Callsign',
        placeholder: 'e.g. W9ABC (leave blank if none)',
        type: 'text',
        inline: true,
      },
    ],
  },
  {
    id: 'checkin_sw',
    title: 'Check-ins: SW Quadrant',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will now take check-ins by quadrants of the county. Please come 5 at a time with your callsign, and if you are base or mobile in motion.

I will start with check-ins from the South West corner — South of Washington and West of Meridian — please come 5 at a time.`,
  },
  {
    id: 'checkin_nw',
    title: 'Check-ins: NW Quadrant',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will now take check-ins from the North West corner — North of Washington and West of Meridian — please come 5 at a time.`,
  },
  {
    id: 'checkin_ne',
    title: 'Check-ins: NE Quadrant',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will now take check-ins from the North East corner — North of Washington and East of Meridian — please come 5 at a time.`,
  },
  {
    id: 'checkin_se',
    title: 'Check-ins: SE Quadrant',
    type: 'checkin',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will now take check-ins from the South East corner — South of Washington and East of Meridian — please come 5 at a time.`,
  },
  {
    id: 'reports_and_circleback',
    title: 'Reports & Circle-Back',
    type: 'report',
    allowCheckins: true,
    allowReports: true,
    allowCircleBack: true,
    script: () =>
      `I will now go around to each station for their weather reports. When called upon, please provide your location and any observations that meet the criteria previously stated.

{{circle-back}}

Are there any additional stations wishing to check in, with or without a report?`,
  },
  {
    id: 'closing',
    title: 'Closing',
    type: 'closenet',
    script: (ctx: NetContext) =>
      `Attention all stations, Attention all stations, this is ${ctx.net_controller} net control for the Marion County Skywarn Severe Weather net. At this time we are closing the net and would like to thank all amateurs who have participated today.

[Read any NWS bulletin or watch still in effect, if applicable]

We would like to also thank the Central Indiana Repeater Club, and KM9E repeater for the use of the repeaters for this net. This net is now closed at ______ local time. This is ${ctx.net_controller} clear.`,
    notes: 'unlink-hint',
  },
]

export const skywarnContinuityScript = (ctx: NetContext) =>
  `Attention all stations, Attention all stations, this is ${ctx.net_controller} net control for the Marion County Skywarn net.

[Read NWS bulletin update if available]

The National Weather Service is looking for reports of weather events which you have personally observed that meet the following criteria:

  • Tornadoes, funnel clouds, or rotating wall clouds
  • Hail including the size of the hail
  • Winds in excess of 50 miles per hour
  • Flooding of creeks, streams, rivers, roads, or streets
  • Damage to trees, power lines, or structures caused by wind

When you make your report, please give your exact location, if measurements are estimated or actual, and the time the event occurred especially if your report is delayed.

At this time are there any reports that meet these criteria?`

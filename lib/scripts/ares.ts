import type { ScriptSection, NetContext } from '@/types'

export const aresSections: ScriptSection[] = [
  {
    id: 'preamble',
    title: 'Preamble',
    type: 'read',
    script: (ctx: NetContext) =>
      `CQ net, CQ net, CQ net. This is ${ctx.net_controller} (phonetically) activating the Marion County Amateur Radio Emergency Service Net. Net control for this session is ${ctx.net_controller} and the operator is ${ctx.net_controller}.

This net meets every Wednesday at 7:30 PM local time in order to pass formal or informal traffic, test our equipment, practice our operating skills, and learn how to properly check into a net. It also allows the local amateur community the opportunity to exchange news and information about ham radio. Membership in any group is not required for participation and check-ins from all licensed amateurs are welcome. When you check in to the net this evening, please indicate whether or not you have traffic or announcements. Remember, this is a directed net and all traffic should be routed through net control.`,
    inputFields: [
      {
        id: 'alt_nc',
        label: 'Alternate Net Control Callsign',
        placeholder: 'e.g. W9ABC',
        type: 'text',
      },
      {
        id: 'liaison',
        label: 'NTS Liaison / OES Station Callsign',
        placeholder: 'e.g. K9XYZ (leave blank if none)',
        type: 'text',
      },
    ],
  },
  {
    id: 'repeater_info',
    title: 'Repeater Information',
    type: 'read',
    script: () =>
      `Please note that this repeater requires an 88.5Hz PL tone.

If this repeater fails, we will use our resource net repeater: 147.120 MHz repeater, also with an 88.5 PL tone.`,
  },
  {
    id: 'short_time',
    title: 'Short-Time Check-ins',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now take any short-time check-ins that have traffic or announcements.`,
  },
  {
    id: 'mobile',
    title: 'Mobile Stations',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `Are there any mobile stations in motion wishing to check in, please call ${ctx.net_controller}.`,
  },
  {
    id: 'roll_call',
    title: 'Last Week\'s Roll Call',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `I will now call roll by using last week's call list. We had [LAST_WEEK_COUNT] check-ins (read from last week's list). This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
    inputFields: [
      {
        id: 'last_week_count',
        label: "Last Week's Check-in Count",
        placeholder: '0',
        type: 'text',
      },
    ],
  },
  {
    id: 'checkin_a_h',
    title: 'Open Check-ins: A–H',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `I will now take open check-ins grouped alphabetically by the suffix of your callsign.

At this time if your callsign suffix matches Alpha through Hotel, A thru H, please come now.

This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
  },
  {
    id: 'checkin_i_q',
    title: 'Open Check-ins: I–Q',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `I will now take check-ins that match the suffix of your call India through Quebec, I thru Q come now.

This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
  },
  {
    id: 'checkin_r_z',
    title: 'Open Check-ins: R–Z',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `I will now take check-ins that match the suffix of your call Romeo through Zulu, R through Z come now.

This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
  },
  {
    id: 'checkin_remaining',
    title: 'Open Check-ins: Remaining',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `I will now take open check-ins from any and all remaining stations.

This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
  },
  {
    id: 'announcements',
    title: 'Announcements',
    type: 'input',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `(First take announcements from the check-in list then proceed with announcements from the website. Indicate to stations with traffic they will be able to pass that traffic after announcements.)

This is ${ctx.net_controller} for the weekly Marion County ARES net.`,
  },
  {
    id: 'late_checkins',
    title: 'Late Check-ins',
    type: 'checkin',
    allowCheckins: true,
    script: () => `Are there any late check-ins?`,
  },
  {
    id: 'traffic',
    title: 'Traffic',
    type: 'input',
    allowCheckins: true,
    script: () =>
      `Are there any questions, comments, or traffic for the net? [Allow repeater to drop]

(Net control can now handle any traffic from the net.)`,
  },
  {
    id: 'closing',
    title: 'Closing',
    type: 'closenet',
    script: (ctx: NetContext) =>
      `I will now close the net by thanking the Indianapolis Repeater Association for the use of the repeater. I also would like to thank${ctx.alt_net_controller ? ` my alternate net control, ${ctx.alt_net_controller}${ctx.liaison ? ` and our OES station/NTS Liaison ${ctx.liaison},` : ','} as well as` : ''} all of you who participated tonight. We look forward to hearing from you again next week.

Please stand by while the repeater is set. [Wait for Control Op to set the repeater before clearing]

This is ${ctx.net_controller} saying "73" and the frequency is now being returned to normal amateur radio use.`,
  },
]

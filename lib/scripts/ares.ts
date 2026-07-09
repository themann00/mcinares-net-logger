import type { ScriptSection, NetContext } from '@/types'

const PHONETIC: Record<string, string> = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
  P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
  Z: 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three',
  '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight',
  '9': 'Nine',
}

function toPhonetic(callsign: string): string {
  return callsign
    .toUpperCase()
    .split('')
    .map(c => PHONETIC[c] || c)
    .join('-')
}

export const aresSections: ScriptSection[] = [
  {
    id: 'preamble',
    title: 'Preamble',
    type: 'read',
    script: (ctx: NetContext) => {
      const cs = ctx.net_controller
      const phonetic = cs ? `${cs}, ${toPhonetic(cs)},` : '[your callsign] (phonetically)'
      return `CQ net, CQ net, CQ net. This is ${phonetic} activating the Marion County Amateur Radio Emergency Service Net. Net control for this session is ${cs || '[your callsign]'} and the operator is ${cs || '[your callsign]'}.

This net meets every Wednesday at 7:30 PM local time in order to pass formal or informal traffic, test our equipment, practice our operating skills, and learn how to properly check into a net. It also allows the local amateur community the opportunity to exchange news and information about ham radio. Membership in any group is not required for participation and check-ins from all licensed amateurs are welcome. When you check in to the net this evening, please indicate whether or not you have traffic or announcements. Remember, this is a directed net and all traffic should be routed through net control.

Do we have an alternate net control for this session?

{{input:alt_nc}}

Thank you ${ctx.alt_net_controller || '________'} for volunteering.

Do we have an NTS Liaison or OES station?

{{input:nts_liaison}}

{{input:oes_station}}

Thank you for volunteering.`
    },
    inputFields: [
      {
        id: 'alt_nc',
        label: 'Alternate NC',
        placeholder: 'e.g. W9ABC',
        type: 'text',
        inline: true,
      },
      {
        id: 'nts_liaison',
        label: 'NTS Liaison',
        placeholder: 'e.g. K9XYZ',
        type: 'text',
        inline: true,
      },
      {
        id: 'oes_station',
        label: 'OES Station',
        placeholder: 'e.g. W9DEF',
        type: 'text',
        inline: true,
      },
    ],
  },
  {
    id: 'repeater_info',
    title: 'Repeater Info',
    type: 'read',
    script: () =>
      `Please note that this repeater requires an 88.5Hz PL tone.

If this repeater fails, we will use our resource net repeater: 147.120 MHz repeater, also with an 88.5 PL tone.`,
  },
  {
    id: 'short_time',
    title: 'Short-Time',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now take any short-time check-ins that have traffic or announcements. Please call net control.

{{no-checkins}}`,
    notes: 'checkin-hint',
  },
  {
    id: 'mobile',
    title: 'Mobile',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `Are there any mobile stations in motion wishing to check in, please call ${ctx.net_controller}.

{{no-checkins}}`,
  },
  {
    id: 'roll_call',
    title: 'Roll Call',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now call roll by using last week's call list.`,
    notes: 'checkin-hint',
  },
  {
    id: 'checkin_a_h',
    title: 'A–H',
    type: 'checkin',
    allowCheckins: true,
    script: (ctx: NetContext) =>
      `This is ${ctx.net_controller} for the weekly Marion County ARES net.

I will now take open check-ins grouped alphabetically by the suffix of your callsign.

At this time if your callsign suffix matches Alpha through Hotel, A thru H, please come now.`,
  },
  {
    id: 'checkin_i_q',
    title: 'I–Q',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now take check-ins that match the suffix of your call India through Quebec, I thru Q come now.`,
  },
  {
    id: 'checkin_r_z',
    title: 'R–Z',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now take check-ins that match the suffix of your call Romeo through Zulu, R through Z come now.`,
  },
  {
    id: 'checkin_remaining',
    title: 'Remaining',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `I will now take open check-ins from any and all remaining stations.`,
  },
  {
    id: 'announcements',
    title: 'Announcements',
    type: 'input',
    allowCheckins: true,
    script: (ctx: NetContext) => `This is ${ctx.net_controller} for the Marion County ARES Net.

{{announcements-section}}`,
  },
  {
    id: 'late_checkins',
    title: 'Late Check-ins',
    type: 'checkin',
    allowCheckins: true,
    script: () =>
      `Are there any late check-ins?

{{no-checkins}}`,
  },
  {
    id: 'traffic',
    title: 'Traffic',
    type: 'input',
    allowCheckins: true,
    allowReports: true,
    script: () => `{{traffic-section}}`,
  },
  {
    id: 'closing',
    title: 'Closing',
    type: 'closenet',
    script: (ctx: NetContext) => {
      const statsLine =
        ctx.station_count !== undefined
          ? `Tonight we had ${ctx.station_count} station${ctx.station_count === 1 ? '' : 's'} check in, with ${ctx.traffic_count ?? 0} piece${ctx.traffic_count === 1 ? '' : 's'} of traffic and ${ctx.announcement_count ?? 0} announcement${ctx.announcement_count === 1 ? '' : 's'}.`
          : ''

      // Thank only the roles actually filled during the preamble; skip the
      // clause entirely when none were.
      const thanks: string[] = []
      if (ctx.alt_net_controller) thanks.push(`my alternate net control, ${ctx.alt_net_controller}`)
      if (ctx.nts_liaison) thanks.push(`our NTS Liaison, ${ctx.nts_liaison}`)
      if (ctx.oes_station) thanks.push(`our OES station, ${ctx.oes_station}`)
      const thanksClause = thanks.length
        ? ` ${thanks.length > 1 ? `${thanks.slice(0, -1).join(', ')}, and ${thanks[thanks.length - 1]}` : thanks[0]}, as well as`
        : ''

      return `I will now close the net by thanking the Indianapolis Repeater Association for the use of the repeater. I also would like to thank${thanksClause} all of you who participated tonight. We look forward to hearing from you again next week.

${statsLine}

The net is closing at ${ctx.now_local || '______'} local time. This is ${ctx.net_controller} saying "73" and the frequency is now being returned to normal amateur radio use.`
    },
    notes: 'repeater-hint',
  },
]

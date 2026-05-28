export type NetType = 'ares' | 'skywarn' | 'siren'
export type StationType = 'base' | 'mobile'
export type Quadrant = 'SW' | 'NW' | 'NE' | 'SE'

export type LogEntryType =
  | 'net_open'
  | 'checkin'
  | 'report'
  | 'traffic'
  | 'announcement'
  | 'liaison'
  | 'alt_nc'
  | 'continuity'
  | 'circle_back'
  | 'late_checkin'
  | 'station_moved'
  | 'net_close'
  | 'note'

export interface Net {
  id: string
  type: NetType
  net_controller: string
  testing: boolean
  closed: boolean
  created_at: string
}

export interface CheckinMetadata {
  callsign: string
  first_name?: string | null
  last_name?: string | null
  station_type?: StationType | null
  location?: string | null
  quadrant?: Quadrant | null
  has_traffic?: boolean
  has_announcements?: boolean
}

export interface LogEntry {
  id: string
  net_id: string
  entry_type: LogEntryType
  content: string
  timestamp: string
  metadata: CheckinMetadata | Record<string, unknown> | null
}

export interface DerivedStation {
  callsign: string
  first_name: string | null
  last_name: string | null
  station_type: StationType | null
  location: string | null
  quadrant: Quadrant | null
  has_traffic: boolean
  has_announcements: boolean
  checked_in_at: string
  log_entry_id: string
}

/** Backward-compat alias: components that still import Station get DerivedStation */
export type Station = DerivedStation

export type SectionType = 'read' | 'checkin' | 'input' | 'report' | 'closenet'

export interface InputField {
  id: string
  label: string
  placeholder?: string
  type?: 'text' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
  inline?: boolean
}

export interface NetContext {
  net_controller: string
  alt_net_controller?: string | null
  liaison?: string | null
  weather_status?: 'approaching' | 'imminent' | null
  nws_bulletin?: string | null
  last_week_count?: number
}

export interface ScriptSection {
  id: string
  title: string
  type: SectionType
  script: string | ((ctx: NetContext) => string)
  allowCheckins?: boolean
  allowReports?: boolean
  allowCircleBack?: boolean
  inputFields?: InputField[]
  notes?: string
}

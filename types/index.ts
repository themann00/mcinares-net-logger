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

/** Persisted per-net UI/setup state; survives refresh and other devices */
export interface NetConfig {
  weather_status?: 'approaching' | 'imminent' | null
  nws_bulletin?: string | null
  prev_net_id?: string | null
  announcement_url?: string | null
  checklist_url?: string | null
}

export interface Net {
  id: string
  type: NetType
  net_controller: string
  testing: boolean
  closed: boolean
  config?: NetConfig | null
  created_at: string
}

export interface CheckinMetadata {
  /** Write-time snapshot; authoritative callsign is the roster row via station_id */
  callsign: string
  /** Original keystrokes at entry creation, never updated (audit trail) */
  callsign_as_typed?: string
  /** @deprecated names live on the roster; kept for legacy entries */
  first_name?: string | null
  /** @deprecated names live on the roster; kept for legacy entries */
  last_name?: string | null
  station_type?: StationType | null
  location?: string | null
  quadrant?: Quadrant | null
  /** Siren nets: up to four siren numbers covered by this station */
  siren_numbers?: string[]
  has_traffic?: boolean
  has_announcements?: boolean
}

/** Roster identity joined onto log entries by the log GET endpoint */
export interface LogStation {
  id: string
  callsign: string
  first_name: string | null
  last_name: string | null
}

export interface LogEntry {
  id: string
  net_id: string
  station_id: string | null
  station?: LogStation | null
  entry_type: LogEntryType
  content: string
  timestamp: string
  metadata: CheckinMetadata | Record<string, unknown> | null
}

export interface DerivedStation {
  station_id: string | null
  callsign: string
  first_name: string | null
  last_name: string | null
  station_type: StationType | null
  location: string | null
  quadrant: Quadrant | null
  siren_numbers: string[]
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
  /** Live totals for closing scripts */
  station_count?: number
  report_count?: number
  traffic_count?: number
  announcement_count?: number
  /** HH:mm local at render time, for "closed at ___" lines */
  now_local?: string
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

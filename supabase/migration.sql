-- Marion County ARES Net Logger — Supabase schema
-- Mirror of the deployed schema in the jacobmann-me project (regenerated 2026-06-05).
-- Logs are the single source of truth; stations are derived from log entries.
-- Station identity: log entries reference mcinares_roster by UUID (docs/station-identity-spec.md).

CREATE TABLE IF NOT EXISTS mcinares_nets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN ('ares', 'skywarn', 'siren')),
  net_controller  TEXT NOT NULL,
  testing         BOOLEAN NOT NULL DEFAULT FALSE,
  closed          BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcinares_roster (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign                      TEXT NOT NULL,
  first_name                    TEXT,
  last_name                     TEXT,
  email                         TEXT,
  license                       TEXT,
  address                       TEXT,
  county                        TEXT,
  last_external_participation   TIMESTAMPTZ,
  -- net that auto-created this row at check-in; NULL = imported or manually added
  created_in_net_id             UUID REFERENCES mcinares_nets(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- callsigns are unique case-insensitively; app normalizes to uppercase on entry
CREATE UNIQUE INDEX IF NOT EXISTS mcinares_roster_callsign_upper_key
  ON mcinares_roster (upper(callsign));

CREATE TABLE IF NOT EXISTS mcinares_log_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id      UUID NOT NULL REFERENCES mcinares_nets(id) ON DELETE CASCADE,
  -- identity reference for station-related entries; RESTRICT so roster rows
  -- with log history cannot be deleted (merge instead)
  station_id  UUID REFERENCES mcinares_roster(id) ON DELETE RESTRICT,
  entry_type  TEXT NOT NULL CHECK (entry_type IN (
    'net_open', 'checkin', 'report', 'traffic', 'announcement',
    'liaison', 'alt_nc', 'continuity', 'circle_back',
    'late_checkin', 'station_moved', 'net_close', 'note'
  )),
  content     TEXT NOT NULL,
  -- per-net facts (location, quadrant, station_type, has_traffic,
  -- has_announcements) plus callsign_as_typed audit snapshot
  metadata    JSONB,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcinares_log_entries_net_id ON mcinares_log_entries(net_id);
CREATE INDEX IF NOT EXISTS idx_mcinares_log_entries_timestamp ON mcinares_log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_mcinares_log_entries_station_id ON mcinares_log_entries(station_id);

-- Running log of siren checks across all siren check nets (added 2026-07-03).
-- One row per siren report that names a siren; deleting a net deletes its
-- siren check rows with it.
CREATE TABLE IF NOT EXISTS mcinares_siren_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id        UUID REFERENCES mcinares_nets(id) ON DELETE CASCADE,
  -- report entry that produced this row; log timestamp edits carry the row
  -- along (net deletion removes rows via the net_id cascade)
  log_entry_id  UUID REFERENCES mcinares_log_entries(id) ON DELETE SET NULL,
  callsign      TEXT,
  siren_number  TEXT NOT NULL,
  sound         BOOLEAN,
  rotation      BOOLEAN,
  visual        BOOLEAN,
  notes         TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcinares_siren_status_siren
  ON mcinares_siren_status(siren_number);
CREATE INDEX IF NOT EXISTS idx_mcinares_siren_status_timestamp
  ON mcinares_siren_status(timestamp);
CREATE INDEX IF NOT EXISTS idx_mcinares_siren_status_log_entry
  ON mcinares_siren_status(log_entry_id);

-- Uncommitted check-in queue, persisted so a page refresh (or second device)
-- doesn't lose queued stations (added 2026-07-03). Rows are deleted when
-- committed to the log; net deletion cascades.
CREATE TABLE IF NOT EXISTS mcinares_checkin_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id      UUID NOT NULL REFERENCES mcinares_nets(id) ON DELETE CASCADE,
  -- QueuedCheckin fields (callsign, names, type, location, sirens, flags,
  -- timestamps); stored as a blob since only the client interprets it
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcinares_checkin_queue_net_id
  ON mcinares_checkin_queue(net_id);

-- Siren registry (added 2026-07-03): editable copy of the county siren map,
-- plus UNK:### rows created when an operator confirms an off-map siren
-- number. Seeded from lib/sirenLocations.ts (187 rows).
CREATE TABLE IF NOT EXISTS mcinares_sirens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  location    TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mcinares_sirens_name_upper_key
  ON mcinares_sirens (upper(name));

-- RLS: enabled with zero policies (deny-all) by design. The app has no
-- Supabase Auth; all access goes through Next.js API routes using the
-- service role key, gated by the app's own PIN/JWT middleware.
ALTER TABLE mcinares_nets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcinares_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcinares_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcinares_siren_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcinares_checkin_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcinares_sirens ENABLE ROW LEVEL SECURITY;

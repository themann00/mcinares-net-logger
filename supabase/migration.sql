-- Marion County ARES Net Logger — Supabase Migration
-- Run this in the Supabase SQL Editor for your project

CREATE TABLE IF NOT EXISTS nets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('ares', 'skywarn', 'siren')),
  net_controller      TEXT NOT NULL,
  alt_net_controller  TEXT,
  liaison             TEXT,
  weather_status      TEXT CHECK (weather_status IN ('approaching', 'imminent')),
  nws_bulletin        TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id        UUID NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  callsign      TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  station_type  TEXT CHECK (station_type IN ('base', 'mobile')),
  location      TEXT,
  quadrant      TEXT CHECK (quadrant IN ('SW', 'NW', 'NE', 'SE')),
  has_traffic         BOOLEAN NOT NULL DEFAULT FALSE,
  has_announcements   BOOLEAN NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS log_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id        UUID NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  station_id    UUID REFERENCES stations(id) ON DELETE SET NULL,
  entry_type    TEXT NOT NULL CHECK (entry_type IN (
    'net_open', 'checkin', 'report', 'traffic', 'announcement',
    'liaison', 'alt_nc', 'continuity', 'circle_back',
    'late_checkin', 'net_close', 'note'
  )),
  content       TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stations_net_id ON stations(net_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_net_id ON log_entries(net_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);

-- Disable Row Level Security (app uses service role key on server)
ALTER TABLE nets DISABLE ROW LEVEL SECURITY;
ALTER TABLE stations DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_entries DISABLE ROW LEVEL SECURITY;

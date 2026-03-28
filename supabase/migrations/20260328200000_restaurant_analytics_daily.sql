-- Tages-Aggregate pro Restaurant (Kalendertag Europe/Berlin) für schnelle Analytics / Cron.
-- Schreibzugriff nur über Service Role (API-Routen); RLS ohne Policies = kein Zugriff für anon/authenticated.

CREATE TABLE IF NOT EXISTS restaurant_analytics_daily (
  restaurant_id uuid NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  day_berlin date NOT NULL,
  scan_count integer NOT NULL DEFAULT 0,
  item_detail_count integer NOT NULL DEFAULT 0,
  category_enter_count integer NOT NULL DEFAULT 0,
  scans_morning integer NOT NULL DEFAULT 0,
  scans_midday integer NOT NULL DEFAULT 0,
  scans_evening integer NOT NULL DEFAULT 0,
  scans_night integer NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  sessions_with_consent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, day_berlin)
);

CREATE INDEX IF NOT EXISTS restaurant_analytics_daily_day_berlin_idx
  ON restaurant_analytics_daily (day_berlin DESC);

ALTER TABLE restaurant_analytics_daily ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE restaurant_analytics_daily IS
  'Tages-Kennzahlen aus scan_events; Befüllung via Cron/Backfill (Service Role).';

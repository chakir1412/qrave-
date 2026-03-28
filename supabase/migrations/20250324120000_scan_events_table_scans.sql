CREATE TABLE IF NOT EXISTS scan_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  tisch_nummer integer,
  tier integer NOT NULL DEFAULT 0,
  event_type text NOT NULL,
  stunde integer,
  wochentag integer,
  monat integer,
  jahr integer,
  device_type text,
  ip_hash text,
  session_id text,
  item_id uuid,
  item_name text,
  kategorie text,
  main_tab text,
  filter_key text,
  duration_seconds integer,
  scroll_pct integer,
  partner_id uuid,
  partner_name text,
  produkt text,
  ad_position text,
  qr_scan_source text,
  bounce boolean,
  session_duration integer,
  return_visit boolean,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read scan_events"
ON scan_events FOR SELECT
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert scan_events"
ON scan_events FOR INSERT
WITH CHECK (true);

CREATE INDEX scan_events_restaurant_id_idx
ON scan_events(restaurant_id);

CREATE INDEX scan_events_created_at_idx
ON scan_events(created_at);

ALTER TABLE tables ADD COLUMN IF NOT EXISTS scans_total integer NOT NULL DEFAULT 0;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS scans_today integer NOT NULL DEFAULT 0;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_scan_at timestamptz;

CREATE POLICY "Public read active tables"
ON tables FOR SELECT
USING (aktiv = true);

CREATE OR REPLACE FUNCTION increment_table_scan(table_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE tables
  SET
    scans_total = scans_total + 1,
    scans_today = scans_today + 1,
    last_scan_at = now()
  WHERE id = table_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_table_scan(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_table_scan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_table_scan(uuid) TO service_role;

GRANT INSERT ON scan_events TO anon;
GRANT INSERT ON scan_events TO authenticated;

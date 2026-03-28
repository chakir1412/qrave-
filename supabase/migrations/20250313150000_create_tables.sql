CREATE TABLE IF NOT EXISTS tables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  zone text NOT NULL,
  tisch_nummer integer NOT NULL,
  qr_code_url text,
  nfc_aktiv boolean DEFAULT false,
  aktiv boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tables_restaurant_zone_number_key UNIQUE (restaurant_id, zone, tisch_nummer)
);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage tables"
ON tables FOR ALL
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
);

-- Founder-Dashboard: Tabellen + RLS (nur konfigurierte Founder-User-ID)
-- FOUNDER_USER_ID muss mit dieser UUID übereinstimmen (siehe App .env.local).

CREATE TABLE IF NOT EXISTS founder_pipeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  area text,
  phone text,
  contact text,
  stage text DEFAULT 'contact',
  heat text DEFAULT 'warm',
  note text,
  added_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS founder_todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  sub text,
  prio text DEFAULT 'm',
  done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS founder_restaurants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  next_visit text,
  last_visit text,
  note text,
  sticker_tier text,
  sticker_paid boolean DEFAULT false,
  sticker_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT founder_restaurants_restaurant_id_key UNIQUE (restaurant_id)
);

-- Keine dedizierte Werbepartner-Tabelle im Repo → Founder-spezifisch
CREATE TABLE IF NOT EXISTS founder_werbepartner (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  company text,
  contact text,
  phone text,
  mrr_monthly numeric(12, 2) DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE founder_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_werbepartner ENABLE ROW LEVEL SECURITY;

-- Nur diese Auth-UID (Founder) — bei anderer User-ID: neue Migration mit DROP POLICY … + CREATE POLICY …
CREATE POLICY "Founder only pipeline"
ON founder_pipeline FOR ALL
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

CREATE POLICY "Founder only todos"
ON founder_todos FOR ALL
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

CREATE POLICY "Founder only restaurants ext"
ON founder_restaurants FOR ALL
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

CREATE POLICY "Founder only werbepartner"
ON founder_werbepartner FOR ALL
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- Globale Leserechte für Founder (bestehende Owner-Policies bleiben; RLS ist OR-verknüpft)
CREATE POLICY "Founder read all scan_events"
ON scan_events FOR SELECT
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

CREATE POLICY "Founder read all tables"
ON tables FOR SELECT
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

CREATE POLICY "Founder read all restaurants"
ON restaurants FOR SELECT
TO authenticated
USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

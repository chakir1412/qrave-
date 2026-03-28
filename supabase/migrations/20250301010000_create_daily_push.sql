-- daily_push Tabelle für Daily-Push-Banner der Speisekarte

CREATE TABLE IF NOT EXISTS daily_push (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  active_date     date NOT NULL,
  item_emoji      text NOT NULL DEFAULT '⭐',
  item_name       text NOT NULL,
  item_desc       text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, active_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_push_restaurant_date
  ON daily_push (restaurant_id, active_date);

ALTER TABLE daily_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_push" ON daily_push FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated insert daily_push" ON daily_push FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update daily_push" ON daily_push FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete daily_push" ON daily_push FOR DELETE TO authenticated USING (true);

-- Testeintrag für heutiges Datum und Restaurant mit slug = 'qrave-demo'
INSERT INTO daily_push (restaurant_id, active_date, item_emoji, item_name, item_desc)
SELECT id, CURRENT_DATE, '🥩', 'Rinderfilet (200g)', 'Heute besonders empfohlen vom Chef'
FROM restaurants
WHERE slug = 'qrave-demo'
ON CONFLICT (restaurant_id, active_date) DO NOTHING;


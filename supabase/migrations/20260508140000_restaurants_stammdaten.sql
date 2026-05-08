-- Stammdaten-Felder für Targeting (Werbepartner, Filter im Founder-Dashboard).

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cuisine_type text,
  ADD COLUMN IF NOT EXISTS stadtbezirk text,
  ADD COLUMN IF NOT EXISTS sitzplaetze_ca integer,
  ADD COLUMN IF NOT EXISTS restaurant_typ text;

COMMENT ON COLUMN restaurants.cuisine_type IS
  'Küchen-Stil; mögliche Werte: deutsch, italienisch, asiatisch, mediterran, international, bar, cafe, sonstiges.';
COMMENT ON COLUMN restaurants.restaurant_typ IS
  'Betriebsart; mögliche Werte: restaurant, bar, cafe, bistro, imbiss.';

UPDATE restaurants SET
  cuisine_type = 'deutsch',
  stadtbezirk = 'Sachsenhausen',
  sitzplaetze_ca = 80,
  restaurant_typ = 'restaurant'
WHERE id = '9a333508-fa4a-4586-9ed2-e79e4a79ba95';

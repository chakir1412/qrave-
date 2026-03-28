-- Template-Spalte für Restaurants: welches Speisekarten-Design wird verwendet

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS template text DEFAULT 'bar-soleil';


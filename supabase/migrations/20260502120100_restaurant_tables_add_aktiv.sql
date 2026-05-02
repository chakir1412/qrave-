-- Operator-Dashboard nutzt das Feld als Heatmap-Sichtbarkeit / "im Betrieb".
-- Default true, damit alle bestehenden Tische live bleiben.

ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS aktiv boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.restaurant_tables.aktiv IS
  'Tisch ist im Betrieb / Heatmap-Sichtbarkeit. Ergaenzt via Operator-Dashboard-Migration.';

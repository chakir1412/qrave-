-- Tisch-Bereiche pro Restaurant — vereinfachte Verwaltung:
-- nur Name + Tisch-Anzahl pro Bereich. Daten sind für den Founder
-- sichtbar (Restaurant-Details im Founder-Dashboard), für den Wirt
-- nur als selbst-pflegbare Liste.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS tisch_bereiche jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN restaurants.tisch_bereiche IS
  'Liste von Bereichen für die Tisch-Übersicht: [{"name":"Innen","count":12}, ...]. Nur für Founder sichtbar.';

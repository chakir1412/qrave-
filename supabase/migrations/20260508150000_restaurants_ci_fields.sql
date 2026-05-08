-- CI-Felder für Restaurants: Website, Primärfarbe, Font.
-- Werden vom Onboarding-Template (lib/onboarding-template.ts) direkt
-- gesetzt; vorher landeten sie als Klartext im notiz-Feld.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS font_family text;

COMMENT ON COLUMN restaurants.website IS
  'Externe Restaurant-Website-URL (für Footer / Sponsoring-Targeting).';
COMMENT ON COLUMN restaurants.primary_color IS
  'CI-Primärfarbe (Hex z. B. #C8894E); ergänzt accent_color.';
COMMENT ON COLUMN restaurants.font_family IS
  'Bevorzugte CI-Schriftart (CSS font-family-Wert).';

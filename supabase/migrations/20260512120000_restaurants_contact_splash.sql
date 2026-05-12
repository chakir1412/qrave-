-- Kontakt- und Splash-Felder für die neue Gäste-Splash-Seite + Kontaktseite.
-- oeffnungszeiten (jsonb) existiert bereits und wird wiederverwendet.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS splash_image_url text;

COMMENT ON COLUMN restaurants.whatsapp IS
  'Internationale WhatsApp-Nummer (z. B. +491738996449) — wird auf wa.me-Link gemappt.';
COMMENT ON COLUMN restaurants.instagram IS
  'Instagram-Username ohne @ oder vollständige URL — wird auf instagram.com gemappt.';
COMMENT ON COLUMN restaurants.maps_url IS
  'Google-Maps-Link für die Kontaktseite (Embed + externes Öffnen).';
COMMENT ON COLUMN restaurants.splash_image_url IS
  'Optionales Hintergrundbild der Splash-Seite. Fallback: logo_url.';

COMMENT ON COLUMN restaurants.oeffnungszeiten IS
  'Wochenplan als JSONB: { mo: {open,close} | null, di: …, …, so: … }. null = an dem Tag geschlossen.';

-- Admin-Approval-Gate für Self-Service-Onboarding.
-- Unterschied zu den existierenden Spalten:
--   aktiv      → Owner kann seine Karte ein/ausschalten (UI-Toggle)
--   status     → Founder-CRM (in_einrichtung | live | offline)
--   published  → Admin-Freischaltung nach Onboarding (Spam-Schutz)
--
-- Gäste-Seite zeigt die Karte nur bei aktiv=true AND published=true.
-- Bestehende Restaurants (Frankfurter Wirtshaus) werden auf true gesetzt.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

UPDATE restaurants SET published = true WHERE aktiv = true;

COMMENT ON COLUMN restaurants.published IS
  'Admin-Freischaltung nach Self-Service-Onboarding. Erst nach manueller Bestätigung wird die Karte unter qrave.menu/<slug> sichtbar.';

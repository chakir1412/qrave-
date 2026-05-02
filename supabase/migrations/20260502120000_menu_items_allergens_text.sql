-- Freitext-Allergene & Zutaten auf menu_items.
-- Wird vom PDF-/URL-Import automatisch aus der Beschreibung extrahiert
-- und im EditItemOverlay manuell editierbar.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergens_text text NULL;

COMMENT ON COLUMN public.menu_items.allergens_text IS
  'Freitext-Allergene & Zutaten; vom PDF-Import autom. vorbefuellt.';

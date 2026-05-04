-- Mittagsangebot-Bundles: ein Eintrag in lunch_offers kann jetzt entweder
-- ein Single-Item (item_id gesetzt, is_bundle=false) ODER ein Bundle aus
-- mehreren menu_items mit Gesamt-Mittagspreis sein.

ALTER TABLE public.lunch_offers
  ADD COLUMN IF NOT EXISTS is_bundle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS bundle_name text NULL,
  ALTER COLUMN item_id DROP NOT NULL;

COMMENT ON COLUMN public.lunch_offers.is_bundle IS
  'Wenn true, ist der Eintrag ein Menü-Bundle: bundle_items[] enthält die menu_item-IDs, item_id darf null sein.';
COMMENT ON COLUMN public.lunch_offers.bundle_items IS
  'Bei Bundles: menu_items.id-Liste der enthaltenen Gerichte/Getränke.';
COMMENT ON COLUMN public.lunch_offers.bundle_name IS
  'Anzeigename für Bundles (z. B. "Mittagsmenü 1"). Bei Einzelitems null.';

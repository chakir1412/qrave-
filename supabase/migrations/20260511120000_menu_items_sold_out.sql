-- Ausverkauft-Toggle: kurzfristiges "heute nicht verfügbar"-Signal.
-- Unterschied zu aktiv:
--   aktiv=false       → Item ist komplett aus der Karte (z. B. Saisonende)
--   sold_out=true     → Item bleibt sichtbar, aber durchgestrichen+Badge im Gäste-Menü
-- Wird täglich um 4:00 Berlin via Cron zurückgesetzt.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN menu_items.sold_out IS
  'Kurzfristiges Ausverkauft-Flag. Auto-Reset täglich um 4:00 Berlin via Cron.';

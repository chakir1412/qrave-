-- Käuferorientierte Tracking-Felder für scan_events.
-- Werden vom Tier-1-Tracker bei event_type='item_detail' befüllt.

ALTER TABLE scan_events
  ADD COLUMN IF NOT EXISTS item_price numeric(8,2),
  ADD COLUMN IF NOT EXISTS item_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS beverage_subcategory text;

COMMENT ON COLUMN scan_events.item_price IS
  'Preis des angeklickten Items in EUR; nur bei event_type=item_detail.';
COMMENT ON COLUMN scan_events.item_tags IS
  'Diät-/Eigenschafts-Tags des Items; mögliche Werte: vegetarisch, vegan, glutenfrei, alkoholfrei.';
COMMENT ON COLUMN scan_events.beverage_subcategory IS
  'Getränke-Subkategorie wenn das Item ein Getränk ist; mögliche Werte: bier, wein, softdrinks, cocktails, wasser, kaffee, energy, sonstiges_getraenk.';

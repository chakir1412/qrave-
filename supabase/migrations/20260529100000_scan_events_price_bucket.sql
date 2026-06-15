-- Preis-Bucket pro Klick am Roh-Event.
-- Vom Tier-1-Tracker bei event_type IN (item_detail, wishlist_add) gesetzt.

ALTER TABLE scan_events
  ADD COLUMN IF NOT EXISTS price_bucket text;

COMMENT ON COLUMN scan_events.price_bucket IS
  'Preis-Bucket des angeklickten Items: budget (<5), mid (5-15), premium (>15). Befüllt bei event_type IN (item_detail, wishlist_add).';

CREATE INDEX IF NOT EXISTS scan_events_price_bucket_idx
  ON scan_events(price_bucket)
  WHERE price_bucket IS NOT NULL;

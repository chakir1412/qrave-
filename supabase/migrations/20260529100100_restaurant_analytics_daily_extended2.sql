-- Tages-Aggregat erweitern: Preis-Buckets, Getränke-nach-Tagesblock,
-- Wishlist-Wert, Saisonalität (Kategorien-nach-Monat).
-- Befüllt vom Cron-Aggregator (lib/analytics-daily-aggregate.ts).

ALTER TABLE restaurant_analytics_daily
  ADD COLUMN IF NOT EXISTS price_bucket_clicks jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS beverage_by_hour jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avg_wishlist_value numeric(8,2),
  ADD COLUMN IF NOT EXISTS top_categories_by_month jsonb DEFAULT '{}';

COMMENT ON COLUMN restaurant_analytics_daily.price_bucket_clicks IS
  'Klick-Verteilung nach Preis-Bucket aus item_detail: {"budget":12,"mid":8,"premium":3}.';
COMMENT ON COLUMN restaurant_analytics_daily.beverage_by_hour IS
  'Getränke-Subkategorie-Klicks gruppiert nach Tagesblock: {"morning":{"bier":2,...},"midday":{...},"evening":{...},"night":{...}}.';
COMMENT ON COLUMN restaurant_analytics_daily.avg_wishlist_value IS
  'Ø-Preis der item_price-Werte bei wishlist_add an diesem Tag; null wenn keine wishlist_add-Events mit Preis.';
COMMENT ON COLUMN restaurant_analytics_daily.top_categories_by_month IS
  'Kategorie-Klicks gruppiert nach Monat-Schlüssel (1-12): {"5":{"Hauptgerichte":42,...}}. Tages-Row enthält nur den Tages-Monat.';

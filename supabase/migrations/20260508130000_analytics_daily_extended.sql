-- Tages-Aggregat um Käufer-Metriken erweitern (Cron + Backfill befüllen).

ALTER TABLE restaurant_analytics_daily
  ADD COLUMN IF NOT EXISTS category_clicks jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS beverage_subcategory_clicks jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS top_items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vegan_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vegetarian_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_item_price_clicked numeric(8,2);

COMMENT ON COLUMN restaurant_analytics_daily.category_clicks IS
  'Klick-Zählung pro Kategorie als JSON-Objekt: {"Vorspeisen": 42, ...}.';
COMMENT ON COLUMN restaurant_analytics_daily.beverage_subcategory_clicks IS
  'Klick-Zählung pro Getränke-Subkategorie als JSON-Objekt.';
COMMENT ON COLUMN restaurant_analytics_daily.top_items IS
  'Top-10-Items nach Klicks: [{"name","clicks","price"}].';
COMMENT ON COLUMN restaurant_analytics_daily.avg_item_price_clicked IS
  'Durchschnittspreis aller geklickten Items mit gesetztem Preis (gerundet auf 2 Dezimalstellen).';

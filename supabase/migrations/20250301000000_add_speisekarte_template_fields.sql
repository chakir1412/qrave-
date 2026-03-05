-- Erweiterung menu_items für Vorlage speisekarte (2).html
-- Optional: Alle neuen Spalten sind nullable/default, bestehende Daten bleiben gültig.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS allergen_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sponsored boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS preis_volumen jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_highlight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS main_tab text,
  ADD COLUMN IF NOT EXISTS section_subtitle text;

COMMENT ON COLUMN menu_items.emoji IS 'Einzelnes Emoji pro Gericht (z.B. 🍺)';
COMMENT ON COLUMN menu_items.allergen_ids IS 'Allergene: gluten, milk, egg, nuts, shellfish, fish, soy';
COMMENT ON COLUMN menu_items.preis_volumen IS 'Mehrpreise z.B. {"g":"3,80 €","m":"4,80 €","l":"5,80 €","btl":"19,00 €"}';
COMMENT ON COLUMN menu_items.main_tab IS 'Haupt-Tab: speisen, cocktails, bier_wein, alkoholfrei, snacks';
COMMENT ON COLUMN menu_items.section_subtitle IS 'Untertitel der Kategorie-Sektion';

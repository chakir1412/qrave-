-- Gesponserte Empfehlungen (Getränke / Partner) für „Dazu passend“
CREATE TABLE IF NOT EXISTS sponsored_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name text NOT NULL,
  item_name text NOT NULL,
  beschreibung text,
  bild_url text,
  preis decimal(10, 2),
  kategorie text DEFAULT 'Getränke',
  trigger_kategorien text[] DEFAULT '{}',
  restaurant_ids uuid[] DEFAULT '{}',
  aktiv boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sponsored_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read sponsored_items" ON sponsored_items;
CREATE POLICY "Public read sponsored_items" ON sponsored_items
FOR SELECT
USING (aktiv = true);

DROP POLICY IF EXISTS "Founder full access sponsored_items" ON sponsored_items;
CREATE POLICY "Founder full access sponsored_items" ON sponsored_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT ON sponsored_items TO anon, authenticated;
GRANT ALL ON sponsored_items TO authenticated;

INSERT INTO sponsored_items (
  partner_name,
  item_name,
  beschreibung,
  preis,
  kategorie,
  trigger_kategorien,
  bild_url,
  aktiv
)
SELECT
  'Heineken',
  'Heineken 0,33l',
  'Frisch gezapft oder aus der Flasche',
  3.90,
  'Getränke',
  ARRAY[
    'Pizza',
    'Pasta',
    'Burger',
    'Food',
    'Hauptgerichte',
    'Fleisch',
    'Vorspeisen',
    'Suppen'
  ],
  'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM sponsored_items s
  WHERE s.partner_name = 'Heineken'
    AND s.item_name = 'Heineken 0,33l'
);

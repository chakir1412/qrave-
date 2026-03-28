-- Optionale Kategorie-Metadaten pro Restaurant (Speisekarten-Editor)
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT categories_restaurant_name_key UNIQUE (restaurant_id, name)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage categories"
ON categories FOR ALL
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE auth_user_id = auth.uid()
  )
);

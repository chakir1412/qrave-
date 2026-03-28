CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tisch_nummer integer NOT NULL,
  bereich text,
  qr_url text GENERATED ALWAYS AS (
    'https://qrave.menu/' || restaurant_id::text || '/tisch-' || tisch_nummer::text
  ) STORED,
  nfc_programmiert boolean DEFAULT false,
  sticker_angebracht boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, tisch_nummer)
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder only tables" ON public.restaurant_tables
  FOR ALL
  USING (true)
  WITH CHECK (true);

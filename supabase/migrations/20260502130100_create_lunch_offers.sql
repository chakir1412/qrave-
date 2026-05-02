-- Mittagsangebot pro Restaurant: Auswahl von Items aus menu_items mit
-- ggf. abweichendem Mittagspreis, Zeitfenster (time_from/time_to) und
-- Wochentagen.

CREATE TABLE IF NOT EXISTS public.lunch_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  lunch_price numeric NULL,
  time_from time NOT NULL DEFAULT '11:30'::time,
  time_to time NOT NULL DEFAULT '14:30'::time,
  weekdays text[] NOT NULL DEFAULT ARRAY['mo','di','mi','do','fr']::text[],
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lunch_offers_restaurant_id_idx
  ON public.lunch_offers (restaurant_id);

CREATE INDEX IF NOT EXISTS lunch_offers_item_id_idx
  ON public.lunch_offers (item_id);

ALTER TABLE public.lunch_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lunch_offers_public_read" ON public.lunch_offers;
CREATE POLICY "lunch_offers_public_read"
  ON public.lunch_offers
  FOR SELECT
  TO public
  USING (aktiv = true);

DROP POLICY IF EXISTS "lunch_offers_owner_all" ON public.lunch_offers;
CREATE POLICY "lunch_offers_owner_all"
  ON public.lunch_offers
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.lunch_offers IS
  'Mittagsangebote pro Restaurant. Items aus menu_items mit ggf. abweichendem Mittagspreis und Zeitfenster/Wochentage.';

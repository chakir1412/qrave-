-- Founder: Zusatzfelder für „Neues Restaurant“-Modal
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS ansprechpartner text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_einrichtung';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS naechster_besuch date;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS notiz text;

-- Hinweis: Bereiche für Tische sind bereits als Spalte `bereich` in `restaurant_tables` vorhanden.
-- Keine zusätzliche Spalte `area` (vermeidet Redundanz).

-- QR-Links: Slug-basiert (qrave.menu/[slug]/tisch-[nummer]) statt UUID im Pfad
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_url;
ALTER TABLE public.restaurant_tables ADD COLUMN qr_url text;

UPDATE public.restaurant_tables rt
SET qr_url = 'https://qrave.menu/' || r.slug || '/tisch-' || rt.tisch_nummer::text
FROM public.restaurants r
WHERE r.id = rt.restaurant_id;

CREATE OR REPLACE FUNCTION public.restaurant_tables_fill_qr_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  s text;
BEGIN
  SELECT r.slug INTO s FROM public.restaurants r WHERE r.id = NEW.restaurant_id;
  IF s IS NOT NULL AND NEW.tisch_nummer IS NOT NULL THEN
    NEW.qr_url := 'https://qrave.menu/' || s || '/tisch-' || NEW.tisch_nummer::text;
  ELSE
    NEW.qr_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_restaurant_tables_qr_url ON public.restaurant_tables;
CREATE TRIGGER tr_restaurant_tables_qr_url
  BEFORE INSERT OR UPDATE OF restaurant_id, tisch_nummer ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE PROCEDURE public.restaurant_tables_fill_qr_url();

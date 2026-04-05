-- Landing-Page Kontaktanfragen (POST /api/contact)
CREATE TABLE IF NOT EXISTS public.kontakt_anfragen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  restaurant_name text NOT NULL,
  telefon text,
  nachricht text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kontakt_anfragen ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.kontakt_anfragen IS 'Öffentliche Kontaktanfragen von der Marketing-Landingpage; Insert nur serverseitig via Service Role.';

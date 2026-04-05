-- Founder Tisch-Manager: neue Status-Spalten (UI „installiert“)
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS nfc_installiert boolean DEFAULT false;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS sticker_installiert boolean DEFAULT false;

-- Werte aus den bisherigen Spalten übernehmen (idempotent)
UPDATE public.restaurant_tables
SET
  nfc_installiert = COALESCE(nfc_programmiert, false),
  sticker_installiert = COALESCE(sticker_angebracht, false);

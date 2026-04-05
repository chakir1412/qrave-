-- Öffentliches Restaurant-Logo (z. B. Bucket restaurant-assets)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url text;

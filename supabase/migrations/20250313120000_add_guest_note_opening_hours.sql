-- Gäste-Notiz und Öffnungszeiten fürs Dashboard / Speisekarte
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS guest_note text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours jsonb;

-- Mehrsprachigkeit für die Gäste-Speisekarte.
-- Pro Sprache zwei Spalten in menu_items (name + beschreibung).
-- Übersetzungen werden via DeepL einmalig beim Dashboard-Trigger gefüllt
-- und beim Bearbeiten des Originals (name/beschreibung) auf NULL gesetzt,
-- damit sie beim nächsten Translate-Aufruf neu generiert werden.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_tr text,
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_it text,
  ADD COLUMN IF NOT EXISTS name_fr text,
  ADD COLUMN IF NOT EXISTS beschreibung_en text,
  ADD COLUMN IF NOT EXISTS beschreibung_tr text,
  ADD COLUMN IF NOT EXISTS beschreibung_ar text,
  ADD COLUMN IF NOT EXISTS beschreibung_ru text,
  ADD COLUMN IF NOT EXISTS beschreibung_it text,
  ADD COLUMN IF NOT EXISTS beschreibung_fr text;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS active_languages text[] NOT NULL DEFAULT '{de}';

COMMENT ON COLUMN restaurants.active_languages IS
  'Aktive Sprachen für die Gäste-Speisekarte. de ist immer dabei. Erlaubte Werte: de, en, tr, ar, ru, it, fr.';

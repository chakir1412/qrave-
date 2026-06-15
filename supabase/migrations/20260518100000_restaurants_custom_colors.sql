-- Wirt-definierte Hintergrund- und Schriftfarbe für die Speisekarte.
-- Überschreiben — wenn gesetzt — den Template-Default aus background_mode.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_bg_color text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS custom_text_color text;

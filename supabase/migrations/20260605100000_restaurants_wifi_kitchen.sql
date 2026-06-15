-- Optionale Restaurant-Felder:
--  - wifi_name / wifi_password: auf der Splash-Seite anzeigbar (Bottom-Sheet)
--  - kitchen_closes_at: zusätzlich zur "bis HH:MM"-Anzeige

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS wifi_name text,
  ADD COLUMN IF NOT EXISTS wifi_password text,
  ADD COLUMN IF NOT EXISTS kitchen_closes_at time;

COMMENT ON COLUMN restaurants.wifi_name IS
  'WLAN-SSID — auf der Splash-Seite (/[slug]) anzeigbar wenn gesetzt. Optional.';
COMMENT ON COLUMN restaurants.wifi_password IS
  'WLAN-Passwort (Klartext, von Gästen ohnehin geteilt). Optional.';
COMMENT ON COLUMN restaurants.kitchen_closes_at IS
  'Optionale Küchen-Schließzeit (HH:MM:SS). Wenn gesetzt: "Geöffnet · bis 22:00 (Küche bis 21:30)".';

-- Onboarding-Flow für Neuregistrierte:
--   onboarding_file_url  Speisekarten-Foto/PDF im restaurant-assets Bucket
--   onboarding_link      Website/PDF-Link falls kein File hochgeladen wurde
--   onboarding_completed Guard-Flag: false → Neuregistrierte werden zu /onboarding geführt

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_file_url text,
  ADD COLUMN IF NOT EXISTS onboarding_link text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Bestehende Restaurants grandfathern (kein Nachträglicher Onboarding-Zwang)
UPDATE restaurants SET onboarding_completed = true;

-- Alter cuisine_type-Wert "Deutsch" auf neue Dropdown-Option "Deutsch / Regional" mappen.
-- Weitere alte Werte, die nicht in der neuen 19er-Liste stehen, auf NULL setzen.
UPDATE restaurants SET cuisine_type = 'Deutsch / Regional' WHERE cuisine_type = 'Deutsch';
UPDATE restaurants
SET cuisine_type = NULL
WHERE cuisine_type IS NOT NULL
  AND cuisine_type NOT IN (
    'Deutsch / Regional',
    'Italienisch',
    'Pizza / Pasta',
    'Türkisch / Döner',
    'Griechisch / Mediterran',
    'Arabisch / Libanesisch',
    'Indisch / Pakistanisch',
    'Japanisch / Sushi',
    'Chinesisch',
    'Vietnamesisch',
    'Thailändisch',
    'Koreanisch',
    'Mexikanisch',
    'Amerikanisch / Burger',
    'Street Food / Imbiss',
    'Café / Brunch',
    'Shisha-Bar / Lounge',
    'Vegetarisch / Vegan',
    'Sonstiges'
  );

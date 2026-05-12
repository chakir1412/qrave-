-- Splash-Hintergrund: Foto oder Video. Ersetzt nicht splash_image_url
-- (Legacy aus dem Onboarding-Wizard), sondern ergänzt es. SplashScreen
-- bevorzugt splash_media_url, fällt sonst auf splash_image_url zurück.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS splash_media_url text,
  ADD COLUMN IF NOT EXISTS splash_media_type text;

COMMENT ON COLUMN restaurants.splash_media_url IS
  'Öffentliche URL für den Splash-Hintergrund (Foto JPG/PNG oder Video MP4) im Bucket restaurant-assets, Pfad splash/<id>/<filename>.';
COMMENT ON COLUMN restaurants.splash_media_type IS
  'Typ des splash_media_url: image | video.';

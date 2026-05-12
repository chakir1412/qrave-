-- Owner-UPDATE für eigenes Restaurant.
-- Hintergrund: P1-1-Fix vom 7. Mai hatte alle Owner-Policies auf restaurants
-- gelöscht (Owner update restaurants war als public/USING(true) gefährlich).
-- Folge: Dashboard-Operator konnte seine eigenen Restaurant-Felder
-- (Adresse, Telefon, Kontakt, Öffnungszeiten, …) nicht mehr updaten —
-- die UPDATEs liefen silent als 0-Row-no-op durch RLS.
--
-- Diese Policy erlaubt UPDATE nur, wenn auth.uid() der auth_user_id der
-- konkreten Restaurant-Zeile entspricht. Die bestehende
-- "Founder full access restaurants" bleibt unberührt — Policies sind
-- OR-verknüpft (PERMISSIVE).

DROP POLICY IF EXISTS "Owner update own restaurant" ON public.restaurants;

CREATE POLICY "Owner update own restaurant" ON public.restaurants
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

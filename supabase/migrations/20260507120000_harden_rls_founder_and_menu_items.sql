-- Fix 1 — RLS für Founder-Tabellen härten.
-- Alle USING(true)-Policies werden ersetzt durch
-- USING(auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid).
-- Public/anon SELECT-Policies (für das Gäste-Menu) bleiben unangetastet.

-- ===== restaurants =====
DROP POLICY IF EXISTS "Owner update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Founder full access restaurants" ON public.restaurants;
CREATE POLICY "Founder full access restaurants" ON public.restaurants
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== pipeline =====
DROP POLICY IF EXISTS "Founder full access pipeline" ON public.pipeline;
CREATE POLICY "Founder full access pipeline" ON public.pipeline
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== todos =====
DROP POLICY IF EXISTS "Founder full access todos" ON public.todos;
CREATE POLICY "Founder full access todos" ON public.todos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== sponsored_items =====
DROP POLICY IF EXISTS "Founder full access sponsored_items" ON public.sponsored_items;
CREATE POLICY "Founder full access sponsored_items" ON public.sponsored_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);
-- Public read sponsored_items (anon, aktiv=true) bleibt bestehen.

-- ===== founder_pipeline =====
DROP POLICY IF EXISTS "Founder only pipeline" ON public.founder_pipeline;
CREATE POLICY "Founder only pipeline" ON public.founder_pipeline
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== founder_restaurants =====
DROP POLICY IF EXISTS "Founder only restaurants ext" ON public.founder_restaurants;
CREATE POLICY "Founder only restaurants ext" ON public.founder_restaurants
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== founder_todos =====
DROP POLICY IF EXISTS "Founder only todos" ON public.founder_todos;
CREATE POLICY "Founder only todos" ON public.founder_todos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ===== daily_push =====
-- Alle Schreib-Policies (INSERT/UPDATE/DELETE) auf Founder einschränken.
-- SELECT-Policies (public/anon read) bleiben — Gäste-Menu zeigt Tages-Specials.
DROP POLICY IF EXISTS "Authenticated insert daily_push" ON public.daily_push;
CREATE POLICY "Founder insert daily_push" ON public.daily_push
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

DROP POLICY IF EXISTS "Authenticated update daily_push" ON public.daily_push;
CREATE POLICY "Founder update daily_push" ON public.daily_push
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

DROP POLICY IF EXISTS "Authenticated delete daily_push" ON public.daily_push;
CREATE POLICY "Founder delete daily_push" ON public.daily_push
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- =================================================================
-- Fix 2 — menu_items INSERT/UPDATE: Founder ODER Restaurant-Owner.
-- =================================================================
DROP POLICY IF EXISTS "all_can_insert_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "all_can_update_menu_items" ON public.menu_items;

CREATE POLICY "Founder or owner can insert menu_items" ON public.menu_items
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Founder or owner can update menu_items" ON public.menu_items
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE auth_user_id = auth.uid()
    )
  );

-- Audit-Fixes vom 13. Mai 2026 — M-1, M-2, M-3, M-4.
-- M-5 (audit_log SELECT-Policy) weggelassen: Tabelle wird aktuell nicht
-- aktiv gelesen, Erweiterung später wenn der Log genutzt wird.

-- ============================================================
-- M-1: restaurant_tables Policy "Founder only tables" war
--      USING(true)/WITH CHECK(true) → faktisch keine Absicherung.
-- ============================================================
DROP POLICY IF EXISTS "Founder only tables" ON public.restaurant_tables;
CREATE POLICY "Founder access restaurant_tables"
  ON public.restaurant_tables
  FOR ALL
  TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

-- ============================================================
-- M-2: SECURITY DEFINER rls_auto_enable() darf nicht von anon/
--      authenticated direkt aufrufbar sein.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public;

-- ============================================================
-- M-3: Storage-Bucket restaurant-assets — `storage_all_access`
--      erlaubt anon ALL. Replace mit authenticated-only Write-Policies.
-- ============================================================
DROP POLICY IF EXISTS "storage_all_access" ON storage.objects;

CREATE POLICY "restaurant-assets authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'restaurant-assets');

CREATE POLICY "restaurant-assets authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'restaurant-assets')
  WITH CHECK (bucket_id = 'restaurant-assets');

CREATE POLICY "restaurant-assets authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'restaurant-assets');

-- ============================================================
-- M-4: Functions mit mutable search_path absichern.
-- ============================================================
ALTER FUNCTION public.increment_table_scan(table_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.restaurant_tables_fill_qr_url()
  SET search_path = public, pg_temp;

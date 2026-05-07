-- Fix P2-3 — restaurant_analytics_daily hatte RLS aktiv aber 0 Policies,
-- wodurch der Founder-Client (anon-key + Founder-Session) leer las und
-- KPI-Deltas/Analytics-Trends im Founder-Dashboard leer blieben.
-- Service-Role bleibt unbeeinflusst (bypasst RLS sowieso).

DROP POLICY IF EXISTS "Founder full access analytics_daily" ON public.restaurant_analytics_daily;

CREATE POLICY "Founder full access analytics_daily" ON public.restaurant_analytics_daily
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid)
  WITH CHECK (auth.uid() = 'b48eeabc-0652-4b8c-8579-4286c0570d54'::uuid);

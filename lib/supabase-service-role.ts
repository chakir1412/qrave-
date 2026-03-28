import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only: Supabase mit Service Role (umgeht RLS). Nur in Route Handlers / Server Actions verwenden.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

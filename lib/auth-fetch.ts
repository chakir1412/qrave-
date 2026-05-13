import { supabase } from "@/lib/supabase";

/** Wrap um `fetch`, der automatisch den Supabase-Access-Token als
 *  `Authorization: Bearer`-Header mitschickt. Cookies gehen ebenfalls
 *  mit (same-origin). Wird für interne `/api/dashboard/*` Routes
 *  verwendet, damit Auth auch dann greift, wenn Cookies aus Token-
 *  Refresh-Gründen veraltet sind. */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (!headers.has("content-type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

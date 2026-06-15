import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DSGVO Art. 17 — Recht auf Vergessen.
 * Wirt löscht eigenen Account inkl. aller Daten:
 *  - Storage-Files unter `restaurant-assets/${userId}/*`
 *  - restaurants-Row (CASCADE → menu_items, scan_events, daily_pushes,
 *    lunch_offers, restaurant_tables, restaurant_analytics_daily etc.)
 *  - Auth-User
 *
 * Rate-Limit: 3/h pro IP — niedrig, weil Endpoint destruktiv ist.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit("delete-account", ip, 3, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Rate Limit überschritten." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // Auth: User muss eingeloggt sein. Cookie ODER Bearer-Token.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  let user = (await supabaseAuth.auth.getUser()).data.user;
  if (!user) {
    const bearer = req.headers.get("authorization") ?? "";
    const token = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
    if (token) {
      const { data } = await supabaseAuth.auth.getUser(token);
      if (data.user) user = data.user;
    }
  }
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Founder darf NICHT über diesen Endpoint gelöscht werden (separater Admin-Flow).
  const founderId = process.env.FOUNDER_USER_ID ?? "";
  if (founderId && user.id === founderId) {
    return NextResponse.json(
      { success: false, error: "Founder-Account kann hier nicht gelöscht werden." },
      { status: 403 },
    );
  }

  const userId = user.id;
  const admin = createServiceRoleClient();

  // 1. Storage-Files unter ${userId}/* aus restaurant-assets entfernen.
  //    Storage löscht NICHT mit dem User — wir müssen manuell aufräumen,
  //    sonst Orphans + DSGVO-Verletzung (Bilder bleiben public erreichbar).
  try {
    const { data: files } = await admin.storage
      .from("restaurant-assets")
      .list(userId, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await admin.storage.from("restaurant-assets").remove(paths);
    }
  } catch (e) {
    console.error("[delete-account] storage cleanup:", e);
    // Nicht abbrechen — DB-Löschung hat Priorität.
  }

  // 2. Restaurant-Row löschen — ON DELETE CASCADE räumt menu_items,
  //    scan_events, daily_pushes, lunch_offers, restaurant_tables,
  //    restaurant_analytics_daily etc. mit weg.
  const { error: delRestErr } = await admin
    .from("restaurants")
    .delete()
    .eq("auth_user_id", userId);
  if (delRestErr) {
    console.error("[delete-account] restaurants delete:", delRestErr);
    return NextResponse.json(
      { success: false, error: "Restaurant-Daten konnten nicht gelöscht werden." },
      { status: 500 },
    );
  }

  // 3. Auth-User löschen. Wenn das fehlschlägt sind Daten weg, User bleibt
  //    — manueller Cleanup über Founder nötig. Wir loggen aber liefern OK,
  //    weil aus Wirts-Sicht der Account weg ist (kein Login mehr nutzbar
  //    ohne Restaurant-Zuordnung).
  const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
  if (delAuthErr) {
    console.error("[delete-account] auth.deleteUser:", delAuthErr);
  }

  return NextResponse.json({ success: true });
}

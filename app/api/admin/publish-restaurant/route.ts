import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { sendPublishConfirmation } from "@/lib/email";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Konstante-Zeit-Vergleich für Token. Verhindert Timing-Side-Channel. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Admin-Freischaltung über Mail-Link.
 *
 *   GET /api/admin/publish-restaurant?id=<uuid>&token=<ADMIN_SECRET>
 *
 * Setzt restaurants.published=true und status='live' und schickt die
 * Bestätigungs-Mail an den Wirt. Idempotent — mehrfacher Aufruf macht nichts. */
export async function GET(req: Request) {
  // Rate-Limit gegen Token-Brute-Force: 30 Aufrufe/h pro IP.
  // Legitime Aufrufe (Founder klickt Mail-Link) liegen weit darunter.
  const ip = getClientIp(req);
  const rl = await checkRateLimit("publish-restaurant", ip, 30, "1 h");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte später erneut versuchen." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret) {
    return NextResponse.json({ error: "Server nicht konfiguriert (ADMIN_SECRET fehlt)" }, { status: 500 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Ungültige Restaurant-ID" }, { status: 400 });
  }
  if (!token || !safeEqual(token, adminSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: before, error: getErr } = await supabase
    .from("restaurants")
    .select("id, slug, name, email, published")
    .eq("id", id)
    .maybeSingle();
  if (getErr) {
    return NextResponse.json({ error: getErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: "Restaurant nicht gefunden" }, { status: 404 });
  }
  if (before.published) {
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:48px;text-align:center;background:#0e0c0a;color:#fff;">
         <h1 style="color:#c9a84c;">Bereits freigeschaltet</h1>
         <p style="color:rgba(255,255,255,0.65);">${escapeHtml(before.name as string)} ist bereits live.</p>
         <p><a href="https://qrave.menu/${encodeURIComponent(String(before.slug))}" style="color:#c9a84c;">qrave.menu/${escapeHtml(String(before.slug))}</a></p>
       </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const { error: upErr } = await supabase
    .from("restaurants")
    .update({ published: true, status: "live" })
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (before.email) {
    await sendPublishConfirmation({
      restaurantName: String(before.name),
      slug: String(before.slug),
      ownerEmail: String(before.email),
    });
  }

  return new NextResponse(
    `<html><body style="font-family:system-ui;padding:48px;text-align:center;background:#0e0c0a;color:#fff;">
       <h1 style="color:#c9a84c;">✓ Freigeschaltet</h1>
       <p style="color:rgba(255,255,255,0.65);">${escapeHtml(String(before.name))} ist jetzt live unter:</p>
       <p><a href="https://qrave.menu/${encodeURIComponent(String(before.slug))}" style="color:#c9a84c;font-size:18px;">qrave.menu/${escapeHtml(String(before.slug))}</a></p>
       <p style="margin-top:24px;color:rgba(255,255,255,0.45);font-size:13px;">Eine Bestätigungs-Mail wurde an ${escapeHtml(String(before.email ?? "—"))} gesendet.</p>
     </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import {
  checkRateLimit,
  getClientIp,
  isUuid,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * POST /api/consent
 *
 * DSGVO Art. 7 Abs. 1 (Nachweispflicht): serverseitiger Consent-Log.
 * Wird bei Erteilung + Widerruf aufgerufen; initialer Decline wird NICHT
 * geloggt (nichts erteilt, nichts entzogen).
 *
 * Body: { consentId, restaurantId, consentVersion, purposes, action, locale }
 *   - consentId: pseudonyme Kennung aus localStorage.qrave_consent_id
 *   - action: 'granted' | 'withdrawn'
 *
 * Insert läuft über service_role (RLS blockt anon/authenticated komplett).
 */
export async function POST(req: Request) {
  try {
    // 30 Events / IP / 5 min: legitimer Nutzer klickt max 1-2× pro Session,
    // Bot-Spam wird gebremst ohne echte Nutzer zu blocken.
    const ip = getClientIp(req);
    const rl = await checkRateLimit("consent", ip, 30, "5 m");
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;

    const consentId =
      typeof o.consentId === "string" && o.consentId.trim().length > 0
        ? o.consentId.trim()
        : null;
    const restaurantId =
      typeof o.restaurantId === "string" ? o.restaurantId : null;
    const consentVersion =
      typeof o.consentVersion === "string" && o.consentVersion.trim().length > 0
        ? o.consentVersion.trim()
        : null;
    const purposes =
      typeof o.purposes === "object" && o.purposes !== null && !Array.isArray(o.purposes)
        ? (o.purposes as Record<string, unknown>)
        : null;
    const action =
      o.action === "granted" || o.action === "withdrawn" ? o.action : null;
    const locale = typeof o.locale === "string" ? o.locale.slice(0, 8) : null;

    if (!consentId || !restaurantId || !consentVersion || !purposes || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!isUuid(consentId)) {
      return NextResponse.json({ error: "Invalid consentId" }, { status: 400 });
    }
    if (!isUuid(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    if (consentVersion.length > 32) {
      return NextResponse.json({ error: "Invalid consentVersion" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("consent_log").insert({
      consent_id: consentId,
      restaurant_id: restaurantId,
      consent_version: consentVersion,
      purposes,
      action,
      locale,
    });

    if (error) {
      console.error("consent_log insert:", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

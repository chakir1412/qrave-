import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

/**
 * DSGVO-Löschung:
 *   (1) scan_events älter als 48 Stunden — Tier-1 Rohdaten-Retention.
 *   (2) consent_log älter als 3 Jahre — Nachweispflicht Art. 7 Abs. 1
 *       läuft mit Regelverjährungsfrist § 195 BGB ab.
 *
 * Trigger über cron-job.org täglich 03:30 Europe/Berlin
 * (30 Minuten nach aggregate-analytics — Aggregation muss zuerst laufen,
 * sonst werden Rohdaten gelöscht bevor sie ins Aggregat fließen).
 *
 * Auth: Bearer-Token wie bei aggregate-analytics.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const scanCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const consentCutoff = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const [scanRes, consentRes] = await Promise.all([
      supabase.from("scan_events").delete().lt("created_at", scanCutoff).select("id"),
      supabase.from("consent_log").delete().lt("created_at", consentCutoff).select("id"),
    ]);

    if (scanRes.error) {
      console.error("delete-old-scan-events:", scanRes.error);
      return NextResponse.json({ error: scanRes.error.message }, { status: 500 });
    }
    if (consentRes.error) {
      console.error("delete-old-consent-log:", consentRes.error);
      return NextResponse.json({ error: consentRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      scan_events: { deleted: scanRes.data?.length ?? 0, cutoff: scanCutoff },
      consent_log: { deleted: consentRes.data?.length ?? 0, cutoff: consentCutoff },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deletion fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

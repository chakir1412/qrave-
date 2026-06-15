import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

/**
 * DSGVO-Löschung: scan_events älter als 48 Stunden permanent entfernen.
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
    const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("scan_events")
      .delete()
      .lt("created_at", cutoffIso)
      .select("id");
    if (error) {
      console.error("delete-old-scan-events:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deleted: data?.length ?? 0, cutoff: cutoffIso });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deletion fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

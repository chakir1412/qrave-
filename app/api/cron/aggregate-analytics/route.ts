import { NextResponse } from "next/server";
import { berlinYmd, prevBerlinYmd } from "@/lib/berlin-time";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { aggregateAnalyticsForBerlinDay } from "@/lib/run-analytics-aggregation";
import { isYmd } from "@/lib/restaurant-analytics-presets";

/**
 * Cron / externer Scheduler: GET mit Header
 *   Authorization: Bearer <CRON_SECRET>
 * Optional: ?day=YYYY-MM-DD (sonst HEUTE + GESTERN, Europe/Berlin).
 *
 * Trigger über cron-job.org (Vercel Hobby erlaubt kein 15-Min-Cron).
 * Aggregiert pro Lauf heute UND gestern, damit am Tageswechsel keine
 * Events verloren gehen. Tagsüber kommen Live-Daten direkt aus
 * `scan_events` (Founder-Charts), nicht aus dem Aggregat.
 *
 * Auth: Bearer-Token wird IMMER geprüft. Der vorherige
 * User-Agent-Bypass für `vercel-cron` ist entfernt — der User-Agent
 * ist trivial fälschbar.
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

  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("day") ?? "";

  try {
    const supabase = createServiceRoleClient();

    // Expliziter ?day=… Parameter: nur diesen Tag aggregieren (kein Sold-Out-Reset).
    if (dayParam && isYmd(dayParam)) {
      const result = await aggregateAnalyticsForBerlinDay(supabase, dayParam);
      return NextResponse.json({ ok: true, days: [dayParam], ...result });
    }

    // Default: heute UND gestern. Heute, damit Live-Daten ankommen; gestern,
    // damit am Tageswechsel keine Events verloren gehen.
    const today = berlinYmd(new Date());
    const yesterday = prevBerlinYmd(today);
    const [todayResult, yesterdayResult] = await Promise.all([
      aggregateAnalyticsForBerlinDay(supabase, today),
      aggregateAnalyticsForBerlinDay(supabase, yesterday),
    ]);

    // Tages-Reset für menu_items.sold_out — idempotent (UPDATE wo sold_out=true).
    // Sollte vom externen Scheduler um ~4:00 Berlin getriggert werden;
    // läuft aber bei jedem Cron-Aufruf mit, kein Schaden.
    let soldOutReset = 0;
    try {
      const { data: reset, error: resetErr } = await supabase
        .from("menu_items")
        .update({ sold_out: false })
        .eq("sold_out", true)
        .select("id");
      if (resetErr) {
        console.error("sold_out reset:", resetErr);
      } else {
        soldOutReset = reset?.length ?? 0;
      }
    } catch (e) {
      console.error("sold_out reset exception:", e);
    }

    return NextResponse.json({
      ok: true,
      days: [today, yesterday],
      today: todayResult,
      yesterday: yesterdayResult,
      soldOutReset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Aggregation fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { berlinYmd, prevBerlinYmd } from "@/lib/berlin-time";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { aggregateAnalyticsForBerlinDay } from "@/lib/run-analytics-aggregation";
import { isYmd } from "@/lib/restaurant-analytics-presets";

/**
 * Vercel Cron / externer Scheduler: GET mit Header
 *   Authorization: Bearer <CRON_SECRET>
 * Optional: ?day=YYYY-MM-DD (sonst HEUTE + GESTERN, Europe/Berlin).
 *
 * Vercel-Hobby erlaubt nur tägliche Crons → läuft 1× pro Tag um 0:00 UTC.
 * Aggregiert dann heute UND gestern, damit am Tageswechsel keine Events
 * verloren gehen. Tagsüber kommen Live-Daten direkt aus `scan_events`
 * (siehe Founder-„Besucher pro Tag"-Chart) — nicht aus dem Aggregat.
 */
export async function GET(req: Request) {
  // Vercel Cron sendet keinen Authorization-Header — schickt aber den
  // user-agent "vercel-cron/1.0". Externe Scheduler bleiben mit
  // Bearer <CRON_SECRET> erlaubt.
  const ua = req.headers.get("user-agent") ?? "";
  const isVercelCron = ua.toLowerCase().includes("vercel-cron");
  if (!isVercelCron) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 500 });
    }
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const dayParam = searchParams.get("day") ?? "";

  try {
    const supabase = createServiceRoleClient();

    // Expliziter ?day=… Parameter: nur diesen Tag aggregieren.
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
    return NextResponse.json({
      ok: true,
      days: [today, yesterday],
      today: todayResult,
      yesterday: yesterdayResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Aggregation fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

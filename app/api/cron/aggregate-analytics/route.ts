import { NextResponse } from "next/server";
import { berlinYmd, prevBerlinYmd } from "@/lib/berlin-time";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { aggregateAnalyticsForBerlinDay } from "@/lib/run-analytics-aggregation";
import { isYmd } from "@/lib/restaurant-analytics-presets";

/**
 * Vercel Cron / externer Scheduler: GET mit Header
 *   Authorization: Bearer <CRON_SECRET>
 * Optional: ?day=YYYY-MM-DD (sonst gestern, Europe/Berlin).
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
  const dayYmd =
    dayParam && isYmd(dayParam) ? dayParam : prevBerlinYmd(berlinYmd(new Date()));

  try {
    const supabase = createServiceRoleClient();
    const result = await aggregateAnalyticsForBerlinDay(supabase, dayYmd);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Aggregation fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

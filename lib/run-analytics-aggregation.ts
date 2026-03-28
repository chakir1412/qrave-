import type { SupabaseClient } from "@supabase/supabase-js";
import { iterateBerlinDaysInclusive, nextBerlinYmd, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";
import { buildDailyRowsFromEvents, type RestaurantAnalyticsDailyRow } from "@/lib/analytics-daily-aggregate";
import type { RawRestaurantEventRow } from "@/lib/restaurant-analytics-aggregate";

const EVENT_SELECT =
  "id,session_id,event_type,created_at,stunde,tisch_nummer,item_name,kategorie,tier,restaurant_id";

async function fetchPage(
  supabase: SupabaseClient,
  restaurantId: string | undefined,
  fromIso: string,
  toExclusiveIso: string,
  offset: number,
  pageSize: number,
): Promise<RawRestaurantEventRow[]> {
  let q = supabase
    .from("scan_events")
    .select(EVENT_SELECT)
    .gte("created_at", fromIso)
    .lt("created_at", toExclusiveIso)
    .order("created_at", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (restaurantId) q = q.eq("restaurant_id", restaurantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as RawRestaurantEventRow[];
}

export async function fetchScanEventsInUtcRange(
  supabase: SupabaseClient,
  fromIso: string,
  toExclusiveIso: string,
  restaurantId?: string,
): Promise<RawRestaurantEventRow[]> {
  const pageSize = 1000;
  const all: RawRestaurantEventRow[] = [];
  let offset = 0;
  for (;;) {
    const [a, b, c] = await Promise.all([
      fetchPage(supabase, restaurantId, fromIso, toExclusiveIso, offset, pageSize),
      fetchPage(supabase, restaurantId, fromIso, toExclusiveIso, offset + pageSize, pageSize),
      fetchPage(supabase, restaurantId, fromIso, toExclusiveIso, offset + 2 * pageSize, pageSize),
    ]);
    all.push(...a, ...b, ...c);
    if (a.length === 0) break;
    if (c.length < pageSize) break;
    offset += 3 * pageSize;
  }
  return all;
}

export type AggregateDayResult = {
  dayYmd: string;
  eventCount: number;
  restaurantCount: number;
  rowsUpserted: number;
};

async function upsertDailyRows(supabase: SupabaseClient, rows: RestaurantAnalyticsDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error } = await supabase.from("restaurant_analytics_daily").upsert(part, {
      onConflict: "restaurant_id,day_berlin",
    });
    if (error) throw new Error(error.message);
  }
}

/**
 * Aggregiert alle `scan_events` für einen Berlin-Kalendertag und schreibt `restaurant_analytics_daily`.
 */
export async function aggregateAnalyticsForBerlinDay(
  supabase: SupabaseClient,
  dayYmd: string,
  options?: { restaurantId?: string },
): Promise<AggregateDayResult> {
  const fromIso = startOfBerlinYmdUtcIso(dayYmd);
  const toExclusiveIso = startOfBerlinYmdUtcIso(nextBerlinYmd(dayYmd));
  const events = await fetchScanEventsInUtcRange(supabase, fromIso, toExclusiveIso, options?.restaurantId);
  const rows = buildDailyRowsFromEvents(dayYmd, events);
  await upsertDailyRows(supabase, rows);
  return {
    dayYmd,
    eventCount: events.length,
    restaurantCount: rows.length,
    rowsUpserted: rows.length,
  };
}

export type BackfillResult = {
  fromYmd: string;
  toYmd: string;
  daysProcessed: number;
  totalEventsSeen: number;
  totalRowsUpserted: number;
};

export async function backfillAnalyticsRange(
  supabase: SupabaseClient,
  fromYmd: string,
  toYmd: string,
  options?: { restaurantId?: string },
): Promise<BackfillResult> {
  const days = iterateBerlinDaysInclusive(fromYmd, toYmd);
  let totalEventsSeen = 0;
  let totalRowsUpserted = 0;
  for (const day of days) {
    const r = await aggregateAnalyticsForBerlinDay(supabase, day, options);
    totalEventsSeen += r.eventCount;
    totalRowsUpserted += r.rowsUpserted;
  }
  return {
    fromYmd,
    toYmd,
    daysProcessed: days.length,
    totalEventsSeen,
    totalRowsUpserted,
  };
}

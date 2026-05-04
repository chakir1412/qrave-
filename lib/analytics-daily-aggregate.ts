import type { RawRestaurantEventRow } from "@/lib/restaurant-analytics-aggregate";

export type RestaurantAnalyticsDailyRow = {
  restaurant_id: string;
  day_berlin: string;
  scan_count: number;
  item_detail_count: number;
  category_enter_count: number;
  scans_morning: number;
  scans_midday: number;
  scans_evening: number;
  scans_night: number;
  sessions_count: number;
  sessions_with_consent: number;
  updated_at: string;
};

function sessionKey(e: RawRestaurantEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw.length > 0) return sidRaw;
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

function eventHourBerlin(e: RawRestaurantEventRow): number {
  if (e.stunde != null && Number.isFinite(e.stunde) && e.stunde >= 0 && e.stunde <= 23) {
    return e.stunde;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(e.created_at));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h : 0;
}

function timeBlockForHour(h: number): "morning" | "midday" | "evening" | "night" {
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 15) return "midday";
  if (h >= 15 && h < 22) return "evening";
  return "night";
}

function metricsForRestaurantEvents(
  restaurantId: string,
  dayYmd: string,
  events: RawRestaurantEventRow[],
): RestaurantAnalyticsDailyRow {
  // Eine "Session" = ein eindeutiger Besuch der Speisekarte. Wir nehmen die
  // session_id, fallen sonst auf die Event-ID zurück. Ein "Scan" wird
  // semantisch als der Beginn einer Session interpretiert — der frühest
  // gesehene Hour-Bucket pro Session entscheidet die Tageszeit.
  //
  // Hintergrund: `event_type === "scan"` wird nur vom Tier-0-Server-Pfad
  // (`/<slug>/<tischSegment>`) geschrieben — bei direktem Slug-Aufruf
  // entstehen keine "scan"-Rows, obwohl der Gast die Karte sieht. Vorher
  // war scan_count deshalb für die meisten Restaurants 0.
  const sessions = new Map<
    string,
    { firstHour: number; maxTier: number }
  >();
  for (const e of events) {
    const k = sessionKey(e);
    const h = eventHourBerlin(e);
    const t = e.tier ?? 0;
    const cur = sessions.get(k);
    if (cur) {
      if (h < cur.firstHour) cur.firstHour = h;
      if (t > cur.maxTier) cur.maxTier = t;
    } else {
      sessions.set(k, { firstHour: h, maxTier: t });
    }
  }

  const blocks = { morning: 0, midday: 0, evening: 0, night: 0 };
  for (const s of sessions.values()) {
    blocks[timeBlockForHour(s.firstHour)]++;
  }

  const sessionsCount = sessions.size;
  const withConsent = [...sessions.values()].filter((s) => s.maxTier >= 1).length;

  return {
    restaurant_id: restaurantId,
    day_berlin: dayYmd,
    scan_count: sessionsCount,
    item_detail_count: events.filter((e) => e.event_type === "item_detail").length,
    category_enter_count: events.filter((e) => e.event_type === "category_enter").length,
    scans_morning: blocks.morning,
    scans_midday: blocks.midday,
    scans_evening: blocks.evening,
    scans_night: blocks.night,
    sessions_count: sessionsCount,
    sessions_with_consent: withConsent,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Roh-Events müssen alle zum gleichen Kalendertag `dayYmd` (Europe/Berlin) gehören.
 */
export function buildDailyRowsFromEvents(
  dayYmd: string,
  events: RawRestaurantEventRow[],
): RestaurantAnalyticsDailyRow[] {
  const byRestaurant = new Map<string, RawRestaurantEventRow[]>();
  for (const e of events) {
    const rid = e.restaurant_id?.trim();
    if (!rid) continue;
    const list = byRestaurant.get(rid) ?? [];
    list.push(e);
    byRestaurant.set(rid, list);
  }
  const rows: RestaurantAnalyticsDailyRow[] = [];
  for (const [restaurantId, list] of byRestaurant) {
    rows.push(metricsForRestaurantEvents(restaurantId, dayYmd, list));
  }
  return rows;
}

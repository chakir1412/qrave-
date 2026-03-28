import type { FounderRestaurantTableRow } from "@/lib/founder-types";
import { berlinYmd, berlinYearMonthFromIso, iterateBerlinDaysInclusive, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";

export type RawRestaurantEventRow = {
  id: string;
  session_id: string | null;
  event_type: string;
  created_at: string;
  stunde: number | null;
  tisch_nummer: number | null;
  item_name: string | null;
  kategorie: string | null;
  tier: number;
  restaurant_id: string | null;
};

export type RestaurantAnalyticsGranularity = "day" | "month";

export type RestaurantAnalyticsComputed = {
  granularity: RestaurantAnalyticsGranularity;
  chartLabels: string[];
  chartScanCounts: number[];
  timeBlocks: { morning: number; midday: number; evening: number; night: number };
  tableCards: Array<{
    id: string;
    tisch_nummer: number;
    bereich: string | null;
    qr_url: string | null;
    scanCount: number;
    lastScanAt: string | null;
  }>;
  topItems: Array<{ name: string; count: number }>;
  topCategories: Array<{ name: string; count: number }>;
  consent: {
    totalSessions: number;
    withConsent: number;
    withoutConsent: number;
    ratePct: number;
  };
  /** Für CSV: Scans pro Kalendertag (Berlin) */
  scansByBerlinDay: Record<string, number>;
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

/** Kurze Zeiträume (ca. Woche/Monat): ein Balken pro Tag. Längere (z. B. Jahr): ein Balken pro Kalendermonat. */
function pickGranularity(fromYmd: string, toYmd: string): RestaurantAnalyticsGranularity {
  const n = iterateBerlinDaysInclusive(fromYmd, toYmd).length;
  if (n <= 40) return "day";
  return "month";
}

function formatDeShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export function aggregateRestaurantAnalytics(
  events: RawRestaurantEventRow[],
  tables: FounderRestaurantTableRow[],
  fromYmd: string,
  toYmd: string,
): RestaurantAnalyticsComputed {
  const scanEvents = events.filter((e) => e.event_type === "scan");

  const scansByBerlinDay: Record<string, number> = {};
  for (const e of scanEvents) {
    const y = berlinYmd(new Date(e.created_at));
    scansByBerlinDay[y] = (scansByBerlinDay[y] ?? 0) + 1;
  }

  const granularity = pickGranularity(fromYmd, toYmd);
  let chartLabels: string[] = [];
  let chartScanCounts: number[] = [];

  if (granularity === "day") {
    const days = iterateBerlinDaysInclusive(fromYmd, toYmd);
    chartLabels = days.map((d) => formatDeShort(d));
    chartScanCounts = days.map((d) => scansByBerlinDay[d] ?? 0);
  } else {
    const monthOrder: string[] = [];
    const seen = new Set<string>();
    for (const day of iterateBerlinDaysInclusive(fromYmd, toYmd)) {
      const iso = new Date(startOfBerlinYmdUtcIso(day)).toISOString();
      const { y, m } = berlinYearMonthFromIso(iso);
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!seen.has(key)) {
        seen.add(key);
        monthOrder.push(key);
      }
    }
    chartLabels = monthOrder.map((k) => {
      const [ys, ms] = k.split("-").map(Number);
      return new Date(ys, ms - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    });
    chartScanCounts = monthOrder.map((k) => {
      const [ys, ms] = k.split("-").map(Number);
      let c = 0;
      for (const day of iterateBerlinDaysInclusive(fromYmd, toYmd)) {
        const iso = new Date(startOfBerlinYmdUtcIso(day)).toISOString();
        const ym = berlinYearMonthFromIso(iso);
        if (ym.y === ys && ym.m === ms) c += scansByBerlinDay[day] ?? 0;
      }
      return c;
    });
  }

  const blocks = { morning: 0, midday: 0, evening: 0, night: 0 };
  for (const e of scanEvents) {
    const b = timeBlockForHour(eventHourBerlin(e));
    blocks[b]++;
  }

  const byTisch = new Map<number, { count: number; last: string }>();
  for (const e of scanEvents) {
    if (e.tisch_nummer == null) continue;
    const n = e.tisch_nummer;
    const cur = byTisch.get(n) ?? { count: 0, last: e.created_at };
    const nextCount = cur.count + 1;
    const last = e.created_at > cur.last ? e.created_at : cur.last;
    byTisch.set(n, { count: nextCount, last });
  }

  const tableCards = tables.map((t) => {
    const agg = byTisch.get(t.tisch_nummer);
    return {
      id: t.id,
      tisch_nummer: t.tisch_nummer,
      bereich: t.bereich,
      qr_url: t.qr_url,
      scanCount: agg?.count ?? 0,
      lastScanAt: agg?.last ?? null,
    };
  });
  tableCards.sort((a, b) => b.scanCount - a.scanCount);

  const itemMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "item_detail") continue;
    const n = e.item_name?.trim();
    if (!n) continue;
    itemMap.set(n, (itemMap.get(n) ?? 0) + 1);
  }
  const topItems = [...itemMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const catMap = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "category_enter") continue;
    const k = e.kategorie?.trim();
    if (!k) continue;
    catMap.set(k, (catMap.get(k) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const sessions = new Map<string, number>();
  for (const e of events) {
    const k = sessionKey(e);
    const t = e.tier ?? 0;
    const cur = sessions.get(k) ?? 0;
    if (t > cur) sessions.set(k, t);
  }
  const totalSessions = sessions.size;
  const withConsent = [...sessions.values()].filter((t) => t >= 1).length;
  const withoutConsent = totalSessions - withConsent;
  const ratePct = totalSessions > 0 ? Math.round((withConsent / totalSessions) * 100) : 0;

  return {
    granularity,
    chartLabels,
    chartScanCounts,
    timeBlocks: blocks,
    tableCards,
    topItems,
    topCategories,
    consent: {
      totalSessions,
      withConsent,
      withoutConsent,
      ratePct,
    },
    scansByBerlinDay,
  };
}

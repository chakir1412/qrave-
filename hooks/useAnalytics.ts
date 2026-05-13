import { supabase } from "@/lib/supabase";
import {
  type AnalyticsEventRow,
  type PeakRow,
} from "@/components/dashboard/analytics";

export type HourBuckets = {
  /** 8–12h */ morning: number;
  /** 12–15h */ midday: number;
  /** 17–21h */ evening: number;
  /** 21–24h */ night: number;
};

export type DashboardAnalytics = {
  events: AnalyticsEventRow[];
  viewsToday: number | null;
  viewsYesterday: number | null;
  topItemToday: string | null;
  /** Top-Items der Woche.
   *  count = clicks (item_detail-Events, also Modal-Open).
   *  views = item_view-Events (Card im Viewport ≥ 0.5 / ≥ 500ms, 1× pro Session). */
  topItemsWeek: { name: string; count: number; views: number }[];
  weekSeries: number[];
  /** Eindeutige Sessions in den letzten 30 Tagen (rolling). Für die
   *  "Dieser Monat"-Stat-Karte im HomeTab. */
  monthTotal: number;
  peaksToday: PeakRow[];
  /** Sessions pro Tagesabschnitt heute (für die Peak-Zeiten-Balken). */
  hourBuckets: HourBuckets;
  topFilter: string | null;
};

type ScanEventRow = {
  id: string;
  session_id: string | null;
  item_id: string | null;
  item_name: string | null;
  event_type: string | null;
  filter_key: string | null;
  created_at: string;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(ref: Date): Date {
  const d = startOfLocalDay(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function sessionKey(e: ScanEventRow): string {
  const sid = e.session_id?.trim();
  return sid && sid.length > 0 ? sid : `row:${e.id}`;
}

/** Liefert die Aufrufe-Kennzahlen + Top-Items aus `scan_events`.
 *  „Aufruf" = ein eindeutiger Besuch (session_id), passend zum Backend-
 *  Aggregat in `restaurant_analytics_daily`. */
export async function fetchDashboardAnalytics(
  restaurantId: string,
): Promise<DashboardAnalytics> {
  const today = new Date();
  const startToday = startOfLocalDay(today);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const monday = startOfWeekMonday(today);
  const sundayEnd = new Date(monday);
  sundayEnd.setDate(monday.getDate() + 7);
  // Fenster: aktuelle Woche (Mo–So), Vorwoche (für montagmorgens) und
  // 30 Tage rolling für die "Dieser Monat"-Karte. Wir nehmen das Maximum.
  const fetchFrom = new Date(startToday);
  fetchFrom.setDate(fetchFrom.getDate() - 30);
  const monthFrom = new Date(startToday);
  monthFrom.setDate(monthFrom.getDate() - 29);

  const { data, error } = await supabase
    .from("scan_events")
    .select("id, session_id, item_id, item_name, event_type, filter_key, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", fetchFrom.toISOString());

  if (error || !data) {
    return {
      events: [],
      viewsToday: null,
      viewsYesterday: null,
      topItemToday: null,
      topItemsWeek: [],
      weekSeries: [0, 0, 0, 0, 0, 0, 0],
      monthTotal: 0,
      peaksToday: [],
      hourBuckets: { morning: 0, midday: 0, evening: 0, night: 0 },
      topFilter: null,
    };
  }

  const events = data as ScanEventRow[];

  // Mapped-Form für Komponenten, die noch AnalyticsEventRow erwarten
  // (Top-3-Box, Klickrows-Sektion). Identisch zum bisherigen Vertrag.
  const eventsMapped: AnalyticsEventRow[] = events.map((e) => ({
    item_id: e.item_id,
    item_name: e.item_name,
    event_type: e.event_type,
    filter_key: e.filter_key,
    created_at: e.created_at,
    session_id: e.session_id,
  }));

  // Sessions pro Tag-Key sammeln.
  const sessionsByDay = new Map<string, Set<string>>();
  function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  for (const e of events) {
    const t = new Date(e.created_at);
    const k = dayKey(startOfLocalDay(t));
    let set = sessionsByDay.get(k);
    if (!set) {
      set = new Set();
      sessionsByDay.set(k, set);
    }
    set.add(sessionKey(e));
  }
  function sessionsOnDay(d: Date): number {
    return sessionsByDay.get(dayKey(d))?.size ?? 0;
  }

  const viewsToday = sessionsOnDay(startToday);
  const viewsYesterday = sessionsOnDay(startYesterday);

  // Wochenserie Mo–So.
  const weekSeries: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekSeries.push(sessionsOnDay(d));
  }

  // Top-Items: clicks (item_detail) + views (item_view) in der aktuellen Woche.
  // count = Klicks (Modal-Open) — Engagement-Signal.
  // views = wie oft die Item-Card überhaupt im Viewport war (≥ 0.5 / ≥ 500ms).
  // Rate clicks/views = View-to-Click Conversion.
  const weekItemStats = new Map<string, { clicks: number; views: number }>();
  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < monday || t >= sundayEnd) continue;
    if (e.event_type !== "item_detail" && e.event_type !== "item_view") continue;
    const name = typeof e.item_name === "string" ? e.item_name.trim() : "";
    if (!name) continue;
    const cur = weekItemStats.get(name) ?? { clicks: 0, views: 0 };
    if (e.event_type === "item_detail") cur.clicks += 1;
    else cur.views += 1;
    weekItemStats.set(name, cur);
  }
  // Top 10 nach clicks DESC. Items mit views aber 0 clicks landen nicht in
  // der Top-Liste — niedrig konvertierende Items werden über die Rate selbst
  // sichtbar (siehe Hervorhebung im HomeTab).
  const topItemsWeek = [...weekItemStats.entries()]
    .filter(([, v]) => v.clicks > 0)
    .sort((a, b) => b[1].clicks - a[1].clicks || b[1].views - a[1].views)
    .slice(0, 10)
    .map(([name, v]) => ({ name, count: v.clicks, views: v.views }));

  const todayByItem = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "item_detail") continue;
    if (!e.item_name) continue;
    const t = new Date(e.created_at);
    if (t < startToday) continue;
    const k = e.item_name.trim();
    todayByItem.set(k, (todayByItem.get(k) ?? 0) + 1);
  }
  const topItemToday =
    [...todayByItem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Peak-Stunden heute: pro Stunde eindeutige Sessions zählen
  // (sonst dominiert eine einzelne aktive Session die Buckets).
  const sessionsByHour = new Map<number, Set<string>>();
  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < startToday) continue;
    const sk = sessionKey(e);
    const h = t.getHours();
    let set = sessionsByHour.get(h);
    if (!set) {
      set = new Set();
      sessionsByHour.set(h, set);
    }
    set.add(sk);
  }
  const peaksToday: PeakRow[] = [...sessionsByHour.entries()]
    .map(([h, set]) => ({ label: `${h}–${h + 1}h`, count: set.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Tagesabschnitt-Buckets heute (Sessions, deduped pro Bucket).
  const bucketSessions = {
    morning: new Set<string>(),
    midday: new Set<string>(),
    evening: new Set<string>(),
    night: new Set<string>(),
  };
  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < startToday) continue;
    const sk = sessionKey(e);
    const h = t.getHours();
    if (h >= 8 && h < 12) bucketSessions.morning.add(sk);
    else if (h >= 12 && h < 15) bucketSessions.midday.add(sk);
    else if (h >= 17 && h < 21) bucketSessions.evening.add(sk);
    else if (h >= 21 && h < 24) bucketSessions.night.add(sk);
  }
  const hourBuckets: HourBuckets = {
    morning: bucketSessions.morning.size,
    midday: bucketSessions.midday.size,
    evening: bucketSessions.evening.size,
    night: bucketSessions.night.size,
  };

  // Rolling-30-Tage-Sessions: für die "Dieser Monat"-Stat-Karte.
  const monthSessions = new Set<string>();
  for (const e of events) {
    const t = new Date(e.created_at);
    if (t < monthFrom) continue;
    monthSessions.add(sessionKey(e));
  }
  const monthTotal = monthSessions.size;

  // Top-Filter: filter_set-Events der letzten Woche.
  const byFilter = new Map<string, number>();
  for (const e of events) {
    if (!e.filter_key) continue;
    if (e.event_type !== "filter_set") continue;
    byFilter.set(e.filter_key, (byFilter.get(e.filter_key) ?? 0) + 1);
  }
  const topFilter =
    [...byFilter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    events: eventsMapped,
    viewsToday,
    viewsYesterday,
    topItemToday,
    topItemsWeek,
    weekSeries,
    monthTotal,
    peaksToday,
    hourBuckets,
    topFilter,
  };
}

import { supabase } from "@/lib/supabase";
import {
  type AnalyticsEventRow,
  peakHoursToday,
  weekScanCounts,
} from "@/components/dashboard/analytics";

export type DashboardAnalytics = {
  events: AnalyticsEventRow[];
  viewsToday: number | null;
  viewsYesterday: number | null;
  topItemToday: string | null;
  topItemsWeek: { name: string; count: number }[];
  weekSeries: number[];
  peaksToday: ReturnType<typeof peakHoursToday>;
  topFilter: string | null;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function fetchDashboardAnalytics(
  restaurantId: string,
): Promise<DashboardAnalytics> {
  const today = new Date();
  const startToday = startOfLocalDay(today);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 13);

  const { data, error } = await supabase
    .from("analytics_events")
    .select("item_id, item_name, event_type, filter_key, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startWeek.toISOString());

  if (error || !data) {
    return {
      events: [],
      viewsToday: null,
      viewsYesterday: null,
      topItemToday: null,
      topItemsWeek: [],
      weekSeries: [0, 0, 0, 0, 0, 0, 0],
      peaksToday: [],
      topFilter: null,
    };
  }

  const events = data as AnalyticsEventRow[];

  const todayEvents = events.filter((e) => new Date(e.created_at) >= startToday);
  const yesterdayEvents = events.filter((e) => {
    const t = new Date(e.created_at);
    return t >= startYesterday && t < startToday;
  });

  const weekEvents = events.filter((e) => {
    const t = new Date(e.created_at);
    const monday = new Date(startOfLocalDay(today));
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sun = new Date(monday);
    sun.setDate(monday.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return t >= monday && t <= sun;
  });

  const todayByItem = new Map<string, number>();
  for (const e of todayEvents) {
    if (!e.item_name) continue;
    const k = e.item_name;
    todayByItem.set(k, (todayByItem.get(k) ?? 0) + 1);
  }
  const sortedToday = [...todayByItem.entries()].sort((a, b) => b[1] - a[1]);
  const topItemToday = sortedToday[0]?.[0] ?? null;

  const weekByItem = new Map<string, number>();
  for (const e of weekEvents) {
    if (!e.item_name) continue;
    const k = e.item_name;
    weekByItem.set(k, (weekByItem.get(k) ?? 0) + 1);
  }
  const topItemsWeek = [...weekByItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const byFilter = new Map<string, number>();
  for (const e of events) {
    if (!e.filter_key) continue;
    byFilter.set(e.filter_key, (byFilter.get(e.filter_key) ?? 0) + 1);
  }
  const sortedFilters = [...byFilter.entries()].sort((a, b) => b[1] - a[1]);
  const topFilter = sortedFilters[0]?.[0] ?? null;

  return {
    events,
    viewsToday: todayEvents.length,
    viewsYesterday: yesterdayEvents.length,
    topItemToday,
    topItemsWeek,
    weekSeries: weekScanCounts(events, today),
    peaksToday: peakHoursToday(events, today),
    topFilter,
  };
}

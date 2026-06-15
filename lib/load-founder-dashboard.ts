import type { SupabaseClient } from "@supabase/supabase-js";
import type { FounderDashboardData, FounderAnalyticsDailyRow } from "@/lib/founder-types";
import { loadFounderKpiDeltas } from "@/lib/founder-kpi-deltas";
import { startOfBerlinYearUtcIso } from "@/lib/berlin-time";
import { dedupeSessionsKeepFirstEvent } from "@/lib/dedupe-scan-sessions";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

const SCAN_SELECT =
  "id,session_id,event_type,stunde,wochentag,monat,tisch_nummer,item_name,kategorie,main_tab,duration_seconds,tier,created_at,restaurant_id";

/** Höheres Limit, damit Deduplizierung nach session_id im Fenster nicht verzerrt. */
const SESSION_WINDOW_ROW_LIMIT = 4000;

export async function loadFounderDashboardData(
  supabase: SupabaseClient,
): Promise<{ data: FounderDashboardData; errors: string[] }> {
  const now = new Date();
  const berlinMidnight = new Date(
    `${now.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}T00:00:00+01:00`,
  );
  const todayStart = berlinMidnight.toISOString();
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const yearStart = startOfBerlinYearUtcIso();

  const scanBaseAllTypes = (limit: number) =>
    supabase.from("scan_events").select(SCAN_SELECT).order("created_at", { ascending: false }).limit(limit);

  const sessionWindowBase = () =>
    supabase
      .from("scan_events")
      .select(SCAN_SELECT)
      .order("created_at", { ascending: false })
      .limit(SESSION_WINDOW_ROW_LIMIT);

  // restaurant_analytics_daily hat RLS und anon kann nicht lesen — service-role.
  // Berlin-Datum (YYYY-MM-DD) für die letzten 30 Tage.
  const todayBerlin = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const dailyFrom = new Date(
    new Date(`${todayBerlin}T00:00:00+00:00`).getTime() - 29 * 86400000,
  )
    .toISOString()
    .slice(0, 10);

  async function loadAnalyticsDaily(): Promise<FounderAnalyticsDailyRow[]> {
    try {
      const srv = createServiceRoleClient();
      const { data, error } = await srv
        .from("restaurant_analytics_daily")
        .select(
          "restaurant_id, day_berlin, sessions_count, scan_count, sessions_with_consent, scans_morning, scans_midday, scans_evening, scans_night, item_detail_count, category_clicks, beverage_subcategory_clicks, top_items, vegan_clicks, vegetarian_clicks, avg_item_price_clicked",
        )
        .gte("day_berlin", dailyFrom)
        .order("day_berlin", { ascending: true });
      if (error || !data) return [];
      return data as FounderAnalyticsDailyRow[];
    } catch {
      return [];
    }
  }

  async function loadAllMenuItems(): Promise<import("@/lib/founder-types").FounderMenuItem[]> {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, name, kategorie, preis, tags")
      .eq("aktiv", true);
    if (error || !data) return [];
    return data as import("@/lib/founder-types").FounderMenuItem[];
  }

  /** Letzter Dashboard-Login pro User-ID (aus Supabase Auth Admin API).
   *  Onboarding-Tracking: hilft erkennen wer aktiv ist. Bei fehlender
   *  Service-Key: leeres Mapping (UI zeigt "—"). */
  async function loadLastLoginByUserId(): Promise<Record<string, string | null>> {
    try {
      const srv = createServiceRoleClient();
      const out: Record<string, string | null> = {};
      let page = 1;
      const perPage = 200;
      for (;;) {
        const { data, error } = await srv.auth.admin.listUsers({ page, perPage });
        if (error || !data) break;
        for (const u of data.users) {
          out[u.id] = u.last_sign_in_at ?? null;
        }
        if (data.users.length < perPage) break;
        page += 1;
        if (page > 50) break;
      }
      return out;
    } catch {
      return {};
    }
  }

  /** MAX(menu_items.updated_at) pro restaurant_id. Service Role um RLS-
   *  Edge-Cases zu umgehen; Read-only. */
  async function loadLastMenuUpdate(): Promise<Record<string, string | null>> {
    try {
      const srv = createServiceRoleClient();
      const { data, error } = await srv
        .from("menu_items")
        .select("restaurant_id, updated_at")
        .order("updated_at", { ascending: false });
      if (error || !data) return {};
      const out: Record<string, string | null> = {};
      for (const row of data as { restaurant_id: string | null; updated_at: string | null }[]) {
        if (!row.restaurant_id) continue;
        if (out[row.restaurant_id] !== undefined) continue;
        out[row.restaurant_id] = row.updated_at ?? null;
      }
      return out;
    } catch {
      return {};
    }
  }

  const [r1, rAllWeek, rToday, rWeek, rMonth, rYear, rPipe, rTodo, rExt, rTbl, kpiDeltas, analyticsDaily30d, allMenuItems, lastLoginByUserId, lastMenuUpdateByRestaurantId] = await Promise.all([
    supabase.from("restaurants").select("*").order("created_at", { ascending: false }),
    scanBaseAllTypes(SESSION_WINDOW_ROW_LIMIT).gte("created_at", weekStart),
    sessionWindowBase().gte("created_at", todayStart),
    sessionWindowBase().gte("created_at", weekStart),
    sessionWindowBase().gte("created_at", monthStart),
    sessionWindowBase().gte("created_at", yearStart),
    supabase.from("pipeline").select("*").order("created_at", { ascending: false }),
    supabase.from("founder_todos").select("*").order("created_at", { ascending: false }),
    supabase.from("founder_restaurants").select("*"),
    supabase
      .from("restaurant_tables")
      .select("id, restaurant_id, tisch_nummer, bereich, qr_url, nfc_installiert, sticker_installiert, created_at")
      .order("restaurant_id", { ascending: true })
      .order("tisch_nummer", { ascending: true }),
    loadFounderKpiDeltas(now),
    loadAnalyticsDaily(),
    loadAllMenuItems(),
    loadLastLoginByUserId(),
    loadLastMenuUpdate(),
  ]);

  const errors: string[] = [];
  const note = (r: { error: { message: string } | null }, label: string) => {
    if (r.error) errors.push(`${label}: ${r.error.message}`);
  };
  note(r1, "restaurants");
  note(rAllWeek, "scan_events_all_week");
  note(rToday, "scan_events_today");
  note(rWeek, "scan_events_week");
  note(rMonth, "scan_events_month");
  note(rYear, "scan_events_year");
  note(rPipe, "pipeline");
  note(rTodo, "founder_todos");
  note(rExt, "founder_restaurants");
  note(rTbl, "restaurant_tables");

  const scanEventsToday = dedupeSessionsKeepFirstEvent(
    (rToday.data ?? []) as FounderDashboardData["scanEventsToday"],
  );
  const scanEventsWeek = dedupeSessionsKeepFirstEvent(
    (rWeek.data ?? []) as FounderDashboardData["scanEventsWeek"],
  );
  const scanEventsMonth = dedupeSessionsKeepFirstEvent(
    (rMonth.data ?? []) as FounderDashboardData["scanEventsMonth"],
  );
  const scanEventsYear = dedupeSessionsKeepFirstEvent(
    (rYear.data ?? []) as FounderDashboardData["scanEventsYear"],
  );

  const data: FounderDashboardData = {
    restaurants: (r1.data ?? []) as FounderDashboardData["restaurants"],
    scanEvents: (rAllWeek.data ?? []) as FounderDashboardData["scanEvents"],
    scanEventsToday,
    scanEventsWeek,
    scanEventsMonth,
    scanEventsYear,
    pipeline: (rPipe.data ?? []) as FounderDashboardData["pipeline"],
    todos: (rTodo.data ?? []) as FounderDashboardData["todos"],
    restaurantExtras: (rExt.data ?? []) as FounderDashboardData["restaurantExtras"],
    restaurantTables: (rTbl.data ?? []) as FounderDashboardData["restaurantTables"],
    kpiDeltas,
    analyticsDaily30d,
    allMenuItems,
    lastLoginByUserId,
    lastMenuUpdateByRestaurantId,
  };

  return { data, errors };
}

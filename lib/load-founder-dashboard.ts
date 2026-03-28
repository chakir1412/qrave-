import type { SupabaseClient } from "@supabase/supabase-js";
import type { FounderDashboardData } from "@/lib/founder-types";
import { startOfBerlinYearUtcIso } from "@/lib/berlin-time";
import { dedupeSessionsKeepFirstEvent } from "@/lib/dedupe-scan-sessions";

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

  const [r1, rAllWeek, rToday, rWeek, rMonth, rYear, rPipe, rTodo, rExt, rTbl] = await Promise.all([
    supabase.from("restaurants").select("*").order("created_at", { ascending: false }),
    scanBaseAllTypes(SESSION_WINDOW_ROW_LIMIT).gte("created_at", weekStart),
    sessionWindowBase().gte("created_at", todayStart),
    sessionWindowBase().gte("created_at", weekStart),
    sessionWindowBase().gte("created_at", monthStart),
    sessionWindowBase().gte("created_at", yearStart),
    supabase.from("founder_pipeline").select("*").order("added_at", { ascending: false }),
    supabase.from("founder_todos").select("*").order("created_at", { ascending: false }),
    supabase.from("founder_restaurants").select("*"),
    supabase
      .from("restaurant_tables")
      .select("id, restaurant_id, tisch_nummer, bereich, qr_url, nfc_programmiert, sticker_angebracht, created_at")
      .order("restaurant_id", { ascending: true })
      .order("tisch_nummer", { ascending: true }),
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
  note(rPipe, "founder_pipeline");
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
  };

  return { data, errors };
}

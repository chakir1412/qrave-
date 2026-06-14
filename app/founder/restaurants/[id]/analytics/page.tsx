import type { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase-service-role";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import { AnalyticsContent } from "./AnalyticsContent";

export const metadata: Metadata = {
  title: "Restaurant Analytics · Founder",
  robots: { index: false, follow: false },
};

export type RestaurantRow = {
  id: string;
  name: string;
  cuisine_type: string | null;
  stadtbezirk: string | null;
  restaurant_typ: string | null;
  published: boolean | null;
  aktiv: boolean | null;
};

export type AnalyticsDailyRow = {
  restaurant_id: string;
  day_berlin: string;
  scan_count: number | null;
  sessions_count: number | null;
  sessions_with_consent: number | null;
  item_detail_count: number | null;
  scans_morning: number | null;
  scans_midday: number | null;
  scans_evening: number | null;
  scans_night: number | null;
  category_clicks: Record<string, number> | null;
  beverage_subcategory_clicks: Record<string, number> | null;
  top_items: Array<{ name: string; clicks: number; price: number | null; kategorie?: string | null }> | null;
  vegan_clicks: number | null;
  vegetarian_clicks: number | null;
  avg_item_price_clicked: number | null;
};

export type ScanEventRow = {
  event_type: string | null;
  stunde: number | null;
  wochentag: number | null;
  session_id: string | null;
  duration_seconds: number | null;
  session_duration: number | null;
  return_visit: boolean | null;
  bounce: boolean | null;
  created_at: string;
};

function berlinTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default async function RestaurantAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Auth: nur Founder
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== process.env.FOUNDER_USER_ID) {
    redirect("/founder");
  }

  // Datums-Ranges (Berlin). Zeitraum kommt optional aus den URL-SearchParams
  // (`?from=YYYY-MM-DD&to=YYYY-MM-DD`), vom RangePicker im Client gesetzt.
  // Fallback ohne URL-Range: letzte 30 Tage (bisheriges Verhalten).
  const today = berlinTodayIso();
  const toIso = isYmd(sp.to ?? "") && sp.to! <= today ? sp.to! : today;
  const dailyFrom =
    isYmd(sp.from ?? "") && sp.from! <= toIso ? sp.from! : shiftIso(today, -29);
  const eventsFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // restaurant_analytics_daily hat RLS — service-role nutzen für Aggregat-Reads
  const srv = createServiceRoleClient();

  // Parallel-Fetch — ein Roundtrip
  const [restaurantRes, dailyRes, eventsRes] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, cuisine_type, stadtbezirk, restaurant_typ, published, aktiv")
      .eq("id", id)
      .maybeSingle(),
    srv
      .from("restaurant_analytics_daily")
      .select(
        "restaurant_id, day_berlin, scan_count, sessions_count, sessions_with_consent, item_detail_count, scans_morning, scans_midday, scans_evening, scans_night, category_clicks, beverage_subcategory_clicks, top_items, vegan_clicks, vegetarian_clicks, avg_item_price_clicked",
      )
      .eq("restaurant_id", id)
      .gte("day_berlin", dailyFrom)
      .lte("day_berlin", toIso)
      .order("day_berlin", { ascending: true }),
    supabase
      .from("scan_events")
      .select(
        "event_type, stunde, wochentag, session_id, duration_seconds, session_duration, return_visit, bounce, created_at",
      )
      .eq("restaurant_id", id)
      .gte("created_at", eventsFrom)
      .in("event_type", ["scan", "item_detail", "session_end", "bounce"])
      .order("created_at", { ascending: true })
      .limit(8000),
  ]);

  if (!restaurantRes.data) {
    redirect("/founder");
  }

  return (
    <div className="qrave-shell qrave-shell--founder">
      <div className="qrave-bg" aria-hidden>
        <div className="qrave-rays">
          <div className="qrave-ray qrave-ray-1" />
          <div className="qrave-ray qrave-ray-2" />
          <div className="qrave-ray qrave-ray-3" />
          <div className="qrave-ray qrave-ray-4" />
          <div className="qrave-ray qrave-ray-5" />
        </div>
        <div className="qrave-corner-glow" />
        <div className="qrave-grid-overlay" />
      </div>
      <div className="relative z-[1]">
        <AnalyticsContent
          restaurant={restaurantRes.data as RestaurantRow}
          analyticsDaily={(dailyRes.data ?? []) as AnalyticsDailyRow[]}
          scanEvents7d={(eventsRes.data ?? []) as ScanEventRow[]}
        />
      </div>
    </div>
  );
}

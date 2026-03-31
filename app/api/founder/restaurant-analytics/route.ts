import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { berlinYmd, iterateBerlinDaysInclusive, nextBerlinYmd, startOfBerlinYmdUtcIso } from "@/lib/berlin-time";
import { isYmd } from "@/lib/restaurant-analytics-presets";
import type { FounderRestaurantTableRow } from "@/lib/founder-types";
import type { RestaurantAnalyticsApiPayload, RestaurantAnalyticsApiRestaurant } from "@/lib/restaurant-analytics-api-types";
import type { RawRestaurantEventRow } from "@/lib/restaurant-analytics-aggregate";
import { createServiceRoleClient } from "@/lib/supabase-service-role";

type DailyRow = {
  day_berlin: string;
  scan_count: number;
  scans_morning: number;
  scans_midday: number;
  scans_evening: number;
  scans_night: number;
  sessions_count: number;
  sessions_with_consent: number;
};

function eventHourBerlin(e: RawRestaurantEventRow): number {
  if (e.stunde != null && Number.isFinite(e.stunde) && e.stunde >= 0 && e.stunde <= 23) return e.stunde;
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

function pickGranularity(fromYmd: string, toYmd: string): "day" | "month" {
  return iterateBerlinDaysInclusive(fromYmd, toYmd).length <= 40 ? "day" : "month";
}

function formatDeShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function sessionKey(e: RawRestaurantEventRow): string {
  const sidRaw = e.session_id?.trim() ? e.session_id : e.id;
  if (sidRaw.length > 0) return sidRaw;
  return `row:${e.created_at}:${e.event_type}:${e.restaurant_id ?? ""}`;
}

export async function GET(req: Request) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const fromYmd = searchParams.get("from") ?? "";
  const toYmd = searchParams.get("to") ?? "";

  if (!restaurantId || !isYmd(fromYmd) || !isYmd(toYmd)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  if (fromYmd > toYmd) {
    return NextResponse.json({ error: "from after to" }, { status: 400 });
  }

  const fromIso = startOfBerlinYmdUtcIso(fromYmd);
  const toExclusiveIso = startOfBerlinYmdUtcIso(nextBerlinYmd(toYmd));
  const todayYmd = berlinYmd(new Date());
  const includesToday = fromYmd <= todayYmd && toYmd >= todayYmd;
  const supabaseSrv = createServiceRoleClient();

  type RestaurantRow = {
    id: string;
    name: string;
    slug: string;
    stadt: string | null;
    telefon: string | null;
    aktiv: boolean;
  };

  let restaurantRow: RestaurantRow;
  let tablesData: FounderRestaurantTableRow[] | null = null;
  let extRow: {
    next_visit: string | null;
    last_visit: string | null;
    note: string | null;
    sticker_tier: string | null;
    sticker_paid: boolean;
    sticker_count: number;
  } | null = null;

  let dailyRows: DailyRow[] = [];
  let topItemRows: Array<{ item_name: string | null }> = [];
  let topCategoryRows: Array<{ kategorie: string | null }> = [];
  let tableScanRows: Array<{ tisch_nummer: number | null; created_at: string }> = [];
  try {
    const [rRes, tRes, frRes, dailyRes, itemsRes, catsRes, tableScansRes] = await Promise.all([
      supabase.from("restaurants").select("id,name,slug,stadt,telefon,aktiv").eq("id", restaurantId).maybeSingle(),
      supabase
        .from("restaurant_tables")
        .select("id,restaurant_id,tisch_nummer,bereich,qr_url,nfc_programmiert,sticker_angebracht,created_at")
        .eq("restaurant_id", restaurantId)
        .order("tisch_nummer", { ascending: true }),
      supabase
        .from("founder_restaurants")
        .select("next_visit,last_visit,note,sticker_tier,sticker_paid,sticker_count")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      supabaseSrv
        .from("restaurant_analytics_daily")
        .select("day_berlin,scan_count,scans_morning,scans_midday,scans_evening,scans_night,sessions_count,sessions_with_consent")
        .eq("restaurant_id", restaurantId)
        .gte("day_berlin", fromYmd)
        .lte("day_berlin", toYmd)
        .order("day_berlin", { ascending: true }),
      supabaseSrv
        .from("scan_events")
        .select("item_name")
        .eq("restaurant_id", restaurantId)
        .eq("event_type", "item_detail")
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso)
        .limit(10000),
      supabaseSrv
        .from("scan_events")
        .select("kategorie")
        .eq("restaurant_id", restaurantId)
        .eq("event_type", "category_enter")
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso)
        .limit(10000),
      supabaseSrv
        .from("scan_events")
        .select("tisch_nummer,created_at")
        .eq("restaurant_id", restaurantId)
        .eq("event_type", "scan")
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso)
        .order("created_at", { ascending: true })
        .limit(10000),
    ]);

    if (rRes.error) {
      return NextResponse.json({ error: rRes.error.message }, { status: 500 });
    }
    if (!rRes.data) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    if (tRes.error) {
      return NextResponse.json({ error: tRes.error.message }, { status: 500 });
    }
    if (frRes.error) {
      return NextResponse.json({ error: frRes.error.message }, { status: 500 });
    }
    if (dailyRes.error) {
      return NextResponse.json({ error: dailyRes.error.message }, { status: 500 });
    }
    if (itemsRes.error) {
      return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
    }
    if (catsRes.error) {
      return NextResponse.json({ error: catsRes.error.message }, { status: 500 });
    }
    if (tableScansRes.error) {
      return NextResponse.json({ error: tableScansRes.error.message }, { status: 500 });
    }

    restaurantRow = rRes.data as RestaurantRow;
    tablesData = tRes.data as FounderRestaurantTableRow[] | null;
    extRow = frRes.data
      ? {
          next_visit: (frRes.data.next_visit as string | null) ?? null,
          last_visit: (frRes.data.last_visit as string | null) ?? null,
          note: (frRes.data.note as string | null) ?? null,
          sticker_tier: (frRes.data.sticker_tier as string | null) ?? null,
          sticker_paid: Boolean(frRes.data.sticker_paid),
          sticker_count: Number(frRes.data.sticker_count ?? 0),
        }
      : null;
    dailyRows = (dailyRes.data ?? []) as DailyRow[];
    topItemRows = (itemsRes.data ?? []) as Array<{ item_name: string | null }>;
    topCategoryRows = (catsRes.data ?? []) as Array<{ kategorie: string | null }>;
    tableScanRows = (tableScansRes.data ?? []) as Array<{ tisch_nummer: number | null; created_at: string }>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const tables = (tablesData ?? []) as FounderRestaurantTableRow[];
  const scansByBerlinDay: Record<string, number> = {};
  const blocks = { morning: 0, midday: 0, evening: 0, night: 0 };
  let totalSessions = 0;
  let withConsent = 0;
  let totalScans = 0;
  const dailyDays = new Set<string>();

  for (const r of dailyRows) {
    scansByBerlinDay[r.day_berlin] = (scansByBerlinDay[r.day_berlin] ?? 0) + Number(r.scan_count ?? 0);
    blocks.morning += Number(r.scans_morning ?? 0);
    blocks.midday += Number(r.scans_midday ?? 0);
    blocks.evening += Number(r.scans_evening ?? 0);
    blocks.night += Number(r.scans_night ?? 0);
    totalSessions += Number(r.sessions_count ?? 0);
    withConsent += Number(r.sessions_with_consent ?? 0);
    totalScans += Number(r.scan_count ?? 0);
    dailyDays.add(r.day_berlin);
  }

  if (includesToday && !dailyDays.has(todayYmd)) {
    const fromTodayIso = startOfBerlinYmdUtcIso(todayYmd);
    const toTomorrowIso = startOfBerlinYmdUtcIso(nextBerlinYmd(todayYmd));
    const { data: todayRows, error: todayErr } = await supabaseSrv
      .from("scan_events")
      .select("id,session_id,event_type,created_at,stunde,tier,restaurant_id")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fromTodayIso)
      .lt("created_at", toTomorrowIso)
      .limit(10000);
    if (todayErr) {
      return NextResponse.json({ error: todayErr.message }, { status: 500 });
    }
    const rawToday = (todayRows ?? []) as RawRestaurantEventRow[];
    const todayScans = rawToday.filter((e) => e.event_type === "scan");
    scansByBerlinDay[todayYmd] = (scansByBerlinDay[todayYmd] ?? 0) + todayScans.length;
    totalScans += todayScans.length;
    for (const e of todayScans) {
      blocks[timeBlockForHour(eventHourBerlin(e))]++;
    }
    const sessions = new Map<string, number>();
    for (const e of rawToday) {
      const k = sessionKey(e);
      const t = e.tier ?? 0;
      const cur = sessions.get(k) ?? 0;
      if (t > cur) sessions.set(k, t);
    }
    totalSessions += sessions.size;
    withConsent += [...sessions.values()].filter((t) => t >= 1).length;
  }

  const granularity = pickGranularity(fromYmd, toYmd);
  const days = iterateBerlinDaysInclusive(fromYmd, toYmd);
  let chartLabels: string[] = [];
  let chartScanCounts: number[] = [];
  if (granularity === "day") {
    chartLabels = days.map((d) => formatDeShort(d));
    chartScanCounts = days.map((d) => scansByBerlinDay[d] ?? 0);
  } else {
    const monthOrder: string[] = [];
    const seen = new Set<string>();
    for (const d of days) {
      const k = d.slice(0, 7);
      if (!seen.has(k)) {
        seen.add(k);
        monthOrder.push(k);
      }
    }
    chartLabels = monthOrder.map((k) => {
      const [ys, ms] = k.split("-").map(Number);
      return new Date(ys, ms - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    });
    chartScanCounts = monthOrder.map((k) =>
      days.reduce((acc, d) => (d.startsWith(k) ? acc + (scansByBerlinDay[d] ?? 0) : acc), 0),
    );
  }

  const byTisch = new Map<number, { count: number; last: string }>();
  for (const e of tableScanRows) {
    if (e.tisch_nummer == null) continue;
    const n = e.tisch_nummer;
    const cur = byTisch.get(n) ?? { count: 0, last: e.created_at };
    byTisch.set(n, { count: cur.count + 1, last: e.created_at > cur.last ? e.created_at : cur.last });
  }
  const tableCards = tables
    .map((t) => {
      const agg = byTisch.get(t.tisch_nummer);
      return {
        id: t.id,
        tisch_nummer: t.tisch_nummer,
        bereich: t.bereich,
        qr_url: t.qr_url,
        scanCount: agg?.count ?? 0,
        lastScanAt: agg?.last ?? null,
      };
    })
    .sort((a, b) => b.scanCount - a.scanCount);

  const itemMap = new Map<string, number>();
  for (const r of topItemRows) {
    const n = r.item_name?.trim();
    if (!n) continue;
    itemMap.set(n, (itemMap.get(n) ?? 0) + 1);
  }
  const topItems = [...itemMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const catMap = new Map<string, number>();
  for (const r of topCategoryRows) {
    const k = r.kategorie?.trim();
    if (!k) continue;
    catMap.set(k, (catMap.get(k) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const withoutConsent = Math.max(0, totalSessions - withConsent);
  const ratePct = totalSessions > 0 ? Math.round((withConsent / totalSessions) * 100) : 0;
  const computed = {
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

  const restaurant: RestaurantAnalyticsApiRestaurant = {
    id: restaurantRow.id,
    name: restaurantRow.name,
    slug: restaurantRow.slug,
    stadt: restaurantRow.stadt ?? null,
    telefon: restaurantRow.telefon ?? null,
    aktiv: Boolean(restaurantRow.aktiv),
  };

  const payload: RestaurantAnalyticsApiPayload = {
    fromYmd,
    toYmd,
    restaurant,
    tables,
    founderExtra: extRow,
    computed,
    eventRowCount: totalScans,
  };

  return NextResponse.json(payload);
}
